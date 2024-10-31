const webrtc = require("wrtc")
const { peers, producers, createPeerConnection, handleTrackEvent} = require("./helpers")
const { logger } = require("./config")
const { v4: uuid4 } = require('uuid')

const socketOnClose = (socketId, broadcast) => {
    logger.log({ level: "info", message: "Peer disconnected: " + socketId })

    peers.delete(socketId)
    producers.delete(socketId)

    broadcast(JSON.stringify({
        type: 'userLeft',
        id: socketId
    }))
}

const socketOnConnect = async (socket, body, broadcast) => {
    const peerConnection = createPeerConnection()
    const { id, sdp, username } = body

    peerConnection.ontrack = (e) => handleTrackEvent(e, id, broadcast)

    const desc = new webrtc.RTCSessionDescription(sdp)
    await peerConnection.setRemoteDescription(desc)
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    peers.get(id).username = username
    peers.get(id).peer = peerConnection

    const payload = peerConnection.localDescription
    socket.send(JSON.stringify(payload));
    logger.log({ level: "info", message: "Sent response to 'connect' event, emitted_event_type = 'answer', payload hidden" })
}

const socketOnGetPeers = (socket, body) => {
    const otherPeers = [];
    for(let [peerId, peer] of peers.entries()) {
        if (peerId !== body.id) {
            const peerInfo = {
                id: peerId,
                username: peer.username
            }
            otherPeers.push(peerInfo);
        }
    }

    const payload = {
        type: 'peers',
        peers: otherPeers
    }
    let jsonPayload = JSON.stringify(payload)
    socket.send(jsonPayload);
    logger.log({ level: "info", message: "Sent response to 'getPeers' event, emitted_event_type = 'peers', payload = " + jsonPayload })
}

const socketOnIce = (body) => {
    const user = peers.get(body.id)
    if (user.peer) {
        user.peer.addIceCandidate(new webrtc.RTCIceCandidate(body.ice))
            .catch(error => logger.log({ level: 'error', message: error }))
    }
}

const socketOnSubscribe = async (socket, body) => {
    try {
        const remoteUser = peers.get(body.id)
        const newPeer = createPeerConnection()
        producers.set(body.producerId, newPeer)
        const desc = new webrtc.RTCSessionDescription(body.sdp)
        await producers.get(body.producerId).setRemoteDescription(desc)

        remoteUser.stream.getTracks().forEach(track => {
            producers.get(body.producerId).addTrack(track, remoteUser.stream)
        })

        const answer = await producers.get(body.producerId).createAnswer()
        await producers.get(body.producerId).setLocalDescription(answer)

        const payload = {
            type: 'subscribed',
            sdp: producers.get(body.producerId).localDescription,
            username: remoteUser.username,
            id: body.id,
            producerId: body.producerId
        }

        const jsonPayload = JSON.stringify(payload)
        socket.send(jsonPayload)
        logger.log({ level: "info", message: "Sent response to 'subscribe' event, emitted_event_type = 'subscribed', payload = " + jsonPayload })
    } catch (error) {
        logger.log({ level: 'error', message: error })
    }
}

const socketOnProducerIce = (body) => {
    if (producers.has(body.producerId)) {
        producers.get(body.producerId)
            .addIceCandidate(new webrtc.RTCIceCandidate(body.ice))
            .catch(error => logger.log({ level: 'error', message: error }))
    }
}

module.exports = { peers, producers, socketOnProducerIce, socketOnIce,
    socketOnSubscribe, socketOnClose, socketOnGetPeers, socketOnConnect }