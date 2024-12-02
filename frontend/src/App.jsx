import VideoChat from './components/VideoChat.jsx';
import { useRef } from "react";

export default function App() {
    const connection = useRef(new WebSocket("wss://localhost:5173/ws"))

    return (
        <div>
            <h1>WebRTC Demo</h1>
            <VideoChat connection={connection.current} />
        </div>
    );
};
