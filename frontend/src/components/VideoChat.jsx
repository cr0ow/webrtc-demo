import {useEffect, useRef, useState} from 'react';
import Video from './Video.jsx';
import PropTypes from 'prop-types';
import uuid from "react-uuid";


export default function VideoChat({connection}) {
    const [username, setUsername] = useState('')
    const [isConnected, setIsConnected] = useState(false)
    const remotePeers = useRef(new Map())
    const remoteProducers = useRef(new Map())
    const localPeer = useRef(null)
    const localUUID = useRef(null)
    const localStream = useRef(null)

    useEffect(() => {
        connection.onmessage = handleMessage
        connection.onclose = handleClose

        connection.onopen = () => {
            setIsConnected(true)
            console.log('Socket connected')
        }
    }, []);

    const handleClose = () => {
        console.log('Socket disconnected')
        connection = {}
        setIsConnected(false)
        if(localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }
        remotePeers.current.clear()
        remoteProducers.current.clear()
    }

    const handleMessage = async ({ data }) => {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'welcome':
                connection.id = message.id
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
            case 'subscribed':
                handleSubscribed(message);
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
            id: localUUID.current,
            username: username
        }));
    }

    const handlePeers = async ({ peers }) => {
        for (const peer of peers) {
            remotePeers.current.set(peer.id, { id: peer.id, username: peer.username })
            await subscribeSingleProducer(peer)
        }
    };

    const handleNewProducer = async ({ id, username }) => {
        if (id !== localUUID.current) {
            console.log('New producer: ', id);
            remotePeers.current.set(id, { id: id, username: username });
            await subscribeSingleProducer({ id, username })
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

    const handleSubscribed = ({ sdp: sdp, producerId: producerId }) => {
        const desc = new RTCSessionDescription(sdp)
        remoteProducers.current.get(producerId).setRemoteDescription(desc).catch(console.error)
    };

    const handleAnswer = (sdp) => {
        const desc = new RTCSessionDescription(sdp)
        localPeer.current.setRemoteDescription(desc).catch(console.error)
    };

    const connect = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        remotePeers.current.set(localUUID.current, {id: localUUID.current, username: username, stream: stream})
        await handleRemoteTrack(localUUID.current, username, stream)

        localStream.current = stream
        localPeer.current = createPeer()
        stream.getTracks().forEach(track => { localPeer.current.addTrack(track, stream) })

        const payload = {
            type: 'getPeers',
            id: localUUID.current
        }
        connection.send(JSON.stringify(payload));
    }

    const disconnect = () => {
        connection.close(1000, 'User disconnected manually')
    }

    const createPeer = () => {
        const localPeerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        })
        localPeerConnection.onicecandidate = handleIceCandidate
        localPeerConnection.onnegotiationneeded = handleNegotiation
        return localPeerConnection
    };

    const handleIceCandidate = ({ candidate }) => {
        if (candidate && candidate.candidate) {
            connection.send(JSON.stringify({ type: 'ice', ice: candidate, id: localUUID.current }))
        }
    };

    const createProducerTransport = async (peer) => {
        const producerId = uuid()
        const producerTransport = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        })

        const offer = await producerTransport.createOffer()
        await producerTransport.setLocalDescription(offer)

        producerTransport.onicecandidate = event => { handleProducerIceCandidate(event, peer.id, producerId) }
        producerTransport.ontrack = event => { handleRemoteTrack(peer.id, peer.username, event.streams[0]) }

        producerTransport.id = producerId
        producerTransport.peer = { id: peer.id, username: peer.username }
        producerTransport.consumerId = producerId

        producerTransport.addTransceiver('video', { direction: "recvonly" })
        producerTransport.addTransceiver('audio', { direction: "recvonly" })

        remoteProducers.current.set(producerId, producerTransport)
        return producerTransport;
    }

    const subscribeSingleProducer = async (peer) => {
        const transport = await createProducerTransport(peer)
        const payload = {
            type: 'subscribe',
            id: peer.id,
            producerId: transport.id,
            sdp: await transport.localDescription
        }
        connection.send(JSON.stringify(payload))
    }

    const handleProducerIceCandidate = (event, id, consumerId) => {
        const { candidate } = event;
        if (candidate && candidate.candidate && candidate.candidate.length > 0) {
            connection.send(JSON.stringify({
                type: 'producerIce',
                ice: candidate,
                id: localUUID.current,
                consumerId: consumerId
            }));
        }
    };

    async function handleRemoteTrack(id, username, stream) {
        const userVideo = findProducerVideoElement(id)
        if (userVideo) {
            const tracks = userVideo.srcObject.getTracks()
            const track = stream.getTracks()[0]
            if (!tracks.includes(track)) {
                userVideo.srcObject.addTrack(track)
            }
        } else {
            remotePeers.current.get(id).stream = stream
            remotePeers.current.get(id).username = username
            //TODO: dodać harker
        }
    }

    const findProducerVideoElement = producerId => {
        const video = document.querySelector(`#remote_${producerId}`)
        if (!video) {
            return false;
        }
        return video
    }

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
                    {Array.from(remotePeers.current.entries()).map(([id, peer]) => (
                        <div key={id} id={`user_${id}`} className="videoWrap">
                            <div className="display_name">{peer.username}</div>
                            <Video id={`remote_${id}`} stream={peer.stream}/>
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