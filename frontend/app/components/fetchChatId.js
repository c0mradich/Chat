export async function fetchChatId(user1, user2) {
  try {
    const response = await fetch('http://localhost:5000/get_or_create_chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: user1, recipient: user2 }),
      credentials: 'include',
    });

    if (!response.ok) throw new Error("Не удалось получить chat_id");

    const data = await response.json();
    return data.chat_id;

  } catch (error) {
    console.error("Ошибка получения chat_id:", error);
    return null;
  }
}
