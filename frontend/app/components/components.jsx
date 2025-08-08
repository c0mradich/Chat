import React from "react";

export function Progress({ loading, error }) {
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return null;
}

export async function getId() {
const res = await fetch('http://localhost:5000/me', {
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
  fetch("http://localhost:5000/leave", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name })
  })
}


export function ChatHeader({currentChat}){
    return(
        <div className="chat-header">
            <span>Chat with {currentChat || "Select a user"}</span>
        </div>
    )
}