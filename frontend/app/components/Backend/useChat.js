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
  users
) {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const previousChatIdRef = useRef(null);

  // Create Socket
  useEffect(() => {
    if (!name) {
      return;
    }

    const newSocket = io(apiURL, {
      withCredentials: true,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connect
    newSocket.on('connect', () => {
      console.log('🟢 SOCKET CONNECTED:', newSocket.id);
      setSocketConnected(true);
    });

    // Disconnect
    newSocket.on('disconnect', () => {
      console.log('🔴 SOCKET DISCONNECTED');
      setSocketConnected(false);
    });

    // Receive message
    newSocket.on('receive_message', (msg) => {
      console.log('📨 RECEIVED:', msg);
      onMessage(msg);
    });

    // Delete message
    newSocket.on('deleted_message', (msg) => {
      onDeleteMessage(msg.id);
    });

    // Edit message
    newSocket.on('edit_msg', (msg) => {
      onEditMessage(msg);
    });

    // Add user
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

    // Change user
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

    // Get user chats
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

      setUsers(arr);
      setChatsInfo(arr);
      setLoading(false);
    });

    // Cleanup Socket
    return () => {
      console.log('🧹 CLEANUP SOCKET');

      newSocket.disconnect();

      if (socketRef.current === newSocket) {
        socketRef.current = null;
      }

      setSocketConnected(false);
      setSocket(null);
    };
  }, [name]);

  // Join / Leave chat
  useEffect(() => {
    const currentSocket = socketRef.current;

    if (!currentSocket || !currentSocket.connected) {
      return;
    }

    // Leave previous chat
    if (
      previousChatIdRef.current &&
      previousChatIdRef.current !== chatId
    ) {
      console.log('🚪 LEAVE CHAT:', previousChatIdRef.current);

      currentSocket.emit('leave', {
        chat_id: previousChatIdRef.current,
        name: name,
      });
    }

    // Join new chat
    if (chatId) {
      console.log('🚪 JOIN CHAT:', chatId);

      currentSocket.emit('join', {
        chat_id: chatId,
        name: name,
      });

      previousChatIdRef.current = chatId;
    } else {
      previousChatIdRef.current = null;
    }
  }, [chatId, name, socketConnected]);

  // Send message
  const sendMessage = (text, path) => {
    console.log('File:', text, 'path', path);

    if (!socketRef.current?.connected) {
      console.log('❌ Socket not connected');
      return;
    }

    socketRef.current.emit(path, {
      chat_id: chatId,
      sender: name,
      text,
    });
  };

  return {
    sendMessage,
    socket,
    socketConnected,
  };
}