const webrtc = require("wrtc")
const { peers, createPeerConnection, handleTrackEvent} = require("./utils")
const { logger } = require("./config")


const socketOnClose = (socketId, broadcast) => {
    logger.log({ level: "info", message: "Peer disconnected: " + socketId })

    peers.delete(socketId)

    broadcast(JSON.stringify({
        type: 'userLeft',
        id: socketId
    }))
}

const socketOnConnect = async (socket, body, broadcast) => {
    const peerConnection = createPeerConnection()
    const { id, sdp, username } = body

    peers.get(id).username = username
    peerConnection.ontrack = e => handleTrackEvent(e, id, broadcast)

    const desc = new webrtc.RTCSessionDescription(sdp)
    await peerConnection.setRemoteDescription(desc)
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    peers.get(id).connection = peerConnection

    const payload = {
        id: id,
        sdp: peerConnection.localDescription
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

module.exports = { peers, socketOnProducerIce, socketOnIce, socketOnSubscribe,
    socketOnClose, socketOnGetPeers, socketOnConnect }