// call.js

export const startCall = async (
  chatId,
  socket,
  setCallStream,
  setPeerConnection
) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        }
      ]
    });

    // Добавляем свой микрофон
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    // Получаем звук второго пользователя
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];

      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;
    };

    // Передаём ICE через сервер
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('call_ice_candidate', {
          chatId,
          candidate: event.candidate
        });
      }
    };

    // Создаём предложение
    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);

    // Передаём offer через сервер
    socket.emit('call_offer', {
      chatId,
      offer
    });

    setCallStream(stream);
    setPeerConnection(peerConnection);

    console.log('📞 Звонок начат');

  } catch (err) {
    console.error('Ошибка при начале звонка:', err);
  }
};


export const endCall = (
  chatId,
  socket,
  callStream,
  peerConnection,
  setCallStream,
  setPeerConnection
) => {

  if (callStream) {
    callStream.getTracks().forEach((track) => {
      track.stop();
    });

    setCallStream(null);
  }

  if (peerConnection) {
    peerConnection.close();
    setPeerConnection(null);
  }

  socket.emit('call_end', {
    chatId
  });

  console.log('📴 Звонок завершён');
};