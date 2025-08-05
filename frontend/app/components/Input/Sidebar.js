import OptionsMenu from "../Backend/group_chat"
import { fetchChatId } from "../Backend/fetchChatId";
import { useCallback } from "react";

export function Sidebar({ searchQuery,setSearchQuery, users, handleSendMessage, name }){
    return (
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <OptionsMenu users={users} handleSendMessage={handleSendMessage} name={name}/>
        </div>
    )
}

export function User_List({ FilteredUsers, setCurrentChat, chatsInfo, setCurrentChatInfo, chatId, name }) {
  const handleClick = async (user) => {
    setCurrentChat(user.name);
    const chat = chatsInfo.find(chat => chat.name === user.name);

    if (user.id === null) {
      user.id = await fetchChatId(name, user.name, chat);
      console.warn(user.id)
    }

    chat && setCurrentChatInfo(chat);
  };

  return (
    <div className="user-list">
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

  export async function fetchUsers (url, setData, setUsers, setCurrentChat, setError, setLoading, name, handleSendMessage) {
          handleSendMessage({"name":name}, 'get_userlist')
    // try {
    //   const response = await fetch(url);
    //   if (!response.ok) {
    //     throw new Error('Failed to fetch users');
    //   }

    //   const fetchedData = await response.json();
    //   setData(fetchedData);
    //   setUsers(fetchedData);

    //   if (fetchedData.length > 0 && fetchedData[0].name!==name) {
    //     setCurrentChat(fetchedData[0].name);
    //   } else {
    //     setCurrentChat(null);
    //   }

    //   setLoading(false);
    // } catch (error) {
    //   setError(error.message);
    //   setLoading(false);
    // }
  };