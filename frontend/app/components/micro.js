export const startMicro = async (setMicRecorder, setMicStream, setMimeType) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    let mimeType = '';
    if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      mimeType = 'audio/ogg;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else {
      console.error('Ни OGG, ни WEBM не поддерживаются этим браузером');
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    setMicStream(stream);
    setMicRecorder(recorder);
    setMimeType(mimeType);

    recorder.start();
    console.log(`Микрофон включен и запись начата (${mimeType})`);
  } catch (err) {
    console.error('Ошибка при включении микрофона:', err);
  }
};

export const stopMicro = async (
  micStream, micRecorder, mimeType,
  setMicStream, setMicRecorder, setMimeType,
  handleSendMessage
) => {
  if (micRecorder && micRecorder.state !== 'inactive') {
    const chunks = [];

    await new Promise((resolve) => {
      micRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      micRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();

        reader.onloadend = () => {
          const base64 = reader.result;
          const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
          handleSendMessage({ file: base64, name: `audio_message.${ext}`, type: mimeType }, 'send_file');
          console.log(`Файл сформирован: ${mimeType}, размер: ${blob.size} байт`);
          resolve();
        };

        reader.readAsDataURL(blob);
      };

      micRecorder.requestData();
      micRecorder.stop();
      console.log('Запись остановлена');
    });

    // Теперь можно выключать микрофон и сбрасывать состояния
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      setMicStream(null);
    }
    setMicRecorder(null);
    setMimeType(null);
    console.log('Микрофон выключен');
  }
};
