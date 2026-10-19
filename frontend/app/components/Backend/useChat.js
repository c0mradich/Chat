import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const apiURL = process.env.NEXT_PUBLIC_API_URL;

export function useChat(
  chatId,
  name,
  onMessage,
  onDeleteMessage,
  onEditMessage,
  setUsers,
  setLoading,
  setChatsInfo,
  users,
  dialogButtons
) {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const previousChatIdRef = useRef(null);

  useEffect(() => {
    if (!name) return;

    const newSocket = io(apiURL, { withCredentials: true });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => setSocketConnected(true));
    newSocket.on('disconnect', () => setSocketConnected(false));

    newSocket.on('receive_message', msg => onMessage(msg));
    newSocket.on('deleted_message', msg => onDeleteMessage(msg.id));
    newSocket.on('edit_msg', msg => onEditMessage(msg));

    newSocket.on('add_user', msg => {
      const user = {
        name: msg.name,
        id: msg.id,
        isGroup: false,
        chatParticipants: [msg.name, name]
      };
      setUsers(prev => [...prev, user]);
      setChatsInfo(prev => [...prev, user]);
    });

    newSocket.on('changeUser', msg => {
      const { name: newName, oldName } = msg;
      setUsers(prev =>
        prev.map(u => (u.name === oldName ? { ...u, name: newName } : u))
      );
    });

    newSocket.on('get_user_chats', msg => {
      const arr = [];
      const currentUserName = msg.name;

      for (const chat of msg.chats) {
        let chatName = chat.name;
        if (!chat.is_group && chat.participants.length === 2) {
          chatName = chat.participants.find(p => p !== currentUserName);
        }
        arr.push({
          id: chat.id,
          name: chatName,
          isGroup: chat.is_group,
          chatParticipants: chat.participants
        });
      }

      setUsers(arr);
      setChatsInfo(arr);
      setLoading(false);
    });

    return () => {
      newSocket.disconnect();
      if (socketRef.current === newSocket) socketRef.current = null;
      setSocketConnected(false);
      setSocket(null);
    };
  }, [name]);

  useEffect(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket || !currentSocket.connected) return;

    if (previousChatIdRef.current && previousChatIdRef.current !== chatId) {
      currentSocket.emit('leave', {
        chat_id: previousChatIdRef.current,
        name
      });
    }

    if (chatId) {
      currentSocket.emit('join', { chat_id: chatId, name });
      previousChatIdRef.current = chatId;
    } else {
      previousChatIdRef.current = null;
    }
  }, [chatId, name, socketConnected]);

  const sendMessage = (text, path) => {
    const currentSocket = socketRef.current;
    if (!currentSocket || !currentSocket.connected) return;

    currentSocket.emit(path, {
      chat_id: chatId,
      sender: name,
      text
    });

    dialogButtons(0);
  };

  return { sendMessage, socket, socketConnected };
}