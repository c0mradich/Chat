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

  // =========================================================
  // SOCKET
  // =========================================================

  const socketRef = useRef(null);

  const [socket, setSocket] = useState(null);

  const [socketConnected, setSocketConnected] = useState(false);


  // Храним предыдущий chatId.
  // Нужен для leave старой комнаты при переключении.
  const previousChatIdRef = useRef(null);


  // =========================================================
  // CREATE SOCKET
  // =========================================================
  //
  // Socket зависит ТОЛЬКО от name.
  //
  // Поэтому:
  //
  // name появляется
  //      ↓
  // Socket создаётся
  //
  // chatId меняется
  //      ↓
  // Socket НЕ пересоздаётся
  //
  // =========================================================

  useEffect(() => {

    if (!name) {
      return;
    }


    console.log('🔌 Creating Socket.IO connection');


    const newSocket = io(apiURL, {
      withCredentials: true,
    });


    socketRef.current = newSocket;

    setSocket(newSocket);


    // =======================================================
    // CONNECT
    // =======================================================

    newSocket.on('connect', () => {

      console.log(
        '🟢 SOCKET CONNECTED:',
        newSocket.id
      );


      setSocketConnected(true);

    });


    // =======================================================
    // DISCONNECT
    // =======================================================

    newSocket.on('disconnect', () => {

      console.log(
        '🔴 SOCKET DISCONNECTED'
      );


      setSocketConnected(false);

    });


    // =======================================================
    // RECEIVE MESSAGE
    // =======================================================

    newSocket.on('receive_message', (msg) => {

      console.log(
        '📨 RECEIVED:',
        msg
      );


      onMessage(msg);

    });


    // =======================================================
    // DELETE MESSAGE
    // =======================================================

    newSocket.on('deleted_message', (msg) => {

      onDeleteMessage(msg.id);

    });


    // =======================================================
    // EDIT MESSAGE
    // =======================================================

    newSocket.on('edit_msg', (msg) => {

      onEditMessage(msg);

    });


    // =======================================================
    // ADD USER
    // =======================================================

    newSocket.on('add_user', (msg) => {

      const user = {

        name: msg.name,

        id: msg.id,

        isGroup: false,

        chatParticipants: [
          msg.name,
          name
        ],

      };


      setUsers(prev => [
        ...prev,
        user
      ]);


      setChatsInfo(prev => [
        ...prev,
        user
      ]);

    });


    // =======================================================
    // CHANGE USER
    // =======================================================

    newSocket.on('changeUser', (msg) => {

      const {
        name: newName,
        oldName
      } = msg;


      let i = 0;


      setUsers(prevUsers =>

        prevUsers.map(user => {

          if (user.name === oldName) {

            i++;


            return {
              ...user,
              name: newName
            };

          }


          return user;

        })

      );


      if (i === 0) {

        newSocket.emit(
          'changeUser',
          {
            name: newName,
            oldName: oldName
          }
        );

      }

    });


    // =======================================================
    // GET USER CHATS
    // =======================================================

    newSocket.on('get_user_chats', (msg) => {

      console.log(
        '💬 GET USER CHATS:',
        msg
      );


      const arr = [];

      const currentUserName =
        msg.name;


      for (const chat of msg.chats) {

        let chatName =
          chat.name;


        // ================================================
        // PRIVATE CHAT
        // ================================================

        if (
          !chat.is_group &&
          chat.participants.length === 2
        ) {

          const otherName =
            chat.participants.find(
              p => p !== currentUserName
            );


          chatName =
            otherName;

        }


        arr.push({

          id: chat.id,

          name: chatName,

          isGroup: chat.is_group,

          chatParticipants:
            chat.participants,

        });

      }


      // ВАЖНО:
      //
      // Это ЗАМЕНА списка, а не добавление.
      //
      // Даже если get_user_chats каким-то образом
      // придёт дважды, чаты не будут дублироваться.

      setUsers(arr);

      setChatsInfo(arr);

      setLoading(false);

    });


    // =======================================================
    // CLEANUP SOCKET
    // =======================================================

    return () => {

      console.log(
        '🧹 CLEANUP SOCKET'
      );


      newSocket.disconnect();


      if (
        socketRef.current === newSocket
      ) {

        socketRef.current = null;

      }


      setSocketConnected(false);

      setSocket(null);

    };

  }, [name]);


  // =========================================================
  // JOIN / LEAVE CHAT ROOM
  // =========================================================
  //
  // Этот effect зависит от chatId.
  //
  // Но он НЕ создаёт новый Socket.
  //
  // =========================================================

  useEffect(() => {

    const currentSocket =
      socketRef.current;


    if (
      !currentSocket ||
      !currentSocket.connected
    ) {

      return;

    }


    // =======================================================
    // LEAVE PREVIOUS CHAT
    // =======================================================

    if (
      previousChatIdRef.current &&
      previousChatIdRef.current !== chatId
    ) {

      console.log(
        '🚪 LEAVE CHAT:',
        previousChatIdRef.current
      );


      currentSocket.emit(
        'leave',
        {
          chat_id:
            previousChatIdRef.current,

          name:
            name
        }
      );

    }


    // =======================================================
    // JOIN NEW CHAT
    // =======================================================

    if (chatId) {

      console.log(
        '🚪 JOIN CHAT:',
        chatId
      );


      currentSocket.emit(
        'join',
        {
          chat_id:
            chatId,

          name:
            name
        }
      );


      previousChatIdRef.current =
        chatId;

    }
    else {

      previousChatIdRef.current =
        null;

    }


  }, [
    chatId,
    name,
    socketConnected
  ]);


  // =========================================================
  // CLEANUP CURRENT CHAT ROOM
  // =========================================================

  useEffect(() => {

    return () => {

      const currentSocket =
        socketRef.current;


      if (
        currentSocket &&
        currentSocket.connected &&
        previousChatIdRef.current
      ) {

        console.log(
          '🚪 LEAVE CHAT ON CLEANUP:',
          previousChatIdRef.current
        );


        currentSocket.emit(
          'leave',
          {
            chat_id:
              previousChatIdRef.current,

            name:
              name
          }
        );


        previousChatIdRef.current =
          null;

      }

    };

  }, [name]);


  // =========================================================
  // SEND MESSAGE / SOCKET EVENT
  // =========================================================

  const sendMessage = (
    text,
    path
  ) => {

    console.log(
      'File:',
      text,
      'path:',
      path
    );


    const currentSocket =
      socketRef.current;


    // =======================================================
    // SOCKET DOES NOT EXIST
    // =======================================================

    if (!currentSocket) {

      console.log(
        '❌ Socket does not exist yet'
      );

      return;

    }


    // =======================================================
    // SOCKET EXISTS BUT NOT CONNECTED
    // =======================================================

    if (!currentSocket.connected) {

      console.log(
        '❌ Socket exists but is not connected yet'
      );

      return;

    }


    // =======================================================
    // SEND EVENT
    // =======================================================

    currentSocket.emit(
      path,
      {
        chat_id:
          chatId,

        sender:
          name,

        text:
          text
      }
    );

  };


  // =========================================================
  // RETURN
  // =========================================================

  return {

    sendMessage,

    socket,

    socketConnected

  };

}