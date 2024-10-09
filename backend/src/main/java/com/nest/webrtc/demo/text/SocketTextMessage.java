package com.nest.webrtc.demo.text;

public record SocketTextMessage(
    String type,
    String jsonContent
) {}
