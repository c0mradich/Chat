
const apiURL = process.env.NEXT_PUBLIC_API_URL;

async function fetchChatId(otherUserId) {
  const response = await fetch(
    `${apiURL}/find_chat/${otherUserId}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Ошибка поиска чата: ${response.status}`);
  }

  return data.chat_id;
}

export default fetchChatId;
