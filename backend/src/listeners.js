const webrtc = require("wrtc")
const { peers, consumers, createPeerConnection, handleTrackEvent} = require("./helpers")
const { logger } = require("./config")

const socketOnClose = (socket, broadcast) => {
    logger.log({level: "info", message: "Peer disconnected: " + socket})

    for(let [key, value] of peers.entries()) {
        if(value === socket) {
            peers.delete(key)
            break
        }
    }

    for(let [key, value] of consumers.entries()) {
        if(value === socket) {
            consumers.delete(key)
            break
        }
    }

    broadcast(JSON.stringify({
        type: 'userLeft',
        id: socket.id
    }))
}

const socketOnConnection = async (socket, body, broadcast) => {
    const peerConnection = createPeerConnection()
    peers.get(body.uqid).username = body.username
    peers.get(body.uqid).peer = peerConnection
    peerConnection.ontrack = (e) => { handleTrackEvent(e, body.uqid, broadcast) }
    const desc = new webrtc.RTCSessionDescription(body.sdp)
    await peerConnection.setRemoteDescription(desc)
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    const payload = peerConnection.localDescription
    socket.send(JSON.stringify(payload));
    logger.log({level: "info", message: "Sent 'connect' response: " + JSON.stringify(payload)})
}

const socketOnGetPeers = (socket, body) => {
    const otherPeers = [];
    peers.forEach((peer, key) => {
        if (key !== body.uqid) {
            const peerInfo = {
                id: key,
                username: peer.username,
            }
            otherPeers.push(peerInfo);
        }
    });

    const payload = {
        type: 'peers',
        peers: otherPeers
    }
    let jsonPayload = JSON.stringify(payload)
    socket.send(jsonPayload);
    logger.log({level: "info", message: "Sent 'getPeers' response: " + JSON.stringify(payload)})
}

const socketOnIce = (socket, body) => {
    const user = peers.get(body.uqid);
    if (user.peer) {
        user.peer
            .addIceCandidate(new webrtc.RTCIceCandidate(body.ice))
            .catch(e => logger.log({level: 'error', message: e}));
    }
}

const socketOnConsume = async (socket, body) => {
    try {
        let { id, sdp, consumerId } = body
        const remoteUser = peers.get(id)
        const newPeer = createPeerConnection()
        consumers.set(consumerId, newPeer)
        const desc = new webrtc.RTCSessionDescription(sdp)
        await consumers.get(consumerId).setRemoteDescription(desc)

        remoteUser.stream.getTracks().forEach(track => {
            consumers.get(consumerId).addTrack(track, remoteUser.stream)
        })
        const answer = await consumers.get(consumerId).createAnswer()
        await consumers.get(consumerId).setLocalDescription(answer)

        const payload = {
            type: 'consume',
            sdp: consumers.get(consumerId).localDescription,
            username: remoteUser.username,
            id,
            consumerId
        }

        socket.send(JSON.stringify(payload))
        logger.log({level: "info", message: "Sent 'consume' response: " + JSON.stringify(payload)})
    } catch (error) {
        logger.log({level: 'error', message: error})
    }
}

const socketOnConsumerIce = (body) => {
    if (consumers.has(body.consumerId)) {
        consumers.get(body.consumerId)
            .addIceCandidate(new webrtc.RTCIceCandidate(body.ice))
            .catch(error => logger.log({level: 'error', message: error}))
    }
}

module.exports = { peers, consumers, socketOnConsumerIce, socketOnIce,
    socketOnConsume, socketOnClose, socketOnGetPeers, socketOnConnection }