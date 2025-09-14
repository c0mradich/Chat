import {useRef, useState} from "react"
import { Dialog, DialogTitle, DialogActions, Button } from '@mui/material';

const apiURL = process.env.NEXT_PUBLIC_API_URL

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
    console.log("Porno", name, selectedMsg)
    if(name===selectedMsg.sender){
      handleSendMessage({selectedMsg}, 'delete_msg')
    }
    handleClosePopup();
  }

  function handleEdit() {
    if(name===selectedMsg.sender){
      setEditingMsgId(selectedMsg.id)
      setNewMessage(selectedMsg.text)
    }
    handleClosePopup();
  }

  function renderContent(msg) {
  const { content, text } = msg;

  if (!content) return <div className="message-text">{text}</div>;

  // Проверяем base64
  if (typeof content === 'string' && content.startsWith('data:')) {
    try {
      const [metadata, base64Data] = content.split(',');
      const mime = metadata.split(':')[1]?.split(';')[0] || '';
      if (mime.startsWith('image/')) return <img src={content} alt="file" className="message-image" />;
      if (mime.startsWith('audio/')) return <audio controls src={content} />;
      if (mime.startsWith('video/')) return <video controls src={content} />;
      return <a href={content} download>Скачать файл</a>;
    } catch (err) {
      console.warn("Ошибка при рендере base64:", err);
      return <div className="message-text">{text}</div>;
    }
  }

  // Ссылка на серверный файл
  const url = typeof content === 'string' ? `${apiURL}/${encodeURI(content)}` : '';
  const ext = url.split('.').pop()?.toLowerCase() || '';

  const fileTypes = {
    images: ['png','jpg','jpeg','gif','webp'],
    audios: ['mp3','wav','ogg'],
    videos: ['mp4','webm','mov']
  };

  if (fileTypes.images.includes(ext)) return <img src={url} alt="file" className="message-image" />;
  if (fileTypes.audios.includes(ext)) return <audio controls src={url} />;
  if (fileTypes.videos.includes(ext)) return <video controls src={url} />;
  
  return <a href={url} download>Скачать файл</a>;
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
              {msg.content && msg.content.trim() !== '' ? renderContent(msg) : (
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