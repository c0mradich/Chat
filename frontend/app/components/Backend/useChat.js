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
  currentChat,
  dialogButtons,
  currentChatInfo,
  setChatId,
  setMessages,
  fetchMessages
) {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const previousChatIdRef = useRef(null);

  const fetchUsers = (userName) => {
  const currentSocket = socketRef.current;

  if (!currentSocket || !currentSocket.connected) return;

  currentSocket.emit('get_userlist', {
    text: { name: userName },
  });
};

  useEffect(() => {
    if (!name) return;

    const newSocket = io(apiURL, { withCredentials: true });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
    console.log('Socket подключён:', newSocket.id, 'Пользователь:', name);
    newSocket.emit('register_user', { name });
    setSocketConnected(true);
  });
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

    newSocket.on('join_chat', async msg => {
      const invitedChatId = msg.chat_id;

      if (!invitedChatId) {
        console.error('JOIN_CHAT: chat_id отсутствует', msg);
        return;
      }

      console.log('📨 Получено приглашение в чат:', invitedChatId);

      newSocket.emit(
        'join',
        {
          chat_id: invitedChatId,
          name
        },
        result => {
          if (result?.success) {
            console.log('✅ Автоматически вошли в комнату:', invitedChatId);
          } else {
            console.error('❌ Не удалось войти в комнату:', result);
          }
        }
      );
      const messages = await fetchMessages(invitedChatId)
      setMessages(messages)
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
          userId: chat.user_id,
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


const sendMessage = async (text, path) => {
  const currentSocket = socketRef.current;

  if (!currentSocket || !currentSocket.connected) return;

  let actualChatId = chatId;

  // Если личного чата ещё нет — создаём его.
  if (actualChatId == null && currentChatInfo && !currentChatInfo.isGroup) {
    const response = await fetch(`${apiURL}/create_chat`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        other_user_id: currentChatInfo.userId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Не удалось создать чат');
    }

    actualChatId = data.chat_id;
    setChatId(actualChatId);
    const joinResult = await new Promise((resolve) => {
      currentSocket.emit(
        'join',
        { chat_id: actualChatId, name, other_username: currentChat },
        resolve
      );
    });

    if (!joinResult?.success) {
      console.error('Не удалось войти в комнату:', joinResult);
      return;
    }

    console.log('Успешно вошли в комнату:', actualChatId);
  }

  // Не отправляем сообщение без ID чата.
  if (actualChatId == null) {
    console.error('Невозможно отправить сообщение: chat_id отсутствует');
    return;
  }

  currentSocket.emit(path, {
    chat_id: actualChatId,
    sender: name,
    text,
  });

  dialogButtons(0);
};


  return {
  sendMessage,
  fetchUsers,
  socket,
  socketConnected,
};
}