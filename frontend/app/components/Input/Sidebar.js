import OptionsMenu from "../Backend/group_chat"
import  fetchChatId  from "../Backend/fetchChatId";
import { useCallback } from "react";

export function Sidebar({ searchQuery,setSearchQuery, users, handleSendMessage, name, chatId, currentChatInfo, sideBarOpen}){
    return (
        <div className={`search-container ${sideBarOpen?'':'close'}`}>
          <input
            type="text"
            className="search-input"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <OptionsMenu users={users} handleSendMessage={handleSendMessage} name={name}  currentChatInfo={currentChatInfo}/>
        </div>
    )
}

export function User_List({ FilteredUsers, setCurrentChat, chatsInfo, setCurrentChatInfo, chatId, name, Sidebar }) {
  const handleClick = async (user) => {
    setCurrentChat(user.name);
    const chat = chatsInfo.find(chat => chat.name === user.name);

    if (user.id === null) {
      user.id = await fetchChatId(name, user.name, chat);
    }

    chat && setCurrentChatInfo(chat);
  };

  return (
    <div className={`user-list ${Sidebar?'':'close'}`}>
      {FilteredUsers && FilteredUsers.map(user => (
        <div
          key={user.id || user.name}
          className="user-item"
          onClick={() => handleClick(user)}
        >
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

  export async function fetchUsers (name, handleSendMessage) {
          handleSendMessage({"name":name}, 'get_userlist')
  };