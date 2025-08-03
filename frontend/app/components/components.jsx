import React from "react";
import {useRef, useState} from "react"
import { stopMicro, startMicro } from "./micro";
import { Dialog, DialogTitle, DialogActions, Button } from '@mui/material';

export function Progress({ loading, error }) {
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return null;
}

export function Sidebar({ searchQuery,setSearchQuery }){
    return (
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
    )
}

export function User_List({FilteredUsers, handleUserClick}){
    return(
    <div className="user-list">
        {FilteredUsers && FilteredUsers.map((user) => (
            <div
              key={user.id}
              className="user-item"
              onClick={() => handleUserClick(user.name)} // Передаем функцию для изменения currentUser
            >
                {user.name}
            </div>
          ))}
    </div>
    )
}

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




export function ChatHeader({currentUser}){
    return(
        <div className="chat-header">
            <span>Chat with {currentUser || "Select a user"}</span>
        </div>
    )
}

export function InputField({ newMessage, setNewMessage, handleSendMessage, editingMsgId, setEditingMsgId }) {
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && newMessage.trim()) {
      if (editingMsgId !== null) {
        // редактирование
        handleSendMessage({ id: editingMsgId, text: newMessage }, 'edit_msg');
        setEditingMsgId(null);  // сбрасываем режим редактирования
      } else {
        // обычное сообщение
        handleSendMessage(newMessage, 'send_message');
      }
      setNewMessage('');
    }
  };

  return (
    <input
      type="text"
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder="Напишите сообщение..."
    />
  );
}

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

