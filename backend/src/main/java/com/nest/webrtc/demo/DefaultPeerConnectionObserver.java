package com.nest.webrtc.demo;

import dev.onvoid.webrtc.PeerConnectionObserver;
import dev.onvoid.webrtc.RTCDataChannel;
import dev.onvoid.webrtc.RTCIceCandidate;
import dev.onvoid.webrtc.RTCIceConnectionState;
import dev.onvoid.webrtc.RTCIceGatheringState;
import dev.onvoid.webrtc.RTCPeerConnectionIceErrorEvent;
import dev.onvoid.webrtc.RTCPeerConnectionState;
import dev.onvoid.webrtc.RTCRtpReceiver;
import dev.onvoid.webrtc.RTCRtpTransceiver;
import dev.onvoid.webrtc.RTCSignalingState;
import dev.onvoid.webrtc.media.MediaStream;

public class DefaultPeerConnectionObserver implements PeerConnectionObserver {

    @Override
    public void onSignalingChange(final RTCSignalingState state) {
        PeerConnectionObserver.super.onSignalingChange(state);
    }

    @Override
    public void onConnectionChange(final RTCPeerConnectionState state) {
        PeerConnectionObserver.super.onConnectionChange(state);
    }

    @Override
    public void onIceConnectionChange(final RTCIceConnectionState state) {
        PeerConnectionObserver.super.onIceConnectionChange(state);
    }

    @Override
    public void onStandardizedIceConnectionChange(final RTCIceConnectionState state) {
        PeerConnectionObserver.super.onStandardizedIceConnectionChange(state);
    }

    @Override
    public void onIceConnectionReceivingChange(final boolean receiving) {
        PeerConnectionObserver.super.onIceConnectionReceivingChange(receiving);
    }

    @Override
    public void onIceGatheringChange(final RTCIceGatheringState state) {
        PeerConnectionObserver.super.onIceGatheringChange(state);
    }

    @Override
    public void onIceCandidate(final RTCIceCandidate rtcIceCandidate) {

    }

    @Override
    public void onIceCandidateError(final RTCPeerConnectionIceErrorEvent event) {
        PeerConnectionObserver.super.onIceCandidateError(event);
    }

    @Override
    public void onIceCandidatesRemoved(final RTCIceCandidate[] candidates) {
        PeerConnectionObserver.super.onIceCandidatesRemoved(candidates);
    }

    @Override
    public void onAddStream(final MediaStream stream) {
        PeerConnectionObserver.super.onAddStream(stream);
    }

    @Override
    public void onRemoveStream(final MediaStream stream) {
        PeerConnectionObserver.super.onRemoveStream(stream);
    }

    @Override
    public void onDataChannel(final RTCDataChannel dataChannel) {
        PeerConnectionObserver.super.onDataChannel(dataChannel);
    }

    @Override
    public void onRenegotiationNeeded() {
        PeerConnectionObserver.super.onRenegotiationNeeded();
    }

    @Override
    public void onAddTrack(final RTCRtpReceiver receiver, final MediaStream[] mediaStreams) {
        PeerConnectionObserver.super.onAddTrack(receiver, mediaStreams);
    }

    @Override
    public void onRemoveTrack(final RTCRtpReceiver receiver) {
        PeerConnectionObserver.super.onRemoveTrack(receiver);
    }

    @Override
    public void onTrack(final RTCRtpTransceiver transceiver) {
        PeerConnectionObserver.super.onTrack(transceiver);
    }

}
