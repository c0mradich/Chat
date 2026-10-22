const apiURL = process.env.NEXT_PUBLIC_API_URL;

export async function handleFileChange(e, sender, chatId, handleSendMessage) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("sender", sender);
  formData.append("chatId", chatId);

  try {
    const res = await fetch(`${apiURL}/uploads`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const data = await res.json();
    console.log("Upload result:", data);

    handleSendMessage(
      { path: data.path, name: file.name, type: file.type },
      "send_file"
    );
  } catch (err) {
    console.error("Ошибка при загрузке файла:", err);
  }
}