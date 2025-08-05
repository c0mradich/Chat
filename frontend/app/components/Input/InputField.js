export function InputField({ newMessage, setNewMessage, handleSendMessage, editingMsgId, setEditingMsgId }) {
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
    <input
      type="text"
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder="Напишите сообщение..."
    />
  );
}