import VideoChat from './components/VideoChat.jsx';
import { useRef } from "react";

export default function App() {
    const connection = useRef(new WebSocket("wss://192.168.0.126:5000"))

    return (
        <div>
            <h1>WebRTC Demo</h1>
            <VideoChat connection={connection.current} />
        </div>
    );
};
