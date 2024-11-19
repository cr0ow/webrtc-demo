import {useEffect, useState} from 'react'
import PropTypes from "prop-types"

export default function Video({ id }) {
    const [mediaStream, setMediaStream] = useState(null)

    useEffect(() => {
        const stream = document.getElementById(id).srcObject
        if(stream) {
            setMediaStream(stream)
        }
    }, [])

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