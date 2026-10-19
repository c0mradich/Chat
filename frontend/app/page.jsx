'use client';
import React,{useState,useEffect,useRef}from 'react';
import './css/chat.css';
import {Progress,ChatHeader,redirect}from './components/components';
import {Sidebar,User_List,filteredUsers,useHandleUserClick,fetchUsers}from './components/Input/Sidebar';
import {Messages}from './components/Input/Messages';
import {InputField}from './components/Input/InputField';
import {fetchMessages}from './components/Backend/fetchMessages';
import fetchChatId from './components/Backend/fetchChatId';
import {useChat}from './components/Backend/useChat';
import {useCall}from './components/Backend/useCall';

const apiURL=process.env.NEXT_PUBLIC_API_URL;

function Home(){
  const[name,setName]=useState(null);
  const[messages,setMessages]=useState([]);
  const[newMessage,setNewMessage]=useState('');
  const[searchQuery,setSearchQuery]=useState('');
  const[users,setUsers]=useState([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[currentChat,setCurrentChat]=useState(null);
  const[FilteredUsers,setFilteredUsers]=useState([]);
  const[chatId,setChatId]=useState(null);
  const[editingMsgId,setEditingMsgId]=useState(null);
  const[chatsInfo,setChatsInfo]=useState([]);
  const[currentChatInfo,setCurrentChatInfo]=useState({});
  const[sideBarOpen,setSideBarOpen]=useState(true);
  const[dialogButtons,setDialogButtons]=useState(0);

  const messagesWindow=useRef(null);
  const audioRef=useRef(null);

  const handleUserClick=useHandleUserClick(setCurrentChat);

  const{sendMessage:wsSendMessage,socket:wsSocket,socketConnected}=useChat(
    chatId,name,
    msg=>setMessages(prev=>[...prev,msg]),
    id=>setMessages(prev=>prev.filter(m=>m.id!==id)),
    msg=>setMessages(prev=>prev.map(m=>m.id===msg.id?{...m,text:msg.text}:m)),
    setUsers,setLoading,setChatsInfo,users, setDialogButtons
  );

  useEffect(()=>{if(name&&socketConnected)fetchUsers(name,wsSendMessage);},[name,socketConnected]);

  const{startCall,endCall,callStream,inCall}=useCall(wsSocket,chatId,name);

  useEffect(()=>{redirect(setName);},[]);

  useEffect(()=>{
    setFilteredUsers(filteredUsers(users,searchQuery,name));
  },[users,searchQuery,name]);

  useEffect(()=>{
    if(FilteredUsers.length){
      const selected=FilteredUsers[0].name;
      setCurrentChat(selected);
      const info=users.find(u=>u.name===selected);
      setCurrentChatInfo(info||null);
    }else{
      setCurrentChat(null);
      setCurrentChatInfo(null);
    }
  },[FilteredUsers]);

  useEffect(()=>{
    async function loadChat(){
      if(!name||!currentChat)return;
      setChatId(null);
      const id=await fetchChatId(name,currentChat,currentChatInfo);
      if(id)setChatId(id);
    }
    loadChat();
  },[currentChat,name,currentChatInfo]);

  useEffect(()=>{
    async function loadMessages(){
      if(!chatId){setMessages([]);return;}
      const history=await fetchMessages(chatId);
      setMessages(history);
    }
    loadMessages();
  },[chatId]);

  useEffect(()=>{
    if(messagesWindow.current)
      messagesWindow.current.scrollTop=messagesWindow.current.scrollHeight;
  },[messages]);

  useEffect(()=>{
    if(audioRef.current&&callStream)
      audioRef.current.srcObject=callStream;
  },[callStream]);

  useEffect(()=>{
    const handleBeforeUnload=()=>{
      navigator.sendBeacon(`${apiURL}/leave`,JSON.stringify({name}));
    };
    window.addEventListener('beforeunload',handleBeforeUnload);
    return()=>window.removeEventListener('beforeunload',handleBeforeUnload);
  },[name]);

  return(
    <div className="chat-container">
      <Progress loading={loading}error={error}/>
      <div className="sidebar">
        <Sidebar searchQuery={searchQuery}setSearchQuery={setSearchQuery}users={users}
          handleSendMessage={wsSendMessage}name={name}chatId={chatId}
          currentChatInfo={currentChatInfo}sideBarOpen={sideBarOpen}/>
        <User_List FilteredUsers={FilteredUsers}setCurrentChat={setCurrentChat}
          chatsInfo={users}setCurrentChatInfo={setCurrentChatInfo}
          chatId={chatId}name={name}Sidebar={sideBarOpen}/>
      </div>

      {currentChat&&(
        <div className="chat-area">
          <ChatHeader currentChat={currentChat}setSideBarOpen={setSideBarOpen}sideBarOpen={sideBarOpen}/>
          <Messages ref={messagesWindow}messages={messages}name={name}
            handleSendMessage={wsSendMessage}setNewMessage={setNewMessage}
            setEditingMsgId={setEditingMsgId}/>
          <div className="chat-input">
            <InputField newMessage={newMessage}setNewMessage={setNewMessage}
              displayButtons={setDialogButtons}handleSendMessage={wsSendMessage}
              editingMsgId={editingMsgId}setEditingMsgId={setEditingMsgId}
              wsSendMessage={wsSendMessage}name={name}chatId={chatId}
              displayButtonsIndex={dialogButtons}startCall={startCall}
              endCall={endCall}inCall={inCall}/>
          </div>
          <audio ref={audioRef}autoPlay/>
        </div>
      )}
    </div>
  );
}

export default Home;