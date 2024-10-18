import VideoChat from './components/VideoChat.jsx';
import {useState} from "react";

export default function App() {
    const [connection, setConnection] = useState({})
    const [localUUID, setLocalUUID] = useState(null)

    return (
        <div>
            <h1>Video Chat Application</h1>
            <VideoChat connection={connection} setConnection={setConnection} localUUID={localUUID} setLocalUUID={setLocalUUID} />
        </div>
    );
};
