
const apiURL = process.env.NEXT_PUBLIC_API_URL;

export async function changeAvatar(e, username) {
  const file = e.target.files?.[0];

  if (!file) {
    return { success: false, message: "Файл не выбран." };
  }

  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif"];
  const extension = file.name.split(".").pop()?.toLowerCase();

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  // Проверяем формат
  if (
    !allowedExtensions.includes(extension) ||
    !allowedMimeTypes.includes(file.type)
  ) {
    return {
      success: false,
      message: "Неподдерживаемый формат изображения.",
    };
  }

  const image = new Image();
  const imageUrl = URL.createObjectURL(file);

  // Проверяем размеры изображения
  const isValidImage = await new Promise((resolve) => {
    image.onload = () => {
      const { width, height } = image;
      URL.revokeObjectURL(imageUrl);

      if (width < 100 || height < 100) {
        resolve({
          valid: false,
          message: `Изображение слишком маленькое: ${width}x${height}. Минимум 100x100.`,
        });
        return;
      }

      if (width / height >= 2.5 || height / width >= 2.5) {
        resolve({
          valid: false,
          message: `Неподходящие пропорции изображения: ${width}x${height}.`,
        });
        return;
      }

      resolve({ valid: true });
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      resolve({
        valid: false,
        message: "Не удалось загрузить изображение.",
      });
    };

    image.src = imageUrl;
  });

  if (!isValidImage.valid) {
    return {
      success: false,
      message: isValidImage.message,
    };
  }

  // Отправляем аватар на сервер
  const formData = new FormData();
  formData.append("avatar", file);
  formData.append("username", username);

  try {
    const res = await fetch(`${apiURL}/changeAvatar`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!res.ok) {
      return {
        success: false,
        message: `Не удалось сохранить аватар. Код ошибки: ${res.status}.`,
      };
    }

    const data = await res.json();
    const path = data.path

    return {
      success: true,
      message: data.message || "Аватар успешно сохранён.",
      data
    };
  } catch {
    return {
      success: false,
      message: "Не удалось связаться с сервером.",
    };
  }
}
