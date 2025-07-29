// ./components/fetchMessages.js
export async function fetchMessages(chatId) {
  const response = await fetch(`http://localhost:5000/get_messages/${chatId}`, {
    credentials: 'include'
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch messages');
  }
  const { messages } = await response.json();
  return messages; // возвращаем массив сообщений
}
