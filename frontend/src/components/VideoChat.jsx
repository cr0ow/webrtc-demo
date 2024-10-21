import {useEffect, useRef, useState} from 'react';
import Video from './Video.jsx';
import PropTypes from 'prop-types';


export default function VideoChat({connection}) {
    const [username, setUsername] = useState('')
    const [isConnected, setIsConnected] = useState(false)
    const [remoteStreams, setRemoteStreams] = useState([])
    const remoteProducers = useRef(new Map())
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
        remoteProducers.current.clear()
    }

    const handleMessage = async ({ data }) => {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'welcome':
                localUUID.current = message.id
                console.log("id: ", localUUID.current)
                break;
            case 'userJoined':
                await handleUserJoined(message);
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

        console.log("user: ", username)
        connection.send(JSON.stringify({
            type: 'connect',
            sdp: localPeer.current.localDescription,
            uqid: localUUID.current,
            username: username
        }));
    }

    const handlePeers = async ({ peers }) => {
        for (const peer of peers) {
            remoteProducers.current.set(peer.id, peer.peer)
        }
    };

    const handleUserJoined = async ({ id, username, stream }) => {
        if (id !== localUUID.current) {
            console.log('User joined: ', id);
            remoteProducers.current.set(id, {id, username, stream });
            console.log(remoteProducers.current.get(id))
            setRemoteStreams(prevItems => [...prevItems, createVideoElement(id, username, stream)])
            await consumeOnce(id, username)
        }
    };

    const removeUser = ({ id }) => {
        remoteProducers.current.delete(id);
        const videoElement = document.getElementById(`remote_${id}`);
        if (videoElement) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
        }
        const userElement = document.getElementById(`user_${id}`);
        if (userElement) {
            userElement.remove();
        }
    };

    const handleConsume = ({ sdp, consumerId }) => {
        const desc = new RTCSessionDescription(sdp);
        remoteProducers.current.get(consumerId).setRemoteDescription(desc).catch(console.error);
    };

    const handleAnswer = (sdp) => {
        const desc = new RTCSessionDescription(sdp);
        localPeer.current.setRemoteDescription(desc).catch(console.error);
    };

    const connect = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localStream.current = stream

        let peerConnection = createPeer()
        peerConnection.ontrack = handleTrackEvent

        stream.getTracks().forEach(track => {
            peerConnection.addTrack(track, stream)
        })
        const video = createVideoElement(localUUID.current, username, stream)
        setRemoteStreams(prevItems => [...prevItems, video])
        localPeer.current = peerConnection

        await consumeAll()
    };

    const handleTrackEvent = (e) => {
        for(let [key, value] in remoteProducers.current.entries()) {
            if(value === e.target) {
                // const videoElement = createVideoElement(key, value.username, e.streams[0])
                // setRemoteStreams(prevItems => [...prevItems, videoElement])
                break
            }
        }
    }

    const disconnect = () => {
        connection.close(1000, 'User disconnected manually')
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
            connection.send(JSON.stringify({ type: 'ice', ice: candidate, uqid: localUUID.current }))
        }
    };

    const consumeOnce = async (id, username) => {
        console.log("consumerId: ", id)
        console.log("username: ", username)

        const remotePeerConnection = createPeer()
        remotePeerConnection.onicecandidate = (e) => handleRemoteIceCandidate(e, id)
        remotePeerConnection.ontrack = (e) => handleRemoteTrack(e.streams[0], username)

        const offer = await remotePeerConnection.createOffer()
        await remotePeerConnection.setLocalDescription(offer)
        remoteProducers.current.set(id, remotePeerConnection)

        connection.send(JSON.stringify({
            type: 'consume',
            uqid: localUUID.current,
            consumerId: id,
            sdp: remotePeerConnection.localDescription,
        }));
    };

    const handleRemoteIceCandidate = (e, consumerId) => {
        const { candidate } = e;
        if (candidate && candidate.candidate) {
            connection.send(JSON.stringify({
                type: 'consumerIce',
                ice: candidate,
                uqid: localUUID.current,
                consumerId: consumerId }));
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

    const createVideoElement = (id, username, stream) => {
        return {
            id: `remote_${id}`,
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
                            <div className="display_name">{video.username}</div>
                            <Video id={video.id} stream={video.stream}/>
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