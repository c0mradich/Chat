import { InputButtons } from "./InputfButtons";
export function InputField({
  newMessage,
  setNewMessage,
  handleSendMessage,
  editingMsgId,
  setEditingMsgId,
  wsSendMessage,
  name,
  chatId,
  displayButtons,
  displayButtonsIndex,
}){  const onKeyDown = (e) => {
    if (e.key === 'Enter' && newMessage.trim()) {
      if (editingMsgId !== null) {

        handleSendMessage({ id: editingMsgId, text: newMessage }, 'edit_msg');
        setEditingMsgId(null);
      } else {
        handleSendMessage(newMessage, 'send_message');
      }
      setNewMessage('');
    }
  };

  return (
    <div className="input-layer">
      <input
        type="text"
        value={newMessage}
        onChange={(e) => {
          const val = e.target.value
          setNewMessage(val)
          if (val.length>=1){
            displayButtons(1)
          }else{
            displayButtons(0)
          }
        }}
        onKeyDown={onKeyDown}
        placeholder="Type a message..."
      />
      <InputButtons
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        handleSendMessage={wsSendMessage}
        sender={name}
        chatId={chatId}
        displayButtonsIndex={displayButtonsIndex}
      />
    </div>
  );
}