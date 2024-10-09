package com.nest.webrtc.demo;

import dev.onvoid.webrtc.PeerConnectionFactory;
import dev.onvoid.webrtc.RTCConfiguration;
import dev.onvoid.webrtc.RTCIceCandidate;
import dev.onvoid.webrtc.RTCPeerConnection;
import lombok.extern.log4j.Log4j2;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nest.webrtc.demo.request.GetPeersRequest;
import com.nest.webrtc.demo.request.IceRequest;
import com.nest.webrtc.demo.text.SocketTextMessage;
import com.nest.webrtc.demo.text.TextMessageType;

/*
*
* Handler obsługuje 2 rodzaje wiadomości:
* 1) TextMessage   - Służy do wysyłania komunikatów kontronych
* 2) BinaryMessage - Za jej pomocą przesyłany jest strumień audio/video
*
*/

@Log4j2
public class CallsSocketHandler extends AbstractWebSocketHandler {

    private final List<WebSocketSession> webSocketSessions = Collections.synchronizedList(new ArrayList<>());
    private final Map<String, RTCPeerConnection> peerConnections = Collections.synchronizedMap(new HashMap<>());
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final PeerConnectionFactory peerConnectionFactory = new PeerConnectionFactory();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("New connection, remote address: {}, sessionId: {}", session.getRemoteAddress(), session.getId());

        // Zapisz sesje klienta po dołączeniu, ale nie twórz jeszcze dla niego PeerConnection
        webSocketSessions.add(session);

        // Odeślij klientowi ID, po którym będzie rozpoznawany na serwerze
        session.sendMessage(new TextMessage(objectMapper.writeValueAsBytes(session.getId())));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage textMessage) throws Exception {
        log.info("New text message from: {}, content: {}", session.getId(), textMessage.getPayload());

        //Sparsuj JSONa na obiekt
        var message = objectMapper.readValue(textMessage.getPayload(), SocketTextMessage.class);
        handleEvent(message);
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage binaryMessage) throws Exception {
        log.info("New binary message from: {}, length in bytes: {}", session.getId(), binaryMessage.getPayloadLength());

        //Prześlij wiadomość do wszystkich połączonych klientów poza tym, który wysłał wiadomość
        for (var webSocketSession : webSocketSessions) {
            if (session == webSocketSession) {
                continue;
            }
            webSocketSession.sendMessage(binaryMessage);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("Connection with {} closed, reason: {}", session.getId(), status.getReason());

        // Usuń sesje klienta po rozłączeniu
        webSocketSessions.remove(session);
    }

    private void handleEvent(SocketTextMessage message) {
        try {
            var messageType = TextMessageType.of(message.type());
            switch(messageType) {
                case CONNECT -> handleConnect(message);
                case GET_PEERS -> handleGetPeers(message);
                case ICE -> handleIce(message);
                case CONSUME -> handleConsume(message);
                case CONSUMER_ICE -> handleConsumerIce(message);
            }
        } catch(Exception exception) {
            log.error(exception.getMessage());
        }
    }

    private void handleConnect(SocketTextMessage message) throws Exception {
        var request = objectMapper.readValue(message.jsonContent(), GetPeersRequest.class);
        peerConnections.put(request.id(), peerConnectionFactory.createPeerConnection(new RTCConfiguration(), new DefaultPeerConnectionObserver()));
    }

    // Klient pyta o pozostałych uczestników rozmowy
    private void handleGetPeers(SocketTextMessage message) throws Exception {
        var id = objectMapper.readValue(message.jsonContent(), GetPeersRequest.class).id();
        var peers = new ArrayList<>();
        peerConnections.forEach((key, value) -> {
            if(!key.equals(id) && peerConnections.containsKey(key)) {
                peers.add(peerConnections.get(key));
            }
        });
        var session = getWebSocketSession(id);
        session.sendMessage(new TextMessage(objectMapper.writeValueAsBytes(peers)));
    }

    // Klient wysyła swój ICE candidate
    private void handleIce(SocketTextMessage message) throws Exception {
        var request = objectMapper.readValue(message.jsonContent(), IceRequest.class);
        var peerConnection = peerConnections.get(request.id());
        var iceCandidate = request.iceCandidate();
        peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate.sdpMid,
                                                           iceCandidate.sdpMLineIndex,
                                                           iceCandidate.sdp,
                                                           iceCandidate.serverUrl));
    }

    private void handleConsume(SocketTextMessage message) {}

    private void handleConsumerIce(SocketTextMessage message) {}

    private WebSocketSession getWebSocketSession(String id) {
        return webSocketSessions.stream()
            .filter(session -> session.getId().equals(id))
            .findFirst()
            .orElseThrow();
    }

}
