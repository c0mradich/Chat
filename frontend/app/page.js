'use client';
import React, { useState, useEffect } from 'react';
import './css/chat.css'; // Импорт стилей
import { Progress, ChatHeader, redirect} from './components/components';
import { Sidebar, User_List, filteredUsers, useHandleUserClick, fetchUsers } from "./components/Input/Sidebar"
import {Messages} from "./components/Input/Messsages"
import { InputField } from './components/Input/InputField';
import {InputButtons} from "./components/Input/InputfButtons"
import { fetchMessages } from './components/Backend/fetchMessages';
import { fetchChatId } from './components/Backend/fetchChatId';
import { useChat } from './components/Backend/useChat';

function Home() {
  const [name, setName] = useState(null)
  const [messages, setMessages] = useState([]); // Список всех сообщений
  const [newMessage, setNewMessage] = useState(''); // New Message
  const [searchQuery, setSearchQuery] = useState(''); // Список пользователей
  const [users, setUsers] = useState([]); // Список пользователей
  const [loading, setLoading] = useState(true); // Для отслеживания загрузки
  const [error, setError] = useState(null); // Для отслеживания ошибки
  const [currentChat, setCurrentChat] = useState(null); // Текущий чат
  const [data, setData] = useState(null)
  const [FilteredUsers, setFilteredUsers] = useState([])
  const [chatId, setChatId] = useState(null)
  const handleUserClick = useHandleUserClick(setCurrentChat)
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [chatsInfo, setChatsInfo] = useState([])
  const [currentChatInfo, setCurrentChatInfo] = useState({})
// после всех useState:
const { sendMessage: wsSendMessage } = useChat(
  chatId,
  name,
  (msg) => setMessages(prev => [...prev, msg]),
  (id) => setMessages(prev => prev.filter(msg => msg.id !== id)),
  (msg) => setMessages(prev => {return prev.map(m => m.id === msg.id ? { ...m, text: msg.text } : m)}),
  setUsers, setLoading, setChatsInfo
)
  // Получаем пользователей при загрузке компонента
// 1) Загрузка данных и авторизация — один раз
useEffect(() => {
  async function checkAuthAndFetch() {
    const user_name = await redirect(setName);
    fetchUsers('http://localhost:5000/getUserList', setData, setUsers, setCurrentChat, setError, setLoading, user_name, wsSendMessage);
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
    const selectedName = FilteredUsers[0].name;
    setCurrentChat(selectedName);

    const info = users.filter(x => {
      return x.name === selectedName; // теперь вернёт true/false
    });

    setCurrentChatInfo(info.length > 0 ? info[0] : null);
  } else {
    setCurrentChat(null);
    setCurrentChatInfo(null);
  }
}, [FilteredUsers]);


useEffect(() => {
  async function loadChat() {
    if (!name || !currentChat) return;
    const id = await fetchChatId(name, currentChat, currentChatInfo);
    if (id) setChatId(id);
  }
  loadChat();
}, [currentChat, name]);

useEffect(() => {
  if (!chatId) return;
  (async () => {
    const history = await fetchMessages(chatId);
    // console.log(history)
    setMessages(history);
  })();
}, [chatId]);


  return (
    <div className="chat-container">
      <Progress loading={loading} error={error} />
      <div className="sidebar">
      <Sidebar searchQuery={searchQuery} setSearchQuery={setSearchQuery} users={users} handleSendMessage={wsSendMessage} name={name}/>

      <User_List FilteredUsers={FilteredUsers} setCurrentChat={setCurrentChat} chatsInfo={users} setCurrentChatInfo={setCurrentChatInfo} chatId={chatId} name={name}/>
      </div>
       {currentChat && (
      <div className="chat-area">
      <ChatHeader currentChat={currentChat}/>
      <Messages messages={messages} name={name} handleSendMessage={wsSendMessage} setNewMessage={setNewMessage} setEditingMsgId={setEditingMsgId}/>
        <div className="chat-input">
      <InputField
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        handleSendMessage={wsSendMessage}
        editingMsgId={editingMsgId}
        setEditingMsgId={setEditingMsgId}
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