import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useChat(chatId, name, onMessage) {
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
