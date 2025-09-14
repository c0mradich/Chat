// ./components/fetchMessages.js
const apiURL = process.env.NEXT_PUBLIC_API_URL

export async function fetchMessages(chatId) {
  const response = await fetch(`${apiURL}/get_messages/${chatId}`, {
    credentials: 'include'
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch messages');
  }
  const { messages } = await response.json();
  return messages; // возвращаем массив сообщений
}
