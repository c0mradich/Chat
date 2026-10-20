import React from "react";

const apiURL = process.env.NEXT_PUBLIC_API_URL


export function Progress({ loading, error, statusOverlay: StatusOverlay }) {
  return <StatusOverlay loading={loading} error={error} />;
}


export async function getId() {
const res = await fetch(`${apiURL}/me`, {
  credentials: 'include',  // отправляем куки на сервер
});
const data = await res.json();
return data
}

export async function redirect(setName) {
  const data = await getId(); // ждем ответа с сервера
  alert(data)

  if (!data.user_id) {
    // Пользователь не авторизован
    window.location.href = '/login';
  } else {
    setName(data.username);
    return data.username
  }
}

export function leave(name) {
  return fetch(`${apiURL}/leave`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name })
  });
}

export function ChatHeader({currentChat, setSideBarOpen, sideBarOpen, startCall, endCall, inCall}){
    return(
        <div className="chat-header">
            <span>{currentChat || "Select a user"}</span> <span onClick={()=>{setSideBarOpen(!sideBarOpen)}} className="hamburger">&#9776;</span>
            <button className="call-btn" onClick={inCall ? endCall : startCall}>{inCall ? '🔴' : '📞'}</button>
        </div>
    )
}