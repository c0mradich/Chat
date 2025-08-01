'use client';
import React, { useState, useEffect } from 'react';
import './css/chat.css'; // Импорт стилей
import { getId, filteredUsers, redirect, fetchUsers, handleSendMessage, handleKeyDown, useHandleUserClick} from './components/utils';
import { Progress, Sidebar, User_List, Messages, ChatHeader, InputField, InputButtons} from './components/components';
import { fetchMessages } from './components/fetchMessages';
import { fetchChatId } from './components/fetchChatId';
import { useChat } from './components/useChat';

function Home() {
  const [name, setName] = useState(null)
  const [messages, setMessages] = useState([]); // Список всех сообщений
  const [newMessage, setNewMessage] = useState(''); // New Message
  const [searchQuery, setSearchQuery] = useState(''); // Список пользователей
  const [users, setUsers] = useState([]); // Список пользователей
  const [loading, setLoading] = useState(true); // Для отслеживания загрузки
  const [error, setError] = useState(null); // Для отслеживания ошибки
  const [currentUser, setCurrentUser] = useState(null); // Текущий собеседник
  const [data, setData] = useState(null)
  const [FilteredUsers, setFilteredUsers] = useState([])
  const [chatId, setChatId] = useState(null)
  const handleUserClick = useHandleUserClick(setCurrentUser)
// после всех useState:
const { sendMessage: wsSendMessage } = useChat(
  chatId,
  name,
  (msg) => setMessages(prev => [...prev, msg]),
  (id) => setMessages(prev => prev.filter(msg => msg.id !== id))
);
  // Получаем пользователей при загрузке компонента
// 1) Загрузка данных и авторизация — один раз
useEffect(() => {
  async function checkAuthAndFetch() {
    await redirect(setName);
    fetchUsers('http://localhost:5000/getUserList', setData, setUsers, setCurrentUser, setError, setLoading, name);
  }
  checkAuthAndFetch();
}, []);

// 2) Обновление фильтрованных пользователей при изменении зависимостей
useEffect(() => {
  const filtered = filteredUsers(users, searchQuery, name);
  setFilteredUsers(filtered);
}, [users, searchQuery, name]);

// 3) Установка текущего пользователя при обновлении фильтрованных пользователей
useEffect(() => {
  if (FilteredUsers.length > 0) {
    setCurrentUser(FilteredUsers[0].name);
  } else {
    setCurrentUser(null);
  }
}, [FilteredUsers]);

useEffect(() => {
  async function loadChat() {
    if (!name || !currentUser) return;
    const id = await fetchChatId(name, currentUser);
    if (id) setChatId(id);
  }
  loadChat();
}, [currentUser, name]);

useEffect(() => {
  if (!chatId) return;
  (async () => {
    const history = await fetchMessages(chatId);
    console.log(history)
    setMessages(history);
  })();
}, [chatId]);


  return (
    <div className="chat-container">
      <Progress loading={loading} error={error} />
      <div className="sidebar">
      <Sidebar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <User_List FilteredUsers={FilteredUsers} handleUserClick={handleUserClick} />
      </div>
       {currentUser && (
      <div className="chat-area">
      <ChatHeader currentUser={currentUser}/>
      <Messages messages={messages} name={name} handleSendMessage={wsSendMessage}/>
        <div className="chat-input">
      <InputField
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        handleSendMessage={wsSendMessage}
      />
      <InputButtons
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        handleSendMessage={wsSendMessage}
      />
        </div>
      </div>
       )}
    </div>
  );
}

export default Home;