const { logger } = require("./config")
const WebSocket = require("ws");
const nodeDataChannel = require("node-datachannel")
const {v4: uuid4} = require("uuid");

/*
    peer {
        id: string,
        username: string,
        socket: WebSocket,
        connection: PeerConnection,
        subscribedPeers: Map<id, RTCPeerConnection>
    }
*/
const peers = new Map()

const socketOnMessage = async (socket, message) => {
    const body = JSON.parse(message)
    switch (body.type) {
        case 'offer':
            socketOnOffer(socket, body)
            break
        case 'answer':
            socketOnAnswer(body)
            break
        case 'candidate':
            socketOnCandidate(body)
            break
        default:
            break
    }
}

const socketOnOffer = (socket, body) => {
    const { id, description, type } = body
    let peerConnection = createPeerConnection(id)
    peerConnection.onStateChange((state) => console.log('State: ', state))
    peerConnection.onGatheringStateChange((state) => console.log('GatheringState: ', state))

    peerConnection.onLocalDescription((description, type) => {
        socket.send(JSON.stringify({ id, type, description }))
    })
    peerConnection.onLocalCandidate((candidate, mid) => {
        socket.send(JSON.stringify({ id, type: 'candidate', candidate, mid }))
    })
    peerConnection.onDataChannel((dataChannel) => {
        console.log('DataChannel from ' + id + ' received with label "', dataChannel.getLabel() + '"')
        dataChannel.onMessage((msg) => console.log('Message from ' + id + ' received:', msg))
        dataChannel.sendMessage('Hello From ' + id)
    })

    peers.get(id).connection = peerConnection;
    peers.get(id).connection.setRemoteDescription(description, type)
}

const socketOnAnswer = (body) => {
    peers.get(id).connection.setRemoteDescription(body.description, body.type)
}

const socketOnConnect = (socket) => {
    socket.id = uuid4()
    logger.log({level: "info", message: "New client connected: " + socket.id})
    peers.set(socket.id, { socket: socket, id: socket.id, subscribedPeers: new Map() })
    socket.send(JSON.stringify({ 'type': 'joinedRoom', id: socket.id }))
}

const socketOnClose = (socketId) => {
    logger.log({ level: "info", message: "Peer disconnected: " + socketId })

    peers.delete(socketId)

    broadcast(JSON.stringify({
        type: 'userLeft',
        id: socketId
    }))
}

const socketOnJoinRoom = async (socket, body) => {
    const { id, sdp, username } = body
    const peerConnection = createPeerConnection(id)
    const serverConnection = createPeerConnection(`${id}_server`)

    peers.get(id).username = username

    peerConnection.onLocalDescription((sdp, type) => {
        serverConnection.setRemoteDescription(sdp, type)
    })
    peerConnection.onLocalCandidate((candidate, mid) => {
        serverConnection.addRemoteCandidate(candidate, mid)
    })

    peers.get(id).clientConnection = peerConnection
    peers.get(id).serverConnection = serverConnection

    const payload = {
        id: id,
        sdp: serverConnection.localDescription
    }
    socket.send(JSON.stringify(payload))
    logger.log({ level: "info", message: "Sent response to 'connect' event, emitted_event_type = 'answer', payload hidden" })
}

const socketOnGetPeers = (socket, body) => {
    const otherPeers = []
    for(let [peerId, peer] of peers.entries()) {
        if (peerId !== body.id) {
            const peerInfo = {
                id: peerId,
                username: peer.username
            }
            otherPeers.push(peerInfo)
        }
    }

    const payload = {
        type: 'peers',
        peers: otherPeers
    }
    let jsonPayload = JSON.stringify(payload)
    socket.send(jsonPayload)
    logger.log({ level: "info", message: "Sent response to 'getPeers' event, emitted_event_type = 'peers', payload = " + jsonPayload })
}

const socketOnIce = (body) => {
    if (peers.get(body.id).connection) {
        peers.get(body.id).connection
            .addIceCandidate(new webrtc.RTCIceCandidate(body.ice))
            .catch(error => logger.log({ level: 'error', message: error }))
    }
}

const socketOnSubscribe = async (socket, body) => {
    try {
        const { sdp, consumerId, producerId } = body
        const consumerPeer = peers.get(consumerId)
        const producerPeer = peers.get(producerId)

        if(consumerPeer.subscribedPeers.has(producerId)) {
            producerPeer.stream.getTracks().forEach(track => {
                //TODO: producer czy consumer stream??
                if(! track in producerPeer.stream.getTracks()) {
                    consumerPeer.subscribedPeers.get(producerId).addTrack(track, consumerPeer.stream)
                }
            })
        } else {
            const newPeerConnection = createPeerConnection()
            const desc = new webrtc.RTCSessionDescription(sdp)
            await newPeerConnection.setRemoteDescription(desc)

            producerPeer.stream.getTracks().forEach(track => newPeerConnection.addTrack(track, consumerPeer.stream))
            const answer = await newPeerConnection.createAnswer()
            await newPeerConnection.setLocalDescription(answer)

            consumerPeer.subscribedPeers.set(producerId, newPeerConnection)
        }

        const payload = {
            type: 'subscribed',
            sdp: consumerPeer.subscribedPeers.get(producerId).localDescription,
            producerUsername: producerPeer.username,
            producerId: producerId
        }
        const jsonPayload = JSON.stringify(payload)
        socket.send(jsonPayload)
        logger.log({ level: "info", message: "Sent response to 'subscribe' event, emitted_event_type = " +
                "'subscribed', payload = {username: " + payload.username + ", producerId: " + producerId + "}" })
    } catch (error) {
        logger.log({ level: 'error', message: error })
    }
}

const socketOnProducerIce = (ice, consumerId, producerId) => {
    if (peers.get(consumerId).subscribedPeers.has(producerId)) {
        peers.get(consumerId).subscribedPeers.get(producerId)
            .addIceCandidate(new webrtc.RTCIceCandidate(ice))
            .catch(error => logger.log({ level: 'error', message: error }))
    }
}

const broadcast = message => {
    peers.forEach(peer => {
        if (peer.socket.readyState === WebSocket.OPEN) {
            peer.socket.send(message)
        }
    })
}

const handleTrackEvent = (event, id, broadcast) => {
    if (event.streams && event.streams[0]) {
        peers.get(id).stream = event.streams[0]

        const payload = {
            type: 'newProducer',
            producerId: id,
            username: peers.get(id).username
        }
        broadcast(JSON.stringify(payload))
    }
}

const createPeerConnection = (id) => {
    return new nodeDataChannel.PeerConnection(
        `peer_${id}`,
        { iceServers:
                ['stun:stun.l.google.com:19302']
        }
    )
}

module.exports = { peers, socketOnConnect, socketOnClose, socketOnMessage }