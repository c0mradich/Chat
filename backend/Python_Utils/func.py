import hashlib, os

def generate_file_hash(original_name, sender, chat_id, timestamp):
    # Составляем строку для хеширования
    data_string = f"{original_name}{sender}{chat_id}{timestamp}"
    # Генерим SHA-256 хеш
    hash_object = hashlib.sha256(data_string.encode())
    hash_hex = hash_object.hexdigest()  # Строка длиной 64 символа
    # Отделяем расширение файла
    ext = os.path.splitext(original_name)[1]  # ".jpg", ".png", ...
    # Собираем финальное имя файла
    return f"{hash_hex}{ext}"