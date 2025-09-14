const apiURL = process.env.NEXT_PUBLIC_API_URL


async function fetchChatId(name, user1, currentChatInfo) {
  try {
    const response = await fetch(`${apiURL}/get_or_create_chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: name, name: user1, chatInfo: currentChatInfo }),
      credentials: 'include',
    });

    if (!response.ok) throw new Error("Failed to receive chat_id");

    const data = await response.json();
    return data.chat_id;

  } catch (error) {
    console.warn("Error by receiving chat_id:", error);
    return null;
  }
}

export default fetchChatId