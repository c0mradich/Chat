import React from "react";

const apiURL = process.env.NEXT_PUBLIC_API_URL

export function Progress({ loading, error }) {
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return null;
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

  if (!data.user_id) {
    // Пользователь не авторизован
    window.location.href = '/login';
  } else {
    setName(data.username);
    return data.username
  }
}

export function leave(name) {
  fetch(`${apiURL}/leave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name })
  })
}


export function ChatHeader({currentChat, setSideBarOpen, sideBarOpen}){
    return(
        <div className="chat-header">
            <span>Chat with {currentChat || "Select a user"}</span> <span onClick={()=>{setSideBarOpen(!sideBarOpen)}} className="hamburger">&#9776;</span>
        </div>
    )
}