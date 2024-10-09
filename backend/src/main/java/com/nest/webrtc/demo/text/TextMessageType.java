package com.nest.webrtc.demo.text;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor(staticName = "of")
public enum TextMessageType {
    CONNECT("connect"),
    GET_PEERS("getPeers"),
    ICE("ice"),
    CONSUME("consume"),
    CONSUMER_ICE("consumer_ice");

    private final String value;

}
