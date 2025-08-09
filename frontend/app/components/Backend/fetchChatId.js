async function fetchChatId(name, user1, currentChatInfo) {
  try {
    const response = await fetch('http://localhost:5000/get_or_create_chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: name, name: user1, chatInfo: currentChatInfo }),
      credentials: 'include',
    });

    if (!response.ok) throw new Error("Не удалось получить chat_id");

    const data = await response.json();
    return data.chat_id;

  } catch (error) {
    console.warn("Ошибка получения chat_id:", error);
    return null;
  }
}

export default fetchChatId