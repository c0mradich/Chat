import {useState, useRef} from "react"
import { stopMicro, startMicro } from "./micro";

export function InputButtons({ newMessage, setNewMessage, handleSendMessage, }) {
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

const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result; // base64 строка с префиксом data:...
      handleSendMessage({ file: base64, name: file.name, type: file.type }, 'send_file');
    };
    reader.readAsDataURL(file);
  }
};


  return (
    <div className="input-buttons">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button className="call-btn">📞</button>
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