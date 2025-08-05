import {useRef, useState} from "react"
import { Dialog, DialogTitle, DialogActions, Button } from '@mui/material';

export function Messages({ messages, name, handleSendMessage,  setNewMessage, setEditingMsgId}) {
  const [open, setOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);

  function handleOpenPopup(msg) {
    setSelectedMsg(msg);
    setOpen(true);
  }

  function handleClosePopup() {
    setOpen(false);
    setSelectedMsg(null);
  }

  function handleDelete() {
    if(name===selectedMsg.sender){
      handleSendMessage({selectedMsg}, 'delete_msg')
      console.log("Удалить сообщение:", selectedMsg);
    }
    handleClosePopup();
  }

  function handleEdit() {
    if(name===selectedMsg.sender){
      console.log("Редактировать сообщение:", selectedMsg);
      setEditingMsgId(selectedMsg.id)
      setNewMessage(selectedMsg.text)
    }
    handleClosePopup();
  }

  function renderContent(msg) {
    try {
      const content = msg.content;
      if (typeof content !== 'string' || !content.startsWith('data:')) {
        throw new Error("msg.content не содержит base64");
      }

      const [metadata, base64Data] = content.split(",");
      if (!metadata || !base64Data) {
        throw new Error("Invalid base64 format");
      }

      const mime = metadata.split(":")[1]?.split(";")[0] || '';

      if (mime.startsWith("image/")) {
        return <img src={content} alt="file" className="message-image" />;
      } else if (mime.startsWith("audio/")) {
        return <audio controls src={content} />;
      } else if (mime.startsWith("video/")) {
        return <video controls src={content} />;
      } else {
        return <a href={content} download>Скачать файл</a>;
      }
    } catch (e) {
      console.warn("Не base64 или ошибка рендера:", e.message);
      console.warn(msg);
      return <div className="message-text">{msg.text}</div>;
    }
  }

  return (
    <div className="messages">
      {messages.map((msg, index) => {
        if (!msg || typeof msg !== 'object') {
          console.warn(`Невалидное сообщение по индексу ${index}:`, msg);
          return null;
        }

        const isMe = msg.sender === name;
        const displayName = isMe ? 'You' : msg.sender;

        return (
          <div
            key={index}
            className={`message ${isMe ? 'sent' : 'received'}`}
            onClick={() => handleOpenPopup(msg)}
            style={{ cursor: 'pointer' }}
          >
            <div className="message-sender">{displayName}</div>
            {msg.content ? renderContent(msg) : (
              <div className="message-text">{msg.text}</div>
            )}
          </div>
        );
      })}

      <Dialog open={open} onClose={handleClosePopup}>
        <DialogTitle>Опции сообщения</DialogTitle>
        <DialogActions>
          <Button onClick={handleEdit} color="primary">Редактировать</Button>
          <Button onClick={handleDelete} color="error">Удалить</Button>
          <Button onClick={handleClosePopup}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}