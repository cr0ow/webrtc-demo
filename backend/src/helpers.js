const { RTCPeerConnection } = require("wrtc");

const peers = new Map()
const consumers = new Map()

const handleTrackEvent = (e, peerId, broadcast) => {
    peers.get(peerId).stream = e.streams[0];

    console.log("event", peers.get(peerId).username)
    const payload = {
        type: 'userJoined',
        id: peerId,
        username: peers.get(peerId).username,
        stream: peers.get(peerId).stream
    }
    broadcast(JSON.stringify(payload));
}

const createPeerConnection = () => {
    return new RTCPeerConnection({
        iceServers: [
            {'urls': 'stun:stun.stunprotocol.org:3478'},
            {'urls': 'stun:stun.l.google.com:19302'},
        ]
    });
}

module.exports = { peers, consumers, handleTrackEvent, createPeerConnection }