import React from "react";

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

export function Messages({ messages, name }) {
  return (
    <div className="messages">
      {messages.map((msg, index) => {
        const isMe = msg.sender === name;
        const displayName = isMe ? 'You' : msg.sender;
        return (
          <div
            key={index}
            className={`message ${isMe ? 'sent' : 'received'}`}
          >
            <div className="message-sender">{displayName}</div>
            <div className="message-text">{msg.text}</div>
          </div>
        );
      })}
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

export function InputField({ newMessage, setNewMessage, handleSendMessage }) {
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && newMessage.trim()) {
      handleSendMessage(newMessage);
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
export function InputButtons({ newMessage, setNewMessage, handleSendMessage }) {
  const onSendClick = () => {
    if (!newMessage.trim()) return;
    handleSendMessage(newMessage);
    setNewMessage('');
  };

  return (
    <div className="input-buttons">
      <button className="call-btn">📞</button>
      <button className="video-call-btn">📹</button>
      <button className="audio-msg-btn">🎤</button>
      <button className="send-btn" onClick={onSendClick}>
        ➤
      </button>
    </div>
  );
}
