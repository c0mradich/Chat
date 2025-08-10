import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function OptionsMenu({ users, handleSendMessage, name, currentChatInfo }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [chatName, setChatName] = useState("");
  const groupModalRef = useRef(null)
  const addUserModelRef = useRef(null)
  const menuRef = useRef(null)
    const resetState = () => {
    setShowCreateGroupModal(false);
    setShowAddUserModal(false);
    setSelectedUsers([]);
    setChatName("");
    setIsOpen(false);
  };

  const toggleUser = (userName) => {
    setSelectedUsers((prev) =>
      prev.includes(userName)
        ? prev.filter((name) => name !== userName)
        : [...prev, userName]
    );
  };



  const handleCreateGroup = () => {
    if (chatName && selectedUsers.length > 0) {
      handleSendMessage({ users: selectedUsers, name: chatName }, "create_group");
      console.warn(selectedUsers)
    }
    resetState();
  };

  const handleAddUser = () => {
    console.log(currentChatInfo)
    if (selectedUsers.length > 0 && currentChatInfo?.id) {
      handleSendMessage({ users: selectedUsers, chat_id: currentChatInfo.id, participants: currentChatInfo.chatParticipants}, "add_user_to_group");
      console.log("Отправил add_user с чат айди");
    }
    resetState();
  };

  useEffect(() => {
    function handleClickOutside(event) {
      // Если меню открыто, и клик произошёл вне меню
      if (isOpen && menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(()=>{
    function handleCreateGroupModulEnterClick(event){
      if(showCreateGroupModal && groupModalRef.current && event.key=="Enter"){
        groupModalRef.current.click()
      }
    }

    document.addEventListener("keydown", handleCreateGroupModulEnterClick)
    return ()=>{
      document.removeEventListener("keyDown", handleCreateGroupModulEnterClick)
    }
  }, [showCreateGroupModal])

    useEffect(()=>{
    function handleAddUserEnterClick(event){
      if(showCreateGroupModal && groupModalRef.current && event.key=="Enter"){
        addUserModelRef.current.click()
      }
    }

    document.addEventListener("keydown", handleAddUserEnterClick)
    return ()=>{
      document.removeEventListener("keyDown", handleAddUserEnterClick)
    }
  }, [showAddUserModal])

  return (
    <div className="relative inline-block text-left">
      {/* Троеточие */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 rounded-full hover:bg-gray-200 transition"
        aria-label="More options"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {/* Меню с двумя кнопками */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-48 rounded-2xl shadow-lg z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <div className="p-2">
              <button
                onClick={() => {
                  setShowCreateGroupModal(true);
                  setIsOpen(false);
                }}
                className="w-full text-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              >
                Create Group Chat
              </button>

              <button
                onClick={() => {
                  if (currentChatInfo?.isGroup) {
                    setShowAddUserModal(true);
                  }
                  setIsOpen(false);
                }}
                className="w-full text-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl mt-1">
                Add User
              </button>
              <Link href="/personalSettings" passHref>
                <button className="w-full block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
                  Personal Data
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модал для создания группы */}
      <AnimatePresence>
        {showCreateGroupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl w-full max-w-md"
            >
              <h2 className="text-lg font-semibold mb-4">Create Group Chat</h2>

              <input
                type="text"
                placeholder="Group name"
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                className="w-full p-2 mb-4 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none"
              />

              <div className="max-h-40 overflow-y-auto mb-4">
                {users
                  .filter((user) => user.name !== name && !user.isGroup)
                  .map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center space-x-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.name)}
                        onChange={() => {
                          toggleUser(user.name)}}
                        className="accent-blue-500"
                      />
                      <span>{user.name}</span>
                    </label>
                  ))}
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={resetState}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  ref={groupModalRef}
                  onClick={handleCreateGroup}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модал для добавления пользователя */}
      <AnimatePresence>
        {showAddUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl w-full max-w-md"
            >
              <h2 className="text-lg font-semibold mb-4">Add User</h2>

              <div className="max-h-40 overflow-y-auto mb-4">
                {users
                  .filter((user) => 
                    user.name !== name &&
                    !user.isGroup &&
                    !currentChatInfo.chatParticipants?.includes(user.name)
                  )
                  .map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center space-x-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.name)}
                        onChange={() => toggleUser(user.name)}
                        className="accent-blue-500"
                      />
                      <span>{user.name}</span>
                    </label>
                  ))}

              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={resetState}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  ref={addUserModelRef}
                  onClick={handleAddUser}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  Add
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
