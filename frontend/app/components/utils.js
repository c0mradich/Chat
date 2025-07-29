import { useCallback } from 'react';
import { sendMessage } from './sendMessage';

export async function getId() {
const res = await fetch('http://localhost:5000/me', {
  credentials: 'include',  // отправляем куки на сервер
});
const data = await res.json();
console.log(data)
return data
}

export function filteredUsers(users, searchQuery, name) {
  return users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    user.name.toLowerCase() !== name.toLowerCase()
  );
}

export async function redirect(setName) {
  const data = await getId(); // ждем ответа с сервера

  if (!data.user_id) {
    // Пользователь не авторизован
    window.location.href = '/login';
  } else {
    setName(data.username);
    console.log(data.username)
  }
}

  export async function fetchUsers (url, setData, setUsers, setCurrentUser, setError, setLoading, name) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const fetchedData = await response.json();
      setData(fetchedData);
      setUsers(fetchedData);

      if (fetchedData.length > 0 && fetchedData[0].name!==name) {
        setCurrentUser(fetchedData[0].name);
      } else {
        setCurrentUser(null);
      }

      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  export function handleSendMessage (messages, newMessage, setMessages, setNewMessage, name, chatId) {
    sendMessage(chatId, name, newMessage)
    if (newMessage.trim()) {
      setMessages([...messages, { user: 'You', text: newMessage }]);
      setNewMessage(''); // Очистить поле ввода
    }
  };
  export function handleKeyDown (target, messages, newMessage, setMessages, setNewMessage, handleSendMessage, chatId, name) {
    if (target.key === 'Enter') {
      handleSendMessage(messages, newMessage, setMessages, setNewMessage, name, chatId); // Отправка сообщения при нажатии Enter
    }
  };

export function useHandleUserClick(setCurrentUser) {
  return useCallback((userName) => {
    setCurrentUser(userName);
  }, [setCurrentUser]);
}