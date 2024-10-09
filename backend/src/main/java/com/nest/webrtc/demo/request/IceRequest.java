package com.nest.webrtc.demo.request;

import dev.onvoid.webrtc.RTCIceCandidate;

public record IceRequest (
    String id,
    RTCIceCandidate iceCandidate
) {}
