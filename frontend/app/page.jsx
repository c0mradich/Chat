'use client';

import React, { useState, useEffect, useRef } from 'react';
import './css/chat.css';

import {
  Progress,
  ChatHeader,
  redirect,
  leave
} from './components/components';

import {
  Sidebar,
  User_List,
  filteredUsers,
  useHandleUserClick,
  fetchUsers
} from './components/Input/Sidebar';

import { Messages } from './components/Input/Messages';

import { InputField } from './components/Input/InputField';

import { fetchMessages } from './components/Backend/fetchMessages';

import fetchChatId from './components/Backend/fetchChatId';

import { useChat } from './components/Backend/useChat';

import { useCall } from './components/Backend/useCall';


const apiURL = process.env.NEXT_PUBLIC_API_URL;


function Home() {

  // =========================================================
  // STATE
  // =========================================================

  const [name, setName] = useState(null);

  const [messages, setMessages] = useState([]);

  const [newMessage, setNewMessage] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const [currentChat, setCurrentChat] = useState(null);

  const [FilteredUsers, setFilteredUsers] = useState([]);

  const [chatId, setChatId] = useState(null);

  const [editingMsgId, setEditingMsgId] = useState(null);

  const [chatsInfo, setChatsInfo] = useState([]);

  const [currentChatInfo, setCurrentChatInfo] = useState({});

  const [sideBarOpen, setSideBarOpen] = useState(true);

  const [dialogButtons, setDialogButtons] = useState(0);


  // =========================================================
  // REFS
  // =========================================================

  const messagesWindow = useRef(null);

  const audioRef = useRef(null);


  // =========================================================
  // HANDLE USER CLICK
  // =========================================================

  const handleUserClick = useHandleUserClick(setCurrentChat);


  // =========================================================
  // WEBSOCKET
  // =========================================================

  const {
    sendMessage: wsSendMessage,
    socket: wsSocket,
    socketConnected
  } = useChat(
    chatId,
    name,

    // RECEIVE MESSAGE
    (msg) => {
      setMessages(prev => [...prev, msg]);
    },

    // DELETE MESSAGE
    (id) => {
      setMessages(prev =>
        prev.filter(msg => msg.id !== id)
      );
    },

    // EDIT MESSAGE
    (msg) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === msg.id
            ? { ...m, text: msg.text }
            : m
        )
      );
    },

    setUsers,
    setLoading,
    setChatsInfo,
    users
  );


  // =========================================================
  // FETCH USERS AFTER SOCKET CONNECTS
  // =========================================================

  useEffect(() => {

    if (!name || !socketConnected) {
      return;
    }

    console.log('👤 Fetching users for:', name);

    fetchUsers(name, wsSendMessage);

  }, [name, socketConnected]);


  // =========================================================
  // WEBRTC CALL
  // =========================================================

  const {
    startCall,
    endCall,
    callStream,
    inCall
  } = useCall(
    wsSocket,
    chatId,
    name
  );


  // =========================================================
  // AUTHENTICATION
  // =========================================================

  useEffect(() => {

    async function checkAuthAndFetch() {

      await redirect(setName);

    }

    checkAuthAndFetch();

  }, []);


  // =========================================================
  // FILTER USERS
  // =========================================================

  useEffect(() => {

    const filtered = filteredUsers(
      users,
      searchQuery,
      name
    );

    setFilteredUsers(filtered);

  }, [
    users,
    searchQuery,
    name
  ]);


  // =========================================================
  // SELECT CURRENT CHAT
  // =========================================================

  useEffect(() => {

    if (FilteredUsers.length > 0) {

      const selectedName =
        FilteredUsers[0].name;

      setCurrentChat(selectedName);


      const info = users.filter(x => {

        return x.name === selectedName;

      });


      setCurrentChatInfo(
        info.length > 0
          ? info[0]
          : null
      );

    } else {

      setCurrentChat(null);

      setCurrentChatInfo(null);

    }

  }, [FilteredUsers]);


  // =========================================================
  // LOAD CHAT ID
  // =========================================================

  useEffect(() => {

    async function loadChat() {

      if (!name || !currentChat) {
        return;
      }


      // Убираем старый chatId,
      // пока получаем ID нового чата.
      setChatId(null);


      const id = await fetchChatId(
        name,
        currentChat,
        currentChatInfo
      );


      if (id) {

        console.log(
          '💬 CHAT ID:',
          id,
          'CHAT:',
          currentChat
        );

        setChatId(id);

      }

    }


    loadChat();

  }, [
    currentChat,
    name,
    currentChatInfo
  ]);


  // =========================================================
  // LOAD MESSAGES
  // =========================================================

  useEffect(() => {

    async function loadMessages() {

      if (!chatId) {

        setMessages([]);

        return;

      }


      console.log(
        '📥 Loading messages for chat:',
        chatId
      );


      const history =
        await fetchMessages(chatId);


      setMessages(history);

    }


    loadMessages();

  }, [chatId]);


  // =========================================================
  // AUTO SCROLL
  // =========================================================

  useEffect(() => {

    if (messagesWindow.current) {

      messagesWindow.current.scrollTop =
        messagesWindow.current.scrollHeight;

    }

  }, [messages]);


  // =========================================================
  // CALL AUDIO STREAM
  // =========================================================

  useEffect(() => {

    if (
      audioRef.current &&
      callStream
    ) {

      audioRef.current.srcObject =
        callStream;

    }

  }, [callStream]);


  // =========================================================
  // LEAVE ON PAGE CLOSE
  // =========================================================

  useEffect(() => {

    const handleBeforeUnload = () => {

      navigator.sendBeacon(
        `${apiURL}/leave`,
        JSON.stringify({
          name
        })
      );

    };


    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );


    return () => {

      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      );

    };

  }, [name]);


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="chat-container">

      {/* =====================================================
          PROGRESS / ERROR
      ====================================================== */}

      <Progress
        loading={loading}
        error={error}
      />


      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <div className="sidebar">

        <Sidebar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}

          users={users}

          handleSendMessage={wsSendMessage}

          name={name}

          chatId={chatId}

          currentChatInfo={currentChatInfo}

          sideBarOpen={sideBarOpen}
        />


        <User_List
          FilteredUsers={FilteredUsers}

          setCurrentChat={setCurrentChat}

          chatsInfo={users}

          setCurrentChatInfo={setCurrentChatInfo}

          chatId={chatId}

          name={name}

          Sidebar={sideBarOpen}
        />

      </div>


      {/* =====================================================
          CHAT AREA
      ====================================================== */}

      {currentChat && (

        <div className="chat-area">


          {/* =================================================
              CHAT HEADER
          ================================================== */}

          <ChatHeader
            currentChat={currentChat}

            setSideBarOpen={setSideBarOpen}

            sideBarOpen={sideBarOpen}
          />


          {/* =================================================
              MESSAGES
          ================================================== */}

          <Messages
            ref={messagesWindow}

            messages={messages}

            name={name}

            handleSendMessage={wsSendMessage}

            setNewMessage={setNewMessage}

            setEditingMsgId={setEditingMsgId}
          />


          {/* =================================================
              CHAT INPUT
          ================================================== */}

          <div className="chat-input">

            <InputField

              newMessage={newMessage}

              setNewMessage={setNewMessage}

              displayButtons={
                setDialogButtons
              }

              handleSendMessage={
                wsSendMessage
              }

              editingMsgId={
                editingMsgId
              }

              setEditingMsgId={
                setEditingMsgId
              }

              wsSendMessage={
                wsSendMessage
              }

              name={name}

              chatId={chatId}

              displayButtonsIndex={
                dialogButtons
              }

              startCall={startCall}

              endCall={endCall}

              inCall={inCall}

            />

          </div>


          {/* =================================================
              CALL AUDIO
          ================================================== */}

          <audio
            ref={audioRef}
            autoPlay
          />

        </div>

      )}

    </div>

  );

}


export default Home;