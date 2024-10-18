import {useEffect, useState} from 'react';
import Video from './Video.jsx';
import DisplayName from './DisplayName.jsx';
import PropTypes from 'prop-types';


export default function VideoChat({connection, setConnection, localUUID, setLocalUUID}) {
    const [username, setUsername] = useState('')
    const [isConnected, setIsConnected] = useState(false)
    const [remoteStreams, setRemoteStreams] = useState([])
    const [localStream, setLocalStream] = useState({})
    const [consumers, setConsumers] = useState(new Map())
    const [clients, setClients] = useState(new Map())

    useEffect(() => {
        let conn = new WebSocket(`wss://192.168.0.126:5000`)
        conn.onmessage = handleMessage
        conn.onclose = handleClose

        conn.onopen = () => {
            setIsConnected(true)
            console.log('Socket connected')
        }

        setConnection(conn)
    }, []);

    const handleClose = () => {
        setConnection(null)
        setIsConnected(false)
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream({})
        setClients(new Map())
        setConsumers(new Map())
    }

    const handleMessage = async ({ data }) => {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'welcome':
                setLocalUUID(message.id)
                break;
            case 'newProducer':
                await handleNewProducer(message);
                break;
            case 'userLeft':
                removeUser(message);
                break;
            case 'peers':
                console.log("peers", localUUID)
                await handlePeers(message);
                break;
            case 'consume':
                handleConsume(message);
                break;
            case 'answer':
                handleAnswer(message);
                break;
        }
    };

    const handleNegotiation = async (peer) => {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        connection.send(JSON.stringify({
            type: 'connect',
            sdp: peer.localDescription,
            uqid: localUUID,
            username: username
        }));
    }

    const handlePeers = async ({ peers }) => {
        if (peers.length > 0) {
            peers.forEach(peer => {
                clients.set(peer.id, peer);
                consumeOnce(peer);
            });
        }
    };

    const handleNewProducer = async ({ id, username }) => {
        if (id === localUUID) return;

        console.log('Consuming', id);
        clients.set(id, { id, username });
        await consumeOnce({ id, username });
    };

    const removeUser = ({ id }) => {
        const { consumerId } = clients.get(id);
        consumers.delete(consumerId);
        clients.delete(id);
        const videoElement = document.getElementById(`remote_${consumerId}`);
        if (videoElement) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
        }
        const userElement = document.getElementById(`user_${consumerId}`);
        if (userElement) userElement.remove();
    };

    const handleConsume = ({ sdp, consumerId }) => {
        const desc = new RTCSessionDescription(sdp);
        consumers.get(consumerId).setRemoteDescription(desc).catch(console.error);
    };

    const handleAnswer = ({ sdp }) => {
        const desc = new RTCSessionDescription(sdp);
        console.log("localStream:")
        console.log(localStream)
        localStream.setRemoteDescription(desc).catch(console.error);
    };

    const connect = async () => {
        if(!connection) return

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream)

        const videoElement = createVideoElement(username, stream);
        setRemoteStreams(prev => [...prev, videoElement]);

        const localPeer = createPeer();
        stream.getTracks().forEach(track => localPeer.addTrack(track, stream));
        await subscribe();
    };

    async function subscribe() {
        await consumeAll();
    }

    async function consumeAll() {
        const payload = {
            type: 'getPeers',
            uqid: localUUID
        }

        connection.send(JSON.stringify(payload));
    }

    const createPeer = () => {
        const localPeer = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.stunprotocol.org:3478' },
                { urls: 'stun:stun.l.google.com:19302' },
            ],
        });
        localPeer.onicecandidate = handleIceCandidate;
        localPeer.onnegotiationneeded = () => handleNegotiation(localPeer);
        return localPeer;
    };

    const handleIceCandidate = ({ candidate }) => {
        if (candidate && candidate.candidate) {
            connection.send(JSON.stringify({ type: 'ice', ice: candidate, uqid: localUUID }));
        }
    };

    const consumeOnce = async (peer) => {
        const consumerId = uuidv4();
        const consumerTransport = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.stunprotocol.org:3478' },
                { urls: 'stun:stun.l.google.com:19302' },
            ],
        });

        consumers.set(consumerId, consumerTransport);
        consumerTransport.onicecandidate = (e) => handleConsumerIceCandidate(e, peer.id, consumerId);
        consumerTransport.ontrack = (e) => handleRemoteTrack(e.streams[0], peer.username);
        const offer = await consumerTransport.createOffer();
        await consumerTransport.setLocalDescription(offer);

        connection.send(JSON.stringify({
            type: 'consume',
            id: peer.id,
            consumerId: consumerId,
            sdp: consumerTransport.localDescription,
        }));
    };

    const handleConsumerIceCandidate = (e, id, consumerId) => {
        const { candidate } = e;
        if (candidate && candidate.candidate) {
            connection.send(JSON.stringify({ type: 'consumer_ice', ice: candidate, uqid: id, consumerId }));
        }
    };

    async function handleRemoteTrack(stream, remoteUsername) {
        const userVideo = document.querySelector(`#remote_${remoteUsername}`)
        if (userVideo) {
            userVideo.srcObject.addTrack(stream.getTracks()[0])
            return
        }
        const video = document.createElement('video');
        video.id = `remote_${remoteUsername}`
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = (remoteUsername === remoteUsername.value);

        const div = document.createElement('div')
        div.id = `user_${remoteUsername}`;
        div.classList.add('videoWrap')

        const nameContainer = document.createElement('div');
        nameContainer.classList.add('display_name')

        const textNode = document.createTextNode(remoteUsername);
        nameContainer.appendChild(textNode);
        div.appendChild(nameContainer);
        div.appendChild(video);
        document.querySelector('.videos-inner').appendChild(div);
    }

    const createVideoElement = (username, stream) => {
        return {
            id: `remote_${uuidv4()}`,
            stream,
            username,
        };
    };

    const uuidv4 = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    };

    return (
        <div>
            <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
            />
            <button onClick={connect} disabled={!isConnected || !username}>Connect</button>
            <div id="remote_videos">
                <div className="videos-inner">
                    {remoteStreams.map(video => (
                        <div key={video.id} id={`user_${video.id}`} className="videoWrap">
                            <DisplayName username={video.username} />
                            <Video id={video.id} stream={video.stream} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

VideoChat.propTypes = {
    connection: PropTypes.object,
    setConnection: PropTypes.func,
    localUUID: PropTypes.string,
    setLocalUUID: PropTypes.func
}
