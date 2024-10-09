import {useState} from 'react'

export default function App() {
    const [username, setUsername] = useState('')
    const [localStream, setLocalStream] = useState(null)
    const [remoteStreams, setRemoteStreams] = useState([])

    const handleConnect = () => {
        console.log("Zainicjalizowano połączenie")

        //ustaw imię użytkownika
        document.getElementById("username").innerText = username

        //uzyskaj dostęp do urządzeń audio i wideo
        navigator.mediaDevices.getUserMedia({
            'video': true,
            'audio': true
        }).then(stream => {
            console.log('Utworzony MediaStream:', stream)
            setLocalStream(stream)
            //przypisz lokalny stream do elementu <video>
            document.getElementById("localStream").srcObject = stream
        }).catch(error => {
            console.error('Błąd dostępu do mikrofonu i kamery', error)
        })

    }

    return (
        <>
            <h1>WebRTC demo</h1>
            <input
                type={"text"}
                placeholder={"Wpisz imię..."}
                onChange={e => setUsername(e.target.value)}
            />
            <button onClick={handleConnect}>Połącz</button>
            <br/>
            <div className={"video-holder"}>
                <div id={"username"}></div>
                <video
                    id={"localStream"}
                    autoPlay
                    playsInline
                    controls={false}
                    //proporcje 16:9
                    width={"320px"}
                    height={"180px"}
                />
            </div>
            {remoteStreams.map((remoteStream, index) => (
                <div className={"video-holder"}>
                    <div id={"username-" + index}></div>
                    <video
                        src={remoteStream}
                        autoPlay
                        playsInline
                        controls={false}
                        width={"320px"}
                        height={"180px"}
                    />
                </div>
            ))}
        </>
    )
}