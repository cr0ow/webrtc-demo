import { useEffect, useRef } from 'react';

export default function Video({ id, stream }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        }
    }, [stream]);

    return <video id={id} ref={videoRef} autoPlay muted />;
};
