import {useEffect, useRef} from 'react'
import PropTypes from "prop-types"

export default function Video({ id, stream }) {
    const mediaStream = useRef(stream)

    useEffect(() => {
        if (mediaStream.current) {
            mediaStream.current.srcObject = stream
            mediaStream.current.play()
        }
    }, [stream])

    return <video id={`VIDEO_${id}`}
                  ref={mediaStream}
                  autoPlay={true}
                  playsInline={true}
                  controls={false}
    />
}

Video.propTypes = {
    id: PropTypes.string,
    stream: PropTypes.object
}