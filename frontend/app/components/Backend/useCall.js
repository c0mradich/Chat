import { useEffect, useRef, useState } from 'react';

export function useCall(socket, chatId, name) {
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const [callStream, setCallStream] = useState(null);
  const [inCall, setInCall] = useState(false);
  const pendingIceCandidatesRef = useRef([]);

  // --------------------------------
  // Создание WebRTC соединения
  // --------------------------------
  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        }
      ]
    });

    // Получили аудио от собеседника
    peerConnection.ontrack = (event) => {
      console.log('[CALL] Remote track received');

      const [remoteStream] = event.streams;

      if (remoteStream) {
        console.log('[CALL] Remote stream received');
        setCallStream(remoteStream);
      }
    };

    // Отправляем ICE-кандидата собеседнику
    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;

      console.log('[CALL] Sending ICE candidate');

      socket.emit('call_ice_candidate', {
        chat_id: chatId,
        sender: name,
        candidate: event.candidate
      });
    };

    // Для отладки состояния соединения
    peerConnection.onconnectionstatechange = () => {
      console.log(
        '[CALL] Connection state:',
        peerConnection.connectionState
      );
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(
        '[CALL] ICE connection state:',
        peerConnection.iceConnectionState
      );
    };

    peerConnectionRef.current = peerConnection;

    return peerConnection;
  };

  // --------------------------------
  // Начать звонок
  // --------------------------------
  const startCall = async () => {
    try {
      if (!socket) {
        console.error('[CALL] Socket is not connected');
        return;
      }

      if (!chatId) {
        console.error('[CALL] chatId is missing');
        return;
      }

      console.log('[CALL] Starting call');

      // Получаем микрофон
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      console.log('[CALL] Microphone access granted');

      localStreamRef.current = stream;

      // Создаём WebRTC соединение
      const peerConnection = createPeerConnection();

      // Добавляем микрофон в WebRTC
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      console.log('[CALL] Audio track added');

      // Создаём offer
      const offer = await peerConnection.createOffer();

      console.log('[CALL] Offer created');

      // Устанавливаем собственное описание
      await peerConnection.setLocalDescription(offer);

      console.log('[CALL] Local description set');

      // Отправляем offer через Socket.IO
      socket.emit('call_offer', {
        chat_id: chatId,
        sender: name,
        offer: offer
      });

      console.log('[CALL] Offer sent');

      setInCall(true);

    } catch (error) {
      console.error('[CALL] Error while starting call:', error);
    }
  };

  // --------------------------------
  // Ответить на звонок
  // --------------------------------
  const answerCall = async (offer) => {
    try {
      if (!socket) {
        console.error('[CALL] Socket is not connected');
        return;
      }

      console.log('[CALL] Answering call');

      // Получаем микрофон
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      console.log('[CALL] Microphone access granted');

      localStreamRef.current = stream;

      // Создаём WebRTC соединение
      const peerConnection = createPeerConnection();

      // Добавляем микрофон
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      console.log('[CALL] Audio track added');

      // Устанавливаем offer собеседника
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      console.log('[CALL] Remote description set');

      // Добавляем ICE-кандидаты, которые пришли слишком рано
        for (const candidate of pendingIceCandidatesRef.current) {
          try {
            console.log('[CALL] Adding queued ICE candidate');

            await peerConnection.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          } catch (error) {
            console.error(
              '[CALL] Error adding queued ICE candidate:',
              error
            );
          }
        }

        pendingIceCandidatesRef.current = [];

      // Создаём answer
      const answer = await peerConnection.createAnswer();

      console.log('[CALL] Answer created');

      // Устанавливаем свой answer
      await peerConnection.setLocalDescription(answer);

      console.log('[CALL] Local description set');

      // Отправляем answer
      socket.emit('call_answer', {
        chat_id: chatId,
        sender: name,
        answer: answer
      });

      console.log('[CALL] Answer sent');

      setInCall(true);

    } catch (error) {
      console.error('[CALL] Error while answering:', error);
    }
  };

  // --------------------------------
  // Получить answer
  // --------------------------------
  const handleAnswer = async (answer) => {
    try {
      if (!peerConnectionRef.current) {
        console.error('[CALL] PeerConnection does not exist');
        return;
      }

      console.log('[CALL] Setting remote answer');

      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      console.log('[CALL] Remote answer set');

    } catch (error) {
      console.error('[CALL] Error while receiving answer:', error);
    }
  };

  // --------------------------------
  // Получить ICE candidate
  // --------------------------------
  const handleIceCandidate = async (candidate) => {
  try {
    const peerConnection = peerConnectionRef.current;

    if (!peerConnection) {
      console.log('[CALL] PeerConnection not ready, queueing ICE candidate');

      pendingIceCandidatesRef.current.push(candidate);
      return;
    }

    if (!peerConnection.remoteDescription) {
      console.log('[CALL] Remote description not ready, queueing ICE candidate');

      pendingIceCandidatesRef.current.push(candidate);
      return;
    }

    console.log('[CALL] Adding ICE candidate');

    await peerConnection.addIceCandidate(
      new RTCIceCandidate(candidate)
    );

  } catch (error) {
    console.error('[CALL] Error while adding ICE candidate:', error);
  }
};

  // --------------------------------
  // Очистка звонка
  // --------------------------------
