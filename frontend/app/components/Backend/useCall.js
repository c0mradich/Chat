
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
    console.error(
      `[CALL][${name || 'UNKNOWN'}] ${event}`,
      error
    );
  };

  // ==========================================
  // SIGNALING
  // ==========================================

  const emitSignal = (event, payload) => {
    debug(`OUTGOING → ${event}`, {
      socketConnected: socket?.connected,
      callId: payload.call_id,
      chatId: payload.chat_id,
      sender: payload.sender,
      target: payload.target
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
    audio: {
      echoCancellation: {
        ideal: true
      },

      noiseSuppression: {
        ideal: true
      },

      autoGainControl: {
        ideal: true
      },

      channelCount: {
        ideal: 1
      },

      sampleRate: {
        ideal: 48000
      }
    },

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
  // ICE STATS
  // ==========================================

  const logSelectedIcePair = async (pc) => {
    if (!pc || pc !== peerConnectionRef.current) return;

    try {
      const stats = await pc.getStats();

      let selectedPair = null;

      // Сначала пробуем найти выбранную пару через transport.
      stats.forEach(report => {
        if (
          report.type === 'transport' &&
          report.selectedCandidatePairId
        ) {
          const pair = stats.get(
            report.selectedCandidatePairId
          );

          if (pair) {
            selectedPair = pair;
          }
        }
      });

      // Запасной способ поиска выбранной пары.
      if (!selectedPair) {
        stats.forEach(report => {
          if (
            report.type === 'candidate-pair' &&
            report.state === 'succeeded' &&
            (report.selected || report.nominated)
          ) {
            selectedPair = report;
          }
        });
      }

      if (!selectedPair) {
        debug('NO SELECTED ICE PAIR', {
          iceState: pc.iceConnectionState,
          connectionState: pc.connectionState
        });

        return;
      }

      const local = stats.get(
        selectedPair.localCandidateId
      );

      const remote = stats.get(
        selectedPair.remoteCandidateId
      );

      debug('SELECTED ICE PAIR', {
        state: selectedPair.state,

        localType: local?.candidateType || 'unknown',
        remoteType: remote?.candidateType || 'unknown',

        localProtocol: local?.protocol || 'unknown',
        remoteProtocol: remote?.protocol || 'unknown',

        bytesSent: selectedPair.bytesSent,
        bytesReceived: selectedPair.bytesReceived
      });

    } catch (error) {
      debugError('ICE STATS FAILED', error);
    }
  };

  // ==========================================
  // LOCAL ICE SUMMARY
  // ==========================================

  const logLocalIceSummary = (pc) => {
    if (!pc || pc !== peerConnectionRef.current) return;

    const sdp = pc.localDescription?.sdp || '';

    const candidateLines = sdp
      .split(/\r?\n/)
      .filter(line => line.startsWith('a=candidate:'));

    debug('LOCAL SDP CANDIDATE SUMMARY', {
      candidateCount: candidateLines.length,

      hasHost: candidateLines.some(
        line => line.includes(' typ host')
      ),

      hasSrflx: candidateLines.some(
        line => line.includes(' typ srflx')
      ),

      hasRelay: candidateLines.some(
        line => line.includes(' typ relay')
      ),

      gatheringState: pc.iceGatheringState
    });
  };

  // ==========================================
  // CLEANUP
  // ==========================================

  const cleanupCall = (resetError = true) => {
    debug('CLEANUP CALL');

    const pc = peerConnectionRef.current;

    // Инвалидируем старое соединение.
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
      localStreamRef.current
        .getTracks()
        .forEach(track => track.stop());
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

    if (pc !== peerConnectionRef.current) return;

    const current = currentCallRef.current;

    const candidates = pendingIceCandidatesRef.current.filter(
      item => item.call_id === current?.call_id
    );

    pendingIceCandidatesRef.current = [];

    debug('Flushing ICE candidates', {
      count: candidates.length
    });

    for (const item of candidates) {
      if (pc !== peerConnectionRef.current) return;

      try {
        await pc.addIceCandidate(
          new RTCIceCandidate(item.candidate)
        );

        debug('Queued ICE candidate added', {
          type: item.candidate.candidate
            ?.match(/ typ ([a-z]+)/)?.[1] || 'unknown'
        });

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

        debug('INITIAL PEER CONNECTION CONFIG', {
      iceGatheringState: pc.iceGatheringState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState,
      transceivers: pc.getTransceivers().map(t => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection
      }))
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
        debug('ICE GATHERING COMPLETE — NULL CANDIDATE');

        logLocalIceSummary(pc);

        return;
      }

      const candidate = event.candidate.toJSON();

      const candidateType =
        candidate.candidate?.match(/ typ ([a-z]+)/)?.[1]
        || 'unknown';

      debug('LOCAL ICE CANDIDATE', {
        type: candidateType,
        protocol: event.candidate.protocol,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
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
      if (pc !== peerConnectionRef.current) return;

      debug('ICE GATHERING STATE', pc.iceGatheringState);

      if (pc.iceGatheringState === 'complete') {
        logLocalIceSummary(pc);
      }
    };

    // ------------------------------------------
    // ICE CONNECTION
    // ------------------------------------------

    pc.oniceconnectionstatechange = () => {
      if (pc !== peerConnectionRef.current) return;

      debug('ICE CONNECTION STATE CHANGED', {
        state: pc.iceConnectionState,
        connectionState: pc.connectionState,
        gatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState
      });

      if (
        pc.iceConnectionState === 'connected' ||
        pc.iceConnectionState === 'completed' ||
        pc.iceConnectionState === 'failed'
      ) {
        logSelectedIcePair(pc);
      }
    };

    // ------------------------------------------
    // SIGNALING
    // ------------------------------------------

    pc.onsignalingstatechange = () => {
      if (pc !== peerConnectionRef.current) return;

      debug('SIGNALING STATE', pc.signalingState);
    };

    // ------------------------------------------
    // PEER CONNECTION
    // ------------------------------------------

    pc.onconnectionstatechange = () => {
      if (pc !== peerConnectionRef.current) return;

      const state = pc.connectionState;

      debug('PEER CONNECTION STATE CHANGED', {
        state,
        iceState: pc.iceConnectionState,
        signalingState: pc.signalingState
      });

      if (state === 'connected') {
        debug('CALL CONNECTED SUCCESSFULLY');

        setCallStatus('connected');
        setInCall(true);

        logSelectedIcePair(pc);
      }

      if (state === 'connecting') {
        setCallStatus('connecting');
      }

      if (state === 'disconnected') {
        setCallStatus('disconnected');
      }

      if (state === 'failed') {
        setCallError('Не удалось установить соединение');
        cleanupCall(false);
      }

      if (state === 'closed') {
        debug('PEER CONNECTION CLOSED');
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
        throw new Error(
          'Отсутствует chatId, name или peerName'
        );
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

      debug('Call initialized', {
        callId,
        chatId,
        peerName
      });

      const stream = await getMicrophone();

      if (currentCallRef.current?.call_id !== callId) {
        debug('Call cancelled while waiting for microphone');

        stream.getTracks().forEach(track => track.stop());

        if (localStreamRef.current === stream) {
          localStreamRef.current = null;
          setLocalStream(null);
        }

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
        sdpLength: offer.sdp?.length
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
        throw new Error(
          'Не удалось отправить предложение звонка'
        );
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
    debug('INCOMING OFFER PROCESSING', {
      callId: data.call_id,
      chatId: data.chat_id,
      sender: data.sender
    });

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

    pendingIceCandidatesRef.current = [];

    debug('Incoming call stored', {
      callId: call.call_id,
      chatId: call.chat_id,
      peerName: call.peerName
    });

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

      debug('ANSWERING CALL', {
        callId,
        chatId: current.chat_id,
        peerName: current.peerName
      });

      setCallStatus('connecting');

      const stream = await getMicrophone();

      if (currentCallRef.current?.call_id !== callId) {
        debug('Answer cancelled while waiting for microphone');

        stream.getTracks().forEach(track => track.stop());

        if (localStreamRef.current === stream) {
          localStreamRef.current = null;
          setLocalStream(null);
        }

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
        sdpLength: answer.sdp?.length
      });

      debug('ANSWER SDP AUDIO INFO', {
  audioLine: answer.sdp
    ?.split('\r\n')
    .find(line => line.startsWith('m=audio')),
  hasIceUfrag: answer.sdp?.includes('a=ice-ufrag:'),
  hasIceOptions: answer.sdp?.includes('a=ice-options:'),
  transceivers: pc.getTransceivers().map(t => ({
    mid: t.mid,
    direction: t.direction,
    senderTrack: t.sender.track?.kind ?? null
  }))
});

      await pc.setLocalDescription(answer);

      debug('BROWSER INFO', {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  online: navigator.onLine,
  mediaDevices: !!navigator.mediaDevices,
  getUserMedia: !!navigator.mediaDevices?.getUserMedia
});

debug('TRANSCEIVER DETAILS', pc.getTransceivers().map(t => ({
  mid: t.mid,
  direction: t.direction,
  currentDirection: t.currentDirection,
  senderTrack: t.sender.track?.kind ?? null,
  senderTrackState: t.sender.track?.readyState ?? null,
  receiverTrack: t.receiver.track?.kind ?? null
})));

debug('PEER CONNECTION CONFIGURATION', {
  config: JSON.stringify(pc.getConfiguration(), null, 2),
  transceivers: JSON.stringify(
    pc.getTransceivers().map(t => ({
      mid: t.mid,
      direction: t.direction,
      currentDirection: t.currentDirection,
      senderTrack: t.sender.track?.kind ?? null,
      senderTrackState: t.sender.track?.readyState ?? null,
      receiverTrack: t.receiver.track?.kind ?? null
    })),
    null,
    2
  )
});

      debug('LOCAL DESCRIPTION AFTER SET', {
  type: pc.localDescription?.type,
  hasAudio: pc.localDescription?.sdp?.includes('m=audio'),
  candidateCount: (
    pc.localDescription?.sdp
      ?.match(/^a=candidate:/gm) || []
  ).length,
  iceGatheringState: pc.iceGatheringState
});

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
        throw new Error(
          'Не удалось отправить ответ на звонок'
        );
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

    debug('REJECTING CALL', {
      callId: current.call_id,
      peerName: current.peerName
    });

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
      debug('PROCESSING REMOTE ANSWER', {
        callId: data.call_id,
        chatId: data.chat_id,
        sender: data.sender
      });

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

      debug('TRANSCEIVERS AFTER REMOTE OFFER', 
      pc.getTransceivers().map(t => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        senderTrack: t.sender.track?.kind ?? null,
        receiverTrack: t.receiver.track?.kind ?? null
      }))
    );

    debug('ICE CONFIGURATION', {
      iceTransportPolicy: pc.getConfiguration().iceTransportPolicy ?? 'all',
      iceServers: pc.getConfiguration().iceServers.map(server => server.urls)
    });

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
    const candidate = data?.candidate;

    if (!candidate) {
      debug('ICE ignored: candidate is empty');
      return;
    }

    const current = currentCallRef.current;

    if (
      !current ||
      data.call_id !== current.call_id ||
      data.chat_id !== current.chat_id
    ) {
      debug('ICE ignored: call mismatch');
      return;
    }

    const pc = peerConnectionRef.current;

    if (!pc || !pc.remoteDescription) {
      pendingIceCandidatesRef.current.push({
        call_id: data.call_id,
        candidate
      });

      debug('ICE queued', {
        reason: !pc
          ? 'PeerConnection missing'
          : 'Remote description missing',

        queueLength: pendingIceCandidatesRef.current.length,

        type: candidate.candidate
          ?.match(/ typ ([a-z]+)/)?.[1] || 'unknown'
      });

      return;
    }

    if (pc !== peerConnectionRef.current) return;

    try {
      await pc.addIceCandidate(
        new RTCIceCandidate(candidate)
      );

      debug('REMOTE ICE CANDIDATE ADDED', {
        type: candidate.candidate
          ?.match(/ typ ([a-z]+)/)?.[1] || 'unknown'
      });

    } catch (error) {
      debugError('FAILED TO ADD REMOTE ICE', error);
    }
  };

  // ==========================================
  // END CALL
  // ==========================================

  const endCall = () => {
    const current = currentCallRef.current;

    debug('END CALL REQUESTED', {
      callId: current?.call_id,
      peerName: current?.peerName
    });

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
      debug('INCOMING ← call_offer', {
        callId: data.call_id,
        chatId: data.chat_id,
        sender: data.sender,
        target: data.target
      });

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
      debug('INCOMING ← call_answer', {
        callId: data.call_id,
        chatId: data.chat_id,
        sender: data.sender,
        target: data.target
      });

      if (data.sender === name) return;

      if (data.target && data.target !== name) return;

      handleAnswer(data);
    };

    // ------------------------------------------
    // ICE
    // ------------------------------------------

    const handleIceEvent = (data) => {
      debug('INCOMING ← call_ice_candidate', {
        callId: data.call_id,
        chatId: data.chat_id,
        sender: data.sender,
        target: data.target
      });

      if (data.sender === name) return;

      if (data.target && data.target !== name) return;

      handleIceCandidate(data);
    };

    // ------------------------------------------
    // END
    // ------------------------------------------

    const handleEndEvent = (data) => {
      debug('INCOMING ← call_end', {
        callId: data.call_id,
        sender: data.sender
      });

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
      debug('INCOMING ← call_reject', {
        callId: data.call_id,
        sender: data.sender,
        reason: data.reason
      });

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