import {useState, useRef} from "react"
import { stopMicro, startMicro } from "./micro";
const apiURL = process.env.NEXT_PUBLIC_API_URL

export function InputButtons({ newMessage, setNewMessage, handleSendMessage, sender, chatId }) {
  const [micStream, setMicStream] = useState(null);
  const [micRecorder, setMicRecorder] = useState(null);
  const [mimeType, setMimeType] = useState(null)

  const onSendClick = () => {
    if (!newMessage.trim()) return;
    handleSendMessage(newMessage, 'send_message');
    setNewMessage('');
  };
  const fileInputRef = useRef(null)
  const inputFile = ()=>{
    fileInputRef.current?.click()
  }
  
async function handleFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file); // <-- исправлено
  formData.append("sender", sender);
  formData.append("chatId", chatId);

  try {
    const res = await fetch(`${apiURL}/uploads`, {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const data = await res.json();
    console.log("Upload result:", data);

    // теперь можно через WS отправить ссылку другим клиентам
    handleSendMessage({ path: data.path, name: file.name, type: file.type }, "send_file");
  } catch (err) {
    console.error("Ошибка при загрузке файла:", err);
  }
}




  return (
    <div className="input-buttons">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button className="video-call-btn">📹</button>
            {micStream ? (
        <button className="audio-msg-btn" onClick={() => stopMicro(micStream, micRecorder, mimeType, setMicStream, setMicRecorder, setMimeType, handleSendMessage)}>⏹️</button>
      ) : (
        <button className="audio-msg-btn" onClick={() => startMicro(setMicRecorder, setMicStream, setMimeType)}>🎤</button>
      )}
      <button className="file-input-btn" onClick={inputFile}>📎</button>
      <button className="send-btn" onClick={onSendClick}>➤</button>
    </div>
  );
}