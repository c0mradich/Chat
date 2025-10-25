import { InputButtons } from "./InputfButtons";
export function InputField({ newMessage, setNewMessage, handleSendMessage, editingMsgId, setEditingMsgId, wsSendMessage, name, chatId, displayButtons, displayButtonsIndex }) {
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && newMessage.trim()) {
      if (editingMsgId !== null) {
        // редактирование
        handleSendMessage({ id: editingMsgId, text: newMessage }, 'edit_msg');
        setEditingMsgId(null);  // сбрасываем режим редактирования
      } else {
        // обычное сообщение
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
        placeholder="Напишите сообщение..."
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