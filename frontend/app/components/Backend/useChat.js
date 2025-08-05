import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useChat(chatId, name, onMessage, onDeleteMessage, onEditMessage, setUsers, setLoading, setChatsInfo) {
  const socketRef = useRef();

  useEffect(() => {
    // 1) Подключаемся
    socketRef.current = io('http://localhost:5000', {
      withCredentials: true,
    });

    socketRef.current.on('connect', () => {
      // 2) Входим в комнату
      socketRef.current.emit('join', { chat_id: chatId });
    });

    // 3) Слушаем входящие
    socketRef.current.on('receive_message', (msg) => {
      onMessage(msg); // например, setMessages(prev => [...prev, msg])
    });

    socketRef.current.on('deleted_message', (msg)=>{
      onDeleteMessage(msg.id)
    })
    socketRef.current.on('edit_msg', (msg)=>{
      onEditMessage(msg)
    })


socketRef.current.on('get_user_chats', (msg) => {
  console.warn(msg.chats);
  const arr = [];
  const currentUserName = msg.name

  for (const chat of msg.chats) {
    let chatName = chat.name;

    // Если это не группа и два участника — показать имя собеседника
    if (!chat.is_group && chat.participants.length === 2) {
      const otherName = chat.participants.find(p => p !== currentUserName);
      chatName = otherName
    }

    arr.push({
      id: chat.id,
      name: chatName,
      isGroup: chat.is_group,
      chatParticipants: chat.participants
    });
  }
  setUsers(arr)
  setChatsInfo(arr)
  setLoading(false);
});


    return () => {
      // 4) Очищаем
      socketRef.current.emit('leave', { chat_id: chatId });
      socketRef.current.disconnect();
    };
  }, [chatId]);

  // Функция для отправки
  const sendMessage = (text,path) => {
    socketRef.current.emit(path, {
      chat_id: chatId,
      sender: name,
      text,
    });
  };

  return { sendMessage };
}
