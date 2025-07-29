export async function sendMessage(chat_id, sender, text = '') {
  console.log(`chat_id: ${chat_id}, sender: ${sender}, text: ${text}`)
  try {
    const response = await fetch('http://localhost:5000/send_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        "chat_id":chat_id,
        "sender":sender,
        "text":text
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('Ошибка при отправке:', errData);
    }

  } catch (err) {
    console.error('Ошибка сети при отправке сообщения:', err);
  }
}
