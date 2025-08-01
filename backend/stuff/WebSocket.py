from flask_socketio import join_room, leave_room, emit
from flask import request
from .db import db, Message
import hashlib, os
from datetime import datetime
import base64
from .routes import get_mime_type_from_extension

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

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




def register_socket_handlers(socketio):
    @socketio.on('connect')
    def on_connect():
        print('Client connected:', request.sid)

    @socketio.on('join')
    def on_join(data):
        chat_id = data['chat_id']
        join_room(chat_id)
        print(f"{request.sid} joined room {chat_id}")

    @socketio.on('leave')
    def on_leave(data):
        chat_id = data['chat_id']
        leave_room(chat_id)
        print(f"{request.sid} left room {chat_id}")

    @socketio.on('send_message')
    def handle_send_message(data):
        chat_id = data['chat_id']
        sender  = data['sender']
        text    = data['text']
        msg = Message(chat_id=chat_id, sender=sender, text=text)
        db.session.add(msg)
        db.session.commit()
        emit('receive_message', {
            'id': msg.id,
            'sender': sender,
            'text': text,
            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }, room=chat_id)

    @socketio.on("send_file")
    def handle_send_file(data):
        content = data['text']
        file_base64 = content["file"]
        filename = content['name']
        sender = data['sender']
        chat_id = data['chat_id']
        timestamp = datetime.utcnow().isoformat()
        
        hashed_filename = generate_file_hash(filename, sender, chat_id, timestamp)
        
        # Убираем префикс "data:...;base64," если он есть
        if file_base64.startswith("data:"):
            file_base64 = file_base64.split(",", 1)[1]
        
        file_bytes = base64.b64decode(file_base64)
        file_path = os.path.join(UPLOAD_FOLDER, hashed_filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        
        # Сохраняем путь в text
        msg = Message(chat_id=chat_id, sender=sender, text=file_path)
        db.session.add(msg)
        db.session.commit()

        # Собираем data URL для отправки клиентам
        mime_type = get_mime_type_from_extension(os.path.splitext(filename)[1])
        data_url = f"data:{mime_type};base64,{file_base64}"

        emit('receive_message', {
            'id': msg.id,
            'sender': sender,
            'text': hashed_filename,
            'content': data_url,  # вот оно
            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }, room=chat_id)
