import { useEffect, useRef } from 'react'
import PropTypes from "prop-types"

export default function Video({ id, stream }) {
    const videoRef = useRef(null)

    useEffect(() => {
        const handlePlay = () => {
            videoRef.current.srcObject = stream
            videoRef.current.autoplay = true
            videoRef.current.controls = false
            videoRef.current.play()
        }
        //
        // document.addEventListener('click', handlePlay, { once: true })
        //
        // return () => document.removeEventListener('click', handlePlay)

        handlePlay()
    }, [stream])

    return <video id={id} ref={videoRef}/>
}

Video.propTypes = {
    id: PropTypes.string,
    stream: PropTypes.object
}