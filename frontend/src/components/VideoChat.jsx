import {useEffect, useRef, useState} from 'react';
import uuid from 'react-uuid';
import Video from './Video.jsx';
import DisplayName from './DisplayName.jsx';
import PropTypes from 'prop-types';


export default function VideoChat({connection}) {
    const [username, setUsername] = useState('')
    const [isConnected, setIsConnected] = useState(false)
    const [remoteStreams, setRemoteStreams] = useState([])
    const consumers = useRef(new Map())
    const clients = useRef(new Map())
    const localPeer = useRef(null)
    const localUUID = useRef(null)
    const localStream = useRef({})

    useEffect(() => {
        connection.onmessage = handleMessage
        connection.onclose = handleClose

        connection.onopen = () => {
            setIsConnected(true)
            console.log('Socket connected')
        }
    }, []);

    const handleClose = () => {
        connection = {}
        setIsConnected(false)
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = {}
        clients.current.clear()
        consumers.current.clear()
    }

    const handleMessage = async ({ data }) => {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'welcome':
                localUUID.current = message.id
                break;
            case 'newProducer':
                await handleNewProducer(message);
                break;
            case 'userLeft':
                removeUser(message);
                break;
            case 'peers':
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

    const handleNegotiation = async () => {
        const offer = await localPeer.current.createOffer();
        await localPeer.current.setLocalDescription(offer);

        connection.send(JSON.stringify({
            type: 'connect',
            sdp: localPeer.current.localDescription,
            uqid: localUUID.current,
            username: username
        }));
    }

    const handlePeers = async ({ peers }) => {
        if (peers.length > 0) {
            peers.forEach(peer => {
                clients.current.set(peer.id, peer);
                consumeOnce(peer);
            });
        }
    };

    const handleNewProducer = async ({ id, username }) => {
        if (id === localUUID.current) return;

        console.log('Consuming', id);
        clients.current.set(id, { id, username });
        await consumeOnce({ id, username });
    };

    const removeUser = ({ id }) => {
        const { consumerId } = clients.current.get(id);
        consumers.current.delete(consumerId);
        clients.current.delete(id);
        const videoElement = document.getElementById(`remote_${consumerId}`);
        if (videoElement) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
        }
        const userElement = document.getElementById(`user_${consumerId}`);
        if (userElement) userElement.remove();
    };

    const handleConsume = ({ sdp, consumerId }) => {
        const desc = new RTCSessionDescription(sdp);
        consumers.current.get(consumerId).setRemoteDescription(desc).catch(console.error);
    };

    const handleAnswer = (sdp) => {
        const desc = new RTCSessionDescription(sdp);
        localPeer.current.setRemoteDescription(desc).catch(console.error);
    };

    const connect = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localStream.current = stream

        const videoElement = createVideoElement(username, stream)
        setRemoteStreams(prevItems => [...prevItems, videoElement])

        localPeer.current = createPeer()
        localStream.current.getTracks().forEach(track => localPeer.current.addTrack(track, stream))
        await subscribe()
    };

    const disconnect = () => {
        connection.close(1000, 'User disconnected manually')
    }

    async function subscribe() {
        await consumeAll()
    }

    async function consumeAll() {
        const payload = {
            type: 'getPeers',
            uqid: localUUID.current
        }

        connection.send(JSON.stringify(payload));
    }

    const createPeer = () => {
        const localPeerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.stunprotocol.org:3478' },
                { urls: 'stun:stun.l.google.com:19302' },
            ],
        });
        localPeerConnection.onicecandidate = handleIceCandidate;
        localPeerConnection.onnegotiationneeded = () => handleNegotiation();
        return localPeerConnection;
    };

    const handleIceCandidate = ({ candidate }) => {
        if (candidate && candidate.candidate) {
            connection.send(JSON.stringify({ type: 'ice', ice: candidate, uqid: localUUID.current }));
        }
    };

    const consumeOnce = async (peer) => {
        const consumerId = uuid();
        console.log("consumerId: ", consumerId)
        const consumerTransport = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.stunprotocol.org:3478' },
                { urls: 'stun:stun.l.google.com:19302' },
            ],
        });

        consumers.current.set(consumerId, consumerTransport);
        consumerTransport.onicecandidate = (e) => handleConsumerIceCandidate(e, peer.id, consumerId);
        consumerTransport.ontrack = (e) => handleRemoteTrack(e.streams[0], peer.username);
        const offer = await consumerTransport.createOffer();
        await consumerTransport.setLocalDescription(offer);

        connection.send(JSON.stringify({
            type: 'consume',
            uqid: peer.id,
            consumerId: consumerId,
            sdp: consumerTransport.localDescription,
        }));
    };

    const handleConsumerIceCandidate = (e, id, consumerId) => {
        const { candidate } = e;
        if (candidate && candidate.candidate) {
            connection.send(JSON.stringify({ type: 'consumerIce', ice: candidate, uqid: id, consumerId }));
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
            id: `remote_${uuid()}`,
            stream,
            username,
        };
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
            <button onClick={disconnect} disabled={isConnected}>Disconnect</button>
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
    connection: PropTypes.object
}
