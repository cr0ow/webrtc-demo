import { useEffect, useRef } from 'react';
import PropTypes from "prop-types";

export default function Video({ id, stream }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        }
    }, [stream]);

    return <video
        id={id}
        ref={videoRef}
        autoPlay
        controls={false}
    />;
};

Video.propTypes = {
    id: PropTypes.string,
    stream: PropTypes.object
}
