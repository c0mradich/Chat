import OptionsMenu from "../Backend/group_chat"
import  fetchChatId  from "../Backend/fetchChatId";
import { useCallback } from "react";

const apiURL = process.env.NEXT_PUBLIC_API_URL;

export function Sidebar({ searchQuery,setSearchQuery, users, handleSendMessage, name, currentChatInfo, sideBarOpen, requestUserList}){
    return (
        <div className={`search-container ${sideBarOpen?'':'close'}`}>
          <input
            type="text"
            className="search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <OptionsMenu users={users} handleSendMessage={handleSendMessage} name={name}  currentChatInfo={currentChatInfo}/>
        </div>
    )
}

export function User_List({
  FilteredUsers,
  setCurrentChat,
  currentChat,
  chatsInfo,
  setCurrentChatInfo,
  name,
  Sidebar,
  setSidebarOpen
}) {

const handleClick = async (user) => {
  setCurrentChat(user.name);

  const chatInfo = {
    id: user.isGroup ? user.id : null,
    userId: user.isGroup ? null : user.userId,
    name: user.name,
    avatar: user.avatar,
    isGroup: user.isGroup,
    chatParticipants: user.chatParticipants
  };

  // Сразу показываем выбранный чат
  setCurrentChatInfo(chatInfo);
  setSidebarOpen(false)

  // Для группы больше ничего делать не нужно
  if (user.isGroup) return;

  try {
    const chatId = await fetchChatId(user.userId);

    setCurrentChatInfo(prev =>
      prev?.userId === user.userId
        ? { ...prev, id: chatId }
        : prev
    );
  } catch (error) {
    console.error('Не удалось найти чат:', error);
  }
};


  return (
    <div className={`user-list ${Sidebar ? '' : 'close'}`}>
      {FilteredUsers && FilteredUsers.map(user => (
        <div
          key={user.id || user.name}
          className={`user-item ${currentChat === user.name ? 'active' : ''}`}
          onClick={() => handleClick(user)}
        >
        {user.avatar ? (
          <img
            src={`${apiURL}/${user.avatar}`}
            alt=""
            className="avatar"
          />
        ) : (
          <span className="avatar" aria-hidden="true">
            {user.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
          {user.name}
        </div>
      ))}
    </div>
  );
}



export function filteredUsers(users, searchQuery, name) {
  return users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    user.name.toLowerCase() !== name.toLowerCase()
  );
}

export function useHandleUserClick(setCurrentUser) {
  return useCallback((userName) => {
    setCurrentUser(userName);
  }, [setCurrentUser]);
}

  export async function fetchUsers (name, requestUserList) {
    requestUserList(name);
  };