const cleanupCall = () => {
  console.log('[CALL] Cleaning up call');

  if (localStreamRef.current) {
    localStreamRef.current
      .getTracks()
      .forEach((track) => track.stop());

    localStreamRef.current = null;
  }

  if (peerConnectionRef.current) {
    peerConnectionRef.current.close();
    peerConnectionRef.current = null;
  }

  pendingIceCandidatesRef.current = [];

  setCallStream(null);
  setInCall(false);
};

  // --------------------------------
  // Завершить звонок
  // --------------------------------
  const endCall = () => {
    if (!socket) {
      cleanupCall();
      return;
    }

    console.log('[CALL] Ending call');

    socket.emit('call_end', {
      chat_id: chatId,
      sender: name
    });

    cleanupCall();
  };

  // --------------------------------
  // Socket.IO события
  // --------------------------------
  useEffect(() => {
    if (!socket) {
      console.log('[CALL] Waiting for socket...');
      return;
    }

    console.log('[CALL] Registering Socket.IO call listeners');

    // Получили offer
    const handleOffer = async (data) => {
      if (data.sender === name) return;

      console.log('[CALL] Offer received:', data);

      await answerCall(data.offer);
    };

    // Получили answer
    const handleAnswerEvent = async (data) => {
      if (data.sender === name) return;

      console.log('[CALL] Answer received:', data);

      await handleAnswer(data.answer);
    };

    // Получили ICE
    const handleIceCandidateEvent = async (data) => {
      if (data.sender === name) return;

      console.log(
        '[CALL] ICE candidate received:',
        data.candidate
      );

      await handleIceCandidate(data.candidate);
    };

    // Собеседник завершил звонок
    const handleCallEnd = (data) => {
      if (data.sender === name) return;

      console.log('[CALL] Call ended by other user');

      cleanupCall();
    };

    socket.on('call_offer', handleOffer);
    socket.on('call_answer', handleAnswerEvent);
    socket.on(
      'call_ice_candidate',
      handleIceCandidateEvent
    );
    socket.on('call_end', handleCallEnd);

    return () => {
      console.log('[CALL] Removing Socket.IO call listeners');

      socket.off('call_offer', handleOffer);
      socket.off('call_answer', handleAnswerEvent);
      socket.off(
        'call_ice_candidate',
        handleIceCandidateEvent
      );
      socket.off('call_end', handleCallEnd);
    };

  }, [socket, chatId, name]);

  // --------------------------------
  // Возвращаем функции
  // --------------------------------
  return {
    startCall,
    answerCall,
    endCall,
    callStream,
    inCall
  };
}