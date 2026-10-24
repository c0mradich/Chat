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

export function ChatHeader({currentChatInfo, setSideBarOpen, sideBarOpen, startCall, endCall, inCall, callStatus, incomingCall, answerCall, rejectCall}){
    return(
    <div className="chat-header">
      <div className="ChatHeaderInfo">
        <button
          type="button"
          onClick={() => setSideBarOpen(!sideBarOpen)}
          className="hamburger"
          aria-label={sideBarOpen ? "Закрыть список чатов" : "Открыть список чатов"}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

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

        <span className="UserHeaderInfo">
          {currentChatInfo.name || "Select a user"}
        </span>
      </div>

      {incomingCall && (
        <div className="incoming-call">
          <span>Входящий звонок: {incomingCall.peerName}</span>

          <button
            className="accept-call"
            onClick={answerCall}
          >
            Принять
          </button>

          <button
            className="reject-call"
            onClick={rejectCall}
          >
            Отклонить
          </button>
        </div>
      )}

      <button
        className="call-btn"
        onClick={callStatus === 'idle' ? startCall : endCall}
        disabled={
          callStatus === 'ringing' ||
          callStatus === 'connecting' ||
          callStatus === 'disconnected'
        }
      >
        {callStatus === 'idle' ? '📞' : '🔴'}
      </button>
    </div>
    )
}