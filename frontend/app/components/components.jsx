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

export function ChatHeader({currentChatInfo, setSideBarOpen, sideBarOpen, startCall, endCall, inCall}){
  console.log(currentChatInfo)
    return(
        <div className="chat-header">
          <div className="ChatHeaderInfo">
          {currentChatInfo.avatar ? (
            <img
                src={`${apiURL}/${currentChatInfo.avatar}`}
                alt=""
                className="avatar"
              />
            ) : (
              <span className="avatar" aria-hidden="true">
                {currentChatInfo.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
            )}
            <span className="UserHeaderInfo">{currentChatInfo.name || "Select a user"}</span>
          </div>
          <span onClick={()=>{setSideBarOpen(!sideBarOpen)}} className="hamburger">&#9776;</span>
            <button className="call-btn" onClick={inCall ? endCall : startCall}>{inCall ? '🔴' : '📞'}</button>
        </div>
    )
}