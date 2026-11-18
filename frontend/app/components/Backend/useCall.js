import { useEffect, useRef, useState, useCallback } from 'react';

const DEBUG_CALLS = true;

export function useCall(socket, chatId, name, peerName) {
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const pendingIceCandidatesRef = useRef([]);
  const currentCallRef = useRef(null);
  const incomingOfferRef = useRef(null);

  const [callStream, setCallStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);

  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');

  const [incomingCall, setIncomingCall] = useState(null);
  const [callError, setCallError] = useState(null);

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

  const isCurrentCall = useCallback((data) => {
    const current = currentCallRef.current;

    return Boolean(
      current &&
      data.call_id === current.call_id &&
      data.chat_id === current.chat_id
    );
  }, []);

  const getMicrophone = async () => {
    debug('Requesting microphone access');

    try {

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: {ideal: true},
      noiseSuppression: {ideal: true},
      autoGainControl: {ideal: true},
      channelCount: {ideal: 1},
      sampleRate: {ideal: 48000}
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

const cleanupCall = (resetError = true) => {
  const pc = peerConnectionRef.current;

  peerConnectionRef.current = null;

  if (pc) {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.close();
  }

  localStreamRef.current
    ?.getTracks()
    .forEach(track => track.stop());

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

const flushIceCandidates = async pc => {
  if (
    !pc.remoteDescription ||
    pc !== peerConnectionRef.current
  ) {
    return;
  }

  const callId = currentCallRef.current?.call_id;

  const candidates =
    pendingIceCandidatesRef.current.filter(
      item => item.call_id === callId
    );

  pendingIceCandidatesRef.current = [];

  for (const { candidate } of candidates) {
    if (pc !== peerConnectionRef.current) return;

    try {
      await pc.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch {}
  }
};

const createPeerConnection = call => {
  const pc = new RTCPeerConnection({
    iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});

  peerConnectionRef.current = pc;

  pc.ontrack = event => {
    if (pc !== peerConnectionRef.current) return;

    const [remoteStream] = event.streams;

    if (remoteStream) {
      setCallStream(remoteStream);
    }
  };

  pc.onicecandidate = event => {
    if (pc !== peerConnectionRef.current) return;
    if (!event.candidate) return;
    const current = currentCallRef.current;
    if (!current) return;

    emitSignal('call_ice_candidate', {
      call_id: current.call_id,
      chat_id: current.chat_id,
      sender: name,
      target: current.peerName,
      candidate: event.candidate.toJSON()
    });
  };

  pc.onconnectionstatechange = () => {
    if (pc !== peerConnectionRef.current) return;

    switch (pc.connectionState) {
      case 'connected':
        setCallStatus('connected');
        setInCall(true);
        break;

      case 'connecting':
        setCallStatus('connecting');
        break;

      case 'disconnected':
        setCallStatus('disconnected');
        break;

      case 'failed':
        setCallError('Не удалось установить соединение');
        cleanupCall(false);
        break;

      default:
        break;
    }
  };

  return pc;
};

const startCall = async () => {
  let callId = null;

  try {
    if (!socket?.connected) {
      throw new Error('Socket не подключён');
    }

    if (!chatId || !name || !peerName) {
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

    const stream = await getMicrophone();

    if (currentCallRef.current?.call_id !== callId) {
      stream.getTracks().forEach(track => track.stop());
      if (localStreamRef.current === stream) {
        localStreamRef.current = null;
        setLocalStream(null);
      }
      return;
    }

    const pc = createPeerConnection(call);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    if (pc !== peerConnectionRef.current) return;
    await pc.setLocalDescription(offer);
    if (pc !== peerConnectionRef.current) return;

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
  } catch (error) {
    setCallError(error.message);

    if (
      !callId ||
      currentCallRef.current?.call_id === callId
    ) {
      cleanupCall(false);
    }
  }
};

const receiveCall = data => {
  if (currentCallRef.current) {
    emitSignal('call_reject', {
      call_id: data.call_id,
      chat_id: data.chat_id,
      sender: name,
      target: data.sender,
      reason: 'busy'
    });
    return;
  }

  currentCallRef.current = {
    call_id: data.call_id,
    chat_id: data.chat_id,
    role: 'callee',
    peerName: data.sender
  };

  incomingOfferRef.current = data.offer;
  pendingIceCandidatesRef.current = [];

  setIncomingCall({
    call_id: data.call_id,
    sender: data.sender,
    chat_id: data.chat_id
  });
  setCallStatus('ringing');
};

const answerCall = async () => {
  let callId = null;
  try {
    const current = currentCallRef.current;
    const offer = incomingOfferRef.current;
    if (!current || !offer || current.role !== 'callee') {throw new Error('Нет входящего звонка');}

    callId = current.call_id;
    setCallStatus('connecting');

    const stream = await getMicrophone();

    if (currentCallRef.current?.call_id !== callId) {
      stream.getTracks().forEach(track => track.stop());

      if (localStreamRef.current === stream) {
        localStreamRef.current = null;
        setLocalStream(null);
      }
      return;
    }
    const pc = createPeerConnection(current);

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    await pc.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    if (pc !== peerConnectionRef.current) return;

    await flushIceCandidates(pc);

    if (pc !== peerConnectionRef.current) return;

    const answer = await pc.createAnswer();

    if (pc !== peerConnectionRef.current) return;

    await pc.setLocalDescription(answer);

    if (pc !== peerConnectionRef.current) return;

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
  } catch (error) {
    setCallError(error.message);

    if (
      !callId ||
      currentCallRef.current?.call_id === callId
    ) {
      cleanupCall(false);
    }
  }
};

const rejectCall = () => {
  const current = currentCallRef.current;
  if (!current) return;

  emitSignal('call_reject', {
    call_id: current.call_id,
    chat_id: current.chat_id,
    sender: name,
    target: current.peerName,
    reason: 'rejected'
  });
  cleanupCall();
};

const handleAnswer = async data => {
  try {
    if (!isCurrentCall(data)) return;

    const pc = peerConnectionRef.current;

    if (!pc) return;

    await pc.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );

    if (pc !== peerConnectionRef.current) return;

    await flushIceCandidates(pc);

    if (pc !== peerConnectionRef.current) return;

    setCallStatus('connecting');
  } catch {}
};

const handleIceCandidate = async data => {
  const candidate = data?.candidate;
  if (!candidate) return;
  const current = currentCallRef.current;

  if (!current ||data.call_id !== current.call_id ||data.chat_id !== current.chat_id) {return;}

  const pc = peerConnectionRef.current;

  if (!pc || !pc.remoteDescription) {
    pendingIceCandidatesRef.current.push({
      call_id: data.call_id,
      candidate
    });
    return;
  }

  if (pc !== peerConnectionRef.current) return;

  try {
    await pc.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  } catch {}
};

const endCall = () => {
  const current = currentCallRef.current;

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

  useEffect(() => {
  if (!socket) return;

  const handleOfferEvent = (data) => {
    if (
      data.sender === name ||
      (data.target && data.target !== name) ||
      data.chat_id !== chatId
    ) {
      return;
    }
    receiveCall(data);
  };

  const handleAnswerEvent = (data) => {
    if (
      data.sender === name ||
      (data.target && data.target !== name)
    ) {
      return;
    }
    handleAnswer(data);
  };

  const handleIceEvent = (data) => {
    if (
      data.sender === name ||
      (data.target && data.target !== name)
    ) {
      return;
    }
    handleIceCandidate(data);
  };

  const handleEndEvent = (data) => {
    if (
      data.sender === name ||
      (data.target && data.target !== name) ||
      !isCurrentCall(data)
    ) {
      return;
    }
    cleanupCall();
  };

  const handleRejectEvent = (data) => {
    if (
      data.sender === name ||
      (data.target && data.target !== name) ||
      !isCurrentCall(data)
    ) {
      return;
    }

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
    socket.off('call_offer', handleOfferEvent);
    socket.off('call_answer', handleAnswerEvent);
    socket.off('call_ice_candidate', handleIceEvent);
    socket.off('call_end', handleEndEvent);
    socket.off('call_reject', handleRejectEvent);
  };
}, [socket, chatId, name, isCurrentCall]);

   return {startCall,answerCall,rejectCall,endCall,callStream,localStream,inCall,callStatus,incomingCall,callError};
}