
import { useEffect, useRef, useState, useCallback } from 'react';

const DEBUG_CALLS = true;

export function useCall(socket, chatId, name, peerName) {
  // ==========================================
  // REFS
  // ==========================================

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const pendingIceCandidatesRef = useRef([]);
  const currentCallRef = useRef(null);
  const incomingOfferRef = useRef(null);

  // ==========================================
  // STATE
  // ==========================================

  const [callStream, setCallStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);

  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');

  const [incomingCall, setIncomingCall] = useState(null);
  const [callError, setCallError] = useState(null);

  // ==========================================
  // DEBUG
  // ==========================================

  const debug = (event, data = null) => {
    if (!DEBUG_CALLS) return;

    const prefix = `[CALL][${name || 'UNKNOWN'}]`;

    if (data !== null) {
      console.log(prefix, event, data);
    } else {
      console.log(prefix, event);
    }
  };

  const debugError = (event, error) => {
    console.error(`[CALL][${name || 'UNKNOWN'}] ${event}`, error);
  };

  // ==========================================
  // SIGNALING
  // ==========================================

  const emitSignal = (event, payload) => {
    debug(`OUTGOING → ${event}`, {
      socketConnected: socket?.connected,
      payload
    });

    if (!socket?.connected) {
      debugError(`${event}: Socket disconnected`);
      return false;
    }

    socket.emit(event, payload);
    return true;
  };

  // ==========================================
  // CURRENT CALL VALIDATION
  // ==========================================

  const isCurrentCall = useCallback((data) => {
    const current = currentCallRef.current;

    return Boolean(
      current &&
      data.call_id === current.call_id &&
      data.chat_id === current.chat_id
    );
  }, []);

  // ==========================================
  // MICROPHONE
  // ==========================================

  const getMicrophone = async () => {
    debug('Requesting microphone access');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      debug('Microphone access granted', {
        streamId: stream.id,
        tracks: stream.getTracks().map(track => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState
        }))
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      return stream;

    } catch (error) {
      debugError('Microphone access failed', error);
      throw error;
    }
  };

  // ==========================================
  // CLEANUP
  // ==========================================

  const cleanupCall = (resetError = true) => {
    debug('CLEANUP CALL');

    const pc = peerConnectionRef.current;

    // Сначала инвалидируем старое соединение.
    peerConnectionRef.current = null;

    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onicegatheringstatechange = null;
      pc.onsignalingstatechange = null;

      pc.close();
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
    }

    localStreamRef.current = null;

    pendingIceCandidatesRef.current = [];
    currentCallRef.current = null;
    incomingOfferRef.current = null;

    setLocalStream(null);
    setCallStream(null);
    setIncomingCall(null);

    setInCall(false);
    setCallStatus('idle');

    if (resetError) {
      setCallError(null);
    }
  };

  // ==========================================
  // ICE CANDIDATES QUEUE
  // ==========================================

  const flushIceCandidates = async (pc) => {
    if (!pc.remoteDescription) {
      debug('Cannot flush ICE: remote description missing');
      return;
    }

    debug('Flushing ICE candidates', {
      count: pendingIceCandidatesRef.current.length
    });

    while (pendingIceCandidatesRef.current.length > 0) {
      if (pc !== peerConnectionRef.current) return;

      const candidate = pendingIceCandidatesRef.current.shift();

      try {
        await pc.addIceCandidate(
          new RTCIceCandidate(candidate)
        );

        if (pc !== peerConnectionRef.current) return;

        debug('Queued ICE candidate added');

      } catch (error) {
        debugError('Queued ICE candidate failed', error);
      }
    }
  };

  // ==========================================
  // CREATE PEER CONNECTION
  // ==========================================

  const createPeerConnection = (call) => {
    debug('Creating RTCPeerConnection', {
      callId: call.call_id,
      chatId: call.chat_id,
      peerName: call.peerName
    });

    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        }
      ]
    });

    peerConnectionRef.current = pc;

    // ------------------------------------------
    // REMOTE TRACK
    // ------------------------------------------

    pc.ontrack = (event) => {
      if (pc !== peerConnectionRef.current) return;

      debug('REMOTE TRACK RECEIVED', {
        streams: event.streams.map(stream => stream.id),
        track: {
          kind: event.track.kind,
          enabled: event.track.enabled,
          readyState: event.track.readyState
        }
      });

      const [remoteStream] = event.streams;

      if (remoteStream) {
        setCallStream(remoteStream);
      }
    };

    // ------------------------------------------
    // LOCAL ICE CANDIDATE
    // ------------------------------------------

    pc.onicecandidate = (event) => {
      if (pc !== peerConnectionRef.current) return;

      if (!event.candidate) {
        debug('ICE gathering finished');
        return;
      }

      const candidate = event.candidate.toJSON();

      debug('NEW LOCAL ICE CANDIDATE', {
        candidate,
        type: candidate.candidate?.match(/typ ([a-z]+)/)?.[1]
      });

      const current = currentCallRef.current;

      if (!current) {
        debug('ICE ignored: no active call');
        return;
      }

      emitSignal('call_ice_candidate', {
        call_id: current.call_id,
        chat_id: current.chat_id,
        sender: name,
        target: current.peerName,
        candidate
      });
    };

    // ------------------------------------------
    // ICE GATHERING
    // ------------------------------------------

    pc.onicegatheringstatechange = () => {
      debug('ICE gathering state:', pc.iceGatheringState);
    };

    // ------------------------------------------
    // ICE CONNECTION
    // ------------------------------------------

    pc.oniceconnectionstatechange = () => {
      debug('ICE connection state:', pc.iceConnectionState);
    };

    // ------------------------------------------
    // SIGNALING
    // ------------------------------------------

    pc.onsignalingstatechange = () => {
      debug('Signaling state:', pc.signalingState);
    };

    // ------------------------------------------
    // CONNECTION
    // ------------------------------------------

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;

      debug('Connection state:', state);

      if (pc !== peerConnectionRef.current) return;

      if (state === 'connected') {
        debug('CALL CONNECTED SUCCESSFULLY');

        setCallStatus('connected');
        setInCall(true);
      }

      if (state === 'connecting') {
        setCallStatus('connecting');
      }

      if (state === 'disconnected') {
        debug('Connection temporarily disconnected');
        setCallStatus('disconnected');
      }

      if (state === 'failed') {
        debugError('CONNECTION FAILED');

        setCallError('Не удалось установить соединение');
        cleanupCall(false);
        return;
      }

      if (state === 'closed') {
        setInCall(false);
      }
    };

    return pc;
  };

  // ==========================================
  // START CALL
  // ==========================================

  const startCall = async () => {
    let callId = null;

    try {
      debug('START CALL REQUESTED', {
        socketConnected: socket?.connected,
        chatId,
        name,
        peerName
      });

      if (!socket?.connected) {
        throw new Error('Socket не подключён');
      }

      if (chatId == null || !name || !peerName) {
        throw new Error('Отсутствует chatId, name или peerName');
      }

      if (currentCallRef.current) {
        throw new Error('Звонок уже существует');
      }

      callId = crypto.randomUUID();

      const call = {
        call_id: callId,
        chat_id: chatId,
        role: 'caller',
        peerName
      };

      currentCallRef.current = call;

      setCallStatus('calling');
      setCallError(null);

      debug('Call initialized', call);

      const stream = await getMicrophone();

      if (currentCallRef.current?.call_id !== callId) {
        debug('Call cancelled while waiting for microphone');

        stream.getTracks().forEach(track => track.stop());

        return;
      }

      const pc = createPeerConnection(call);

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      debug('Creating offer');

      const offer = await pc.createOffer();

      if (pc !== peerConnectionRef.current) return;

      debug('Offer created', {
        type: offer.type,
        sdpLength: offer.sdp?.length,
        offer
      });

      await pc.setLocalDescription(offer);

      if (pc !== peerConnectionRef.current) return;

      debug('Local description set');

      const sent = emitSignal('call_offer', {
        call_id: callId,
        chat_id: chatId,
        sender: name,
        target: peerName,
        offer: pc.localDescription.toJSON()
      });

      if (!sent) {
        throw new Error('Не удалось отправить предложение звонка');
      }

      debug('OFFER SENT');

    } catch (error) {
      debugError('START CALL FAILED', error);

      setCallError(error.message);

      if (
        !callId ||
        currentCallRef.current?.call_id === callId
      ) {
        cleanupCall(false);
      }
    }
  };

  // ==========================================
  // RECEIVE INCOMING CALL
  // ==========================================

  const receiveCall = (data) => {
    debug('INCOMING OFFER PROCESSING', data);

    if (currentCallRef.current) {
      debug('Incoming call rejected: already busy');

      emitSignal('call_reject', {
        call_id: data.call_id,
        chat_id: data.chat_id,
        sender: name,
        target: data.sender,
        reason: 'busy'
      });

      return;
    }

    const call = {
      call_id: data.call_id,
      chat_id: data.chat_id,
      role: 'callee',
      peerName: data.sender
    };

    currentCallRef.current = call;
    incomingOfferRef.current = data.offer;

    debug('Incoming call stored', call);

    setIncomingCall({
      call_id: data.call_id,
      sender: data.sender,
      chat_id: data.chat_id
    });

    setCallStatus('ringing');
  };

  // ==========================================
  // ANSWER CALL
  // ==========================================

  const answerCall = async () => {
    let callId = null;

    try {
      const current = currentCallRef.current;
      const offer = incomingOfferRef.current;

      if (!current || !offer || current.role !== 'callee') {
        throw new Error('Нет входящего звонка');
      }

      callId = current.call_id;

      debug('ANSWERING CALL', current);

      setCallStatus('connecting');

      const stream = await getMicrophone();

      if (currentCallRef.current?.call_id !== callId) {
        debug('Answer cancelled while waiting for microphone');

        stream.getTracks().forEach(track => track.stop());

        return;
      }

      const pc = createPeerConnection(current);

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      debug('Setting remote offer');

      await pc.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      if (pc !== peerConnectionRef.current) return;

      debug('Remote offer successfully set');

      await flushIceCandidates(pc);

      if (pc !== peerConnectionRef.current) return;

      debug('Creating answer');

      const answer = await pc.createAnswer();

      if (pc !== peerConnectionRef.current) return;

      debug('Answer created', {
        type: answer.type,
        sdpLength: answer.sdp?.length,
        answer
      });

      await pc.setLocalDescription(answer);

      if (pc !== peerConnectionRef.current) return;

      debug('Local answer set');

      const sent = emitSignal('call_answer', {
        call_id: current.call_id,
        chat_id: current.chat_id,
        sender: name,
        target: current.peerName,
        answer: pc.localDescription.toJSON()
      });

      if (!sent) {
        throw new Error('Не удалось отправить ответ на звонок');
      }

      setIncomingCall(null);

      debug('ANSWER SENT');

    } catch (error) {
      debugError('ANSWER FAILED', error);

      setCallError(error.message);

      if (
        !callId ||
        currentCallRef.current?.call_id === callId
      ) {
        cleanupCall(false);
      }
    }
  };

  // ==========================================
  // REJECT CALL
  // ==========================================

  const rejectCall = () => {
    const current = currentCallRef.current;

    if (!current) return;

    debug('REJECTING CALL', current);

    emitSignal('call_reject', {
      call_id: current.call_id,
      chat_id: current.chat_id,
      sender: name,
      target: current.peerName,
      reason: 'rejected'
    });

    cleanupCall();
  };

  // ==========================================
  // HANDLE ANSWER
  // ==========================================

  const handleAnswer = async (data) => {
    try {
      debug('PROCESSING REMOTE ANSWER', data);

      if (!isCurrentCall(data)) {
        debug('Answer ignored: call_id/chat_id mismatch');
        return;
      }

      const pc = peerConnectionRef.current;

      if (!pc) {
        debug('Answer ignored: PeerConnection missing');
        return;
      }

      await pc.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );

      if (pc !== peerConnectionRef.current) return;

      debug('REMOTE ANSWER SET');

      await flushIceCandidates(pc);

      if (pc !== peerConnectionRef.current) return;

      setCallStatus('connecting');

    } catch (error) {
      debugError('ANSWER HANDLING FAILED', error);
    }
  };

  // ==========================================
  // HANDLE REMOTE ICE
  // ==========================================

  const handleIceCandidate = async (data) => {
    debug('PROCESSING REMOTE ICE', data);

    if (!isCurrentCall(data)) {
      debug('ICE ignored: call_id/chat_id mismatch', {
        received: {
          call_id: data.call_id,
          chat_id: data.chat_id
        },
        current: currentCallRef.current
      });

      return;
    }

    const pc = peerConnectionRef.current;

    if (!pc || !pc.remoteDescription) {
      debug('ICE queued: remote description not ready');

      pendingIceCandidatesRef.current.push(data.candidate);

      return;
    }

    try {
      await pc.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );

      if (pc !== peerConnectionRef.current) return;

      debug('REMOTE ICE SUCCESSFULLY ADDED');

    } catch (error) {
      debugError('REMOTE ICE FAILED', error);
    }
  };

  // ==========================================
  // END CALL
  // ==========================================

  const endCall = () => {
    const current = currentCallRef.current;

    debug('END CALL REQUESTED', current);

    if (current) {
      emitSignal('call_end', {
        call_id: current.call_id,
        chat_id: current.chat_id,
        sender: name,
        target: current.peerName
      });
    }

    cleanupCall();
  };

  // ==========================================
  // SOCKET.IO LISTENERS
  // ==========================================

  useEffect(() => {
    if (!socket) return;

    debug('Registering Socket.IO listeners', {
      chatId,
      name,
      socketConnected: socket.connected
    });

    // ------------------------------------------
    // OFFER
    // ------------------------------------------

    const handleOfferEvent = (data) => {
      debug('INCOMING ← call_offer', data);

      if (data.sender === name) {
        debug('Offer ignored: own event');
        return;
      }

      if (data.target && data.target !== name) {
        debug('Offer ignored: wrong target');
        return;
      }

      if (data.chat_id !== chatId) {
        debug('Offer ignored: wrong chat', {
          received: data.chat_id,
          expected: chatId
        });
        return;
      }

      receiveCall(data);
    };

    // ------------------------------------------
    // ANSWER
    // ------------------------------------------

    const handleAnswerEvent = (data) => {
      debug('INCOMING ← call_answer', data);

      if (data.sender === name) return;

      if (data.target && data.target !== name) return;

      handleAnswer(data);
    };

    // ------------------------------------------
    // ICE
    // ------------------------------------------

    const handleIceEvent = (data) => {
      debug('INCOMING ← call_ice_candidate', data);

      if (data.sender === name) return;

      if (data.target && data.target !== name) return;

      handleIceCandidate(data);
    };

    // ------------------------------------------
    // END
    // ------------------------------------------

    const handleEndEvent = (data) => {
      debug('INCOMING ← call_end', data);

      if (data.sender === name) return;

      if (data.target && data.target !== name) return;

      if (!isCurrentCall(data)) return;

      debug('REMOTE CLIENT ENDED CALL');

      cleanupCall();
    };

    // ------------------------------------------
    // REJECT
    // ------------------------------------------

    const handleRejectEvent = (data) => {
      debug('INCOMING ← call_reject', data);

      if (data.sender === name) return;

      if (data.target && data.target !== name) return;

      if (!isCurrentCall(data)) return;

      debug('REMOTE CLIENT REJECTED CALL', data.reason);

      setCallError(
        data.reason === 'busy'
          ? 'Пользователь занят'
          : 'Звонок отклонён'
      );

      cleanupCall(false);
    };

    socket.on('call_offer', handleOfferEvent);
    socket.on('call_answer', handleAnswerEvent);
    socket.on('call_ice_candidate', handleIceEvent);
    socket.on('call_end', handleEndEvent);
    socket.on('call_reject', handleRejectEvent);

    return () => {
      debug('Removing Socket.IO listeners');

      socket.off('call_offer', handleOfferEvent);
      socket.off('call_answer', handleAnswerEvent);
      socket.off('call_ice_candidate', handleIceEvent);
      socket.off('call_end', handleEndEvent);
      socket.off('call_reject', handleRejectEvent);
    };

  }, [socket, chatId, name, isCurrentCall]);

  // ==========================================
  // RETURN
  // ==========================================

  return {
    startCall,
    answerCall,
    rejectCall,
    endCall,

    callStream,
    localStream,

    inCall,
    callStatus,
    incomingCall,
    callError
  };
}