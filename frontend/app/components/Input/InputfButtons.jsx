import {useState, useRef} from "react"
import { stopMicro, startMicro } from "./micro";
import { handleFileChange } from "./SendFile";
const apiURL = process.env.NEXT_PUBLIC_API_URL

export function InputButtons({ newMessage, setNewMessage, handleSendMessage, sender, chatId, displayButtonsIndex, startCall, endCall, inCall }) {
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

return (
  <div className="input-buttons">
    {
      displayButtonsIndex ? (
        <button className="send-btn" onClick={onSendClick}>➤</button>
      ) : (
        <div className="expanded-buttons" style={{display: "flex"}}>  {/* WRAPPER */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e)=>{handleFileChange(e, sender, chatId, handleSendMessage)}}
          />
          <button className="video-call-btn">📹</button>
          {micStream ? (
            <button
              className="audio-msg-btn"
              onClick={() =>
                stopMicro(
                  micStream,
                  micRecorder,
                  mimeType,
                  setMicStream,
                  setMicRecorder,
                  setMimeType,
                  handleSendMessage,
                  sender,
                  chatId
                )
              }
            >
              ⏹️
            </button>
          ) : (
            <button
              className="audio-msg-btn"
              onClick={() => startMicro(setMicRecorder, setMicStream, setMimeType)}
            >
              🎤
            </button>
          )}
          <button className="file-input-btn" onClick={inputFile}>📎</button>

        </div>
      )
    }
  </div>
);}