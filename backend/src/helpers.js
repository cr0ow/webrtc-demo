const { RTCPeerConnection } = require("wrtc");

const peers = new Map()
const producers = new Map()

const handleTrackEvent = (event, peerId, broadcast) => {
    if (event.streams && event.streams[0]) {
        peers.get(peerId).stream = event.streams[0];

        const payload = {
            type: 'newProducer',
            id: peerId,
            username: peers.get(peerId).username
        }
        broadcast(JSON.stringify(payload));
    }
}

const createPeerConnection = () => {
    return new RTCPeerConnection({
        iceServers: [
            {'urls': 'stun:stun.l.google.com:19302'}
        ]
    })
}

module.exports = { peers, producers, handleTrackEvent, createPeerConnection }