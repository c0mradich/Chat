const apiURL = process.env.NEXT_PUBLIC_API_URL;

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

    recorder.start(); // без интервала — пусть пишет цельный файл
  } catch (err) {
    console.error('Ошибка при включении микрофона:', err);
  }
};

export const stopMicro = async (
  micStream, micRecorder, mimeType,
  setMicStream, setMicRecorder, setMimeType,
  handleSendMessage, sender, chatId
) => {
  if (!micRecorder || micRecorder.state === 'inactive') return;

  const chunks = [];

  await new Promise((resolve, reject) => {
    micRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    micRecorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: mimeType });
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const formData = new FormData();

        formData.append('file', blob, `audio_message.${ext}`);
        formData.append('chatId', chatId);
        formData.append('sender', sender);

        const res = await fetch(`${apiURL}/uploads`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        const data = await res.json();
        console.log('Upload result:', data);

        handleSendMessage(
          { path: data.path, name: `audio_message.${ext}`, type: mimeType },
          'send_file'
        );

        resolve();
      } catch (err) {
        console.error('Ошибка при загрузке аудио:', err);
        reject(err);
      }
    };

    micRecorder.stop();
  });

  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    setMicStream(null);
  }
  setMicRecorder(null);
  setMimeType(null);
};
