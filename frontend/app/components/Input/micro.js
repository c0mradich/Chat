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

    // Передаем состояния наружу
    setMicStream(stream);
    setMicRecorder(recorder);
    setMimeType(mimeType);

    // Стартуем с интервалом, чтобы не копить всё в памяти
    recorder.start(1000); // раз в секунду отдаёт чанки
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

    await new Promise((resolve, reject) => {
      micRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      micRecorder.onstop = () => {
        try {
          const blob = new Blob(chunks, { type: mimeType });
          const reader = new FileReader();

          reader.onloadend = () => {
            const base64 = reader.result;
            const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
            handleSendMessage(
              { file: base64, name: `audio_message.${ext}`, type: mimeType },
              'send_file'
            );
            resolve();
          };

          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(blob);
        } catch (err) {
          reject(err);
        }
      };

      micRecorder.stop();
    }).catch((err) => {
      console.error('Ошибка при остановке записи:', err);
    });

    // Освобождаем ресурсы
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      setMicStream(null);
    }
    setMicRecorder(null);
    setMimeType(null);
  }
};
