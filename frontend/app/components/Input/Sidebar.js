import OptionsMenu from "../Backend/group_chat"
import  fetchChatId  from "../Backend/fetchChatId";
import { useCallback } from "react";

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
  Sidebar
}) {

const handleClick = async (user) => {
  setCurrentChat(user.name);

  // Для существующей группы поиск личного чата не нужен
  if (user.isGroup) {
    setCurrentChatInfo({
      id: user.id,
      userId: null,
      name: user.name,
      isGroup: true,
      chatParticipants: user.chatParticipants
    });
    return;
  }

  // Сначала сохраняем выбранного собеседника
  setCurrentChatInfo({
    id: null,
    userId: user.userId,
    name: user.name,
    isGroup: false,
    chatParticipants: user.chatParticipants
  });

  try {
    const chatId = await fetchChatId(user.userId);

    setCurrentChatInfo({
      id: chatId,
      userId: user.userId,
      name: user.name,
      isGroup: false,
      chatParticipants: user.chatParticipants
    });
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
          <span className={"avatar"} aria-hidden="true">
            {user.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
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