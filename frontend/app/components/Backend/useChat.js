import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const apiURL = process.env.NEXT_PUBLIC_API_URL


export function useChat(chatId, name, onMessage, onDeleteMessage, onEditMessage, setUsers, setLoading, setChatsInfo, users) {
  const socketRef = useRef();
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  setSocketConnected(false);

useEffect(() => {
  if (!name) {
    return;
  }

  const newSocket = io(apiURL, {
    withCredentials: true,
  });

  socketRef.current = newSocket;
  setSocket(newSocket);

  newSocket.on('connect', () => {
    console.log('🟢 SOCKET CONNECTED:', newSocket.id);

    setSocketConnected(true);

    if (chatId) {
      newSocket.emit('join', {
        chat_id: chatId,
        name: name,
      });
    }
  });

  newSocket.on('disconnect', () => {
    setSocketConnected(false);
  });

  newSocket.on('receive_message', (msg) => {
    console.log('📨 RECEIVED:', msg);
    onMessage(msg);
  });

  newSocket.on('deleted_message', (msg) => {
    onDeleteMessage(msg.id);
  });

  newSocket.on('edit_msg', (msg) => {
    onEditMessage(msg);
  });

  newSocket.on('add_user', (msg) => {
    const user = {
      name: msg.name,
      id: msg.id,
      isGroup: false,
      chatParticipants: [msg.name, name],
    };

    setUsers(prev => [...prev, user]);
    setChatsInfo(prev => [...prev, user]);
  });

  newSocket.on('changeUser', (msg) => {
    const { name: newName, oldName } = msg;
    let i = 0;

    setUsers(prevUsers =>
      prevUsers.map(user => {
        if (user.name === oldName) {
          i++;
          return { ...user, name: newName };
        }
        return user;
      })
    );

    if (i === 0) {
      newSocket.emit('changeUser', {
        name: newName,
        oldName: oldName,
      });
    }
  });

  newSocket.on('get_user_chats', (msg) => {
    const arr = [];
    const currentUserName = msg.name;

    for (const chat of msg.chats) {
      let chatName = chat.name;

      if (!chat.is_group && chat.participants.length === 2) {
        const otherName = chat.participants.find(
          p => p !== currentUserName
        );
        chatName = otherName;
      }

      arr.push({
        id: chat.id,
        name: chatName,
        isGroup: chat.is_group,
        chatParticipants: chat.participants,
      });
    }

    setUsers(prev => [...prev, ...arr]);
    setChatsInfo(prev => [...prev, ...arr]);
    setLoading(false);
  });

  return () => {
    if (newSocket.connected) {
      newSocket.emit('leave', {
        chat_id: chatId,
        name: name,
      });
    }

    newSocket.disconnect();
  };
}, [chatId, name]);

  // Функция для отправки
const sendMessage = (text, path) => {
  console.log("File:", text, "path", path);

  if (!socketRef.current?.connected) {
    console.log("❌ Socket not connected");
    return;
  }

  socketRef.current.emit(path, {
    chat_id: chatId,
    sender: name,
    text
  });
};

return {
  sendMessage,
  socket,
  socketConnected
};
}
