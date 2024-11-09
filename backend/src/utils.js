const { RTCPeerConnection } = require("wrtc")

/*
    peer {
        id: string,
        username: string,
        socket: WebSocket,
        connection: RTCPeerConnection,
        stream: MediaStream,
        subscribedPeers: Map<id, RTCPeerConnection>
    }
*/
const peers = new Map()

const handleTrackEvent = (event, id, broadcast) => {
    if (event.streams && event.streams[0]) {
        console.log("TRACK EVENT: ", JSON.stringify(event.streams[0]), id)
        peers.get(id).stream = event.streams[0]

        const payload = {
            type: 'newProducer',
            producerId: id,
            username: peers.get(id).username
        }
        broadcast(JSON.stringify(payload))
    }
}

const createPeerConnection = () => {
    return new RTCPeerConnection({
        iceServers: [
            {'urls': 'stun:stun.l.google.com:19302'}
        ]
    })
}

module.exports = { peers, handleTrackEvent, createPeerConnection }