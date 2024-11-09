import {useEffect, useRef, useState} from 'react'
import Video from './Video.jsx'
import PropTypes from 'prop-types'


export default function VideoChat({connection}) {
    const [localUsername, setLocalUsername] = useState('')
    const [isConnected, setIsConnected] = useState(false)

    /*
    remotePeer {
      id: string,
      connection: RTCPeerConnection,
      username: string,
      stream: MediaStream
    }
    */
    const remotePeers = useRef(new Map())
    const localId = useRef(null)
    const [reloadNeeded, setReloadNeeded] = useState(false)

    useEffect(() => {
        connection.onmessage = handleMessage
        connection.onclose = handleClose

        connection.onopen = () => {
            setIsConnected(true)
            console.log('Socket connected')
        }
    }, [])

    const handleClose = () => {
        console.log('Socket disconnected')
        connection = {}
        setIsConnected(false)
        remotePeers.current.clear()
    }

    const handleMessage = async ({ data }) => {
        const message = JSON.parse(data)

        switch (message.type) {
            case 'welcome':
                connection.id = message.id
                localId.current = message.id
                break
            case 'newProducer':
                await handleNewProducer(message)
                break
            case 'userLeft':
                removeUser(message)
                break
            case 'peers':
                await handlePeers(message)
                break
            case 'subscribed':
                handleSubscribed(message.sdp, message.producerUsername, message.producerId)
                break
            case 'answer':
                handleAnswer(message)
                break
        }
    }

    const handleNegotiation = async () => {
        const offer = await remotePeers.current.get(localId.current).connection.createOffer()
        await remotePeers.current.get(localId.current).connection.setLocalDescription(offer)

        connection.send(JSON.stringify({
            type: 'connect',
            sdp: remotePeers.current.get(localId.current).connection.localDescription,
            id: localId.current,
            username: localUsername
        }))
    }

    const handlePeers = async ({ peers }) => {
        for (const peer of peers) {
            if(!remotePeers.current.has(peer.id)) {
                remotePeers.current.set(peer.id, { id: peer.id, username: peer.username })
                await subscribeSingleProducer(peer)
            }
        }
    }

    const handleNewProducer = async ({ producerId, username }) => {
        if(producerId !== localId.current) {
            if(!remotePeers.current.has(producerId)) {
                remotePeers.current.set(producerId, {id: producerId, username: username})
            }
            await subscribeSingleProducer({ producerId, username })
            reload()
        }
    }

    const removeUser = ({ id }) => {
        remotePeers.current.delete(id)
        reload()
    }

    const handleSubscribed = (sdp, producerUsername, producerId) => {
        if(remotePeers.current.get(producerId).connection !== "stable") {
            const desc = new RTCSessionDescription(sdp)
            remotePeers.current.get(producerId).connection.setRemoteDescription(desc).catch(console.error)
            remotePeers.current.get(producerId).username = localUsername
            reload()
        }
    }

    const handleAnswer = ({sdp}) => {
        const desc = new RTCSessionDescription(sdp)
        remotePeers.current.get(localId.current).connection.setRemoteDescription(desc).catch(console.error)
    }

    const connect = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

        remotePeers.current.set(localId.current, {
            id: localId.current,
            username: localUsername,
            connection: createPeer()
        })

        await handleRemoteTrack(stream, localId.current)
        stream.getTracks().forEach(track => remotePeers.current.get(localId.current).connection.addTrack(track, stream))
        reload()

        const payload = {
            type: 'getPeers',
            id: localId.current
        }
        connection.send(JSON.stringify(payload))
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
    }

    const handleIceCandidate = ({ candidate }) => {
        if (candidate && candidate.candidate) {
            connection.send(JSON.stringify({ type: 'ice', ice: candidate, id: localId.current }))
        }
    }

    const createProducerConnection = async (peer) => {
        const producerConnection = new RTCPeerConnection({
            iceServers: [
                {urls: 'stun:stun.l.google.com:19302'}
            ]
        })

        producerConnection.addTransceiver('video', { direction: "recvonly" })
        producerConnection.addTransceiver('audio', { direction: "recvonly" })

        const offer = await producerConnection.createOffer()
        await producerConnection.setLocalDescription(offer)

        producerConnection.onicecandidate = event => handleProducerIceCandidate(event, peer.producerId)
        producerConnection.ontrack = event => handleRemoteTrack(event.streams[0], peer.producerId)

        remotePeers.current.set(peer.producerId, {
            id: peer.producerId,
            username: peer.username,
            connection: producerConnection
        })

        return producerConnection
    }

    const subscribeSingleProducer = async (peer) => {
        const producerConnection = await createProducerConnection(peer)
        const payload = {
            type: 'subscribe',
            sdp: await producerConnection.localDescription,
            consumerId: localId.current,
            producerId: peer.producerId
        }
        connection.send(JSON.stringify(payload))
    }

    const handleProducerIceCandidate = (event, producerId) => {
        const { candidate } = event
        if (candidate && candidate.candidate && candidate.candidate.length > 0) {
            connection.send(JSON.stringify({
                type: 'producerIce',
                ice: candidate,
                consumerId: localId.current,
                producerId: producerId
            }))
        }
    }

    function handleRemoteTrack(stream, producerId) {
        if(remotePeers.current.get(producerId).stream) {
            stream.getTracks().forEach(track => {
                if(!remotePeers.current.get(producerId).stream.getTracks().includes(track)) {
                    remotePeers.current.get(producerId).stream.addTrack(track)
                }
            })
        } else {
            remotePeers.current.get(producerId).stream = stream
        }
        reload()
    }

    const reload = () => {
        setReloadNeeded(!reloadNeeded)
    }

    return (
        <div>
            <input
                type="text"
                value={localUsername}
                onChange={(e) => setLocalUsername(e.target.value)}
                placeholder="Enter your username"
            />
            <button onClick={connect} disabled={!isConnected || !localUsername}>Connect</button>
            <button onClick={disconnect} disabled={isConnected}>Disconnect</button>
            <div id="remote_videos">
                <div className="videos-inner">
                    {Array.from(remotePeers.current.entries()).map(([id, peer]) => (
                        <div key={id} id={`user_${peer.username}`} className="videoWrap">
                            <div className="display_name">{peer.username}</div>
                            <Video id={`remote_${peer.username}`} stream={peer.stream}/>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

VideoChat.propTypes = {
    connection: PropTypes.object
}