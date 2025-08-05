from flask_socketio import join_room, leave_room, emit
from flask import request
from .db import db, Message, User, ChatParticipant, Chat
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
        sender_name = data['sender']
        text = data['text']

        # Ищем пользователя по имени
        user = User.query.filter_by(name=sender_name).first()
        if not user:
            emit('error', {'message': 'Пользователь не найден'}, room=request.sid)
            return

        # Сохраняем сообщение с sender_id
        msg = Message(chat_id=chat_id, sender_id=user._id, text=text)
        db.session.add(msg)
        db.session.commit()

        emit('receive_message', {
            'id': msg._id,
            'sender': sender_name,
            'text': text,
            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }, room=chat_id)


    @socketio.on("send_file")
    def handle_send_file(data):
        content = data['text']
        file_base64 = content["file"]
        filename = content['name']
        sender = data['sender']
        user = User.query.filter_by(name=sender).first()
        if not user:
            emit('error', {'message': 'Пользователь не найден'}, room=request.sid)
            return

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
        msg = Message(chat_id=chat_id, sender_id=user._id, text=f'/uploads/{hashed_filename}')
        db.session.add(msg)
        db.session.commit()

        # Собираем data URL для отправки клиентам
        mime_type = get_mime_type_from_extension(os.path.splitext(filename)[1])
        data_url = f"data:{mime_type};base64,{file_base64}"

        emit('receive_message', {
            'id': msg._id,
            'sender': sender,
            'text': hashed_filename,
            'content': data_url,
            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }, room=chat_id)

    @socketio.on("delete_msg")
    def handleDeleteMsg(data):
        content = data['text']['selectedMsg']
        id = content['id']
        chat_id = data['chat_id']
        msg = Message.query.get(id)
        if msg:
            db.session.delete(msg)
            db.session.commit()
            emit(
                'deleted_message', {
                    'id': msg._id
                }, room=chat_id
            )
    @socketio.on("edit_msg")
    def editing_msg(data):
        msg_id = data["text"]["id"]
        chat_id = data["chat_id"]
        new_text = data["text"]["text"]
        msg = Message.query.get(msg_id)
        if msg:
            msg.text = new_text
            db.session.commit()
            emit('edit_msg', {
                'id': msg._id,
                'text': new_text,
            }, room=chat_id)

    @socketio.on("get_userlist")
    def get_users_and_chats(data):
        # print(data)
        try:
            user_name = data['text']['name']
            # Найти пользователя по имени
            user = User.query.filter_by(name=user_name).first()
            if not user:
                emit('get_user_chats', {"error": "Пользователь не найден"}, to=request.sid)
                return

            # Все чаты, где участвует пользователь
            matching_participants = ChatParticipant.query.filter_by(user_id=user._id).all()
            chat_ids = [p.chat_id for p in matching_participants]
            user_chats = Chat.query.filter(Chat._id.in_(chat_ids)).all()

            chat_list = []
            existing_chat_user_ids = set()

            # Собрать реальные чаты и участников
            for chat in user_chats:
                participants = ChatParticipant.query.filter_by(chat_id=chat._id).all()
                participant_names = []
                for p in participants:
                    if p.user:
                        participant_names.append(p.user.name)
                        if p.user._id != user._id:
                            existing_chat_user_ids.add(p.user._id)

                chat_list.append({
                    "id": chat._id,
                    "name": chat.name,
                    "is_group": chat.is_group,
                    "creator_id": chat.creator_id,
                    "participants": participant_names
                })

            # Найти всех остальных юзеров, кроме текущего
            all_other_users = User.query.filter(User._id != user._id).all()

            # Добавить виртуальные чаты для юзеров, с которыми ещё нет чатов
            for rec_user in all_other_users:
                if rec_user._id not in existing_chat_user_ids:
                    chat_list.append({
                        "id": None,  # виртуальный чат
                        "name": rec_user.name,
                        "is_group": False,
                        "creator_id": None,
                        "participants": [rec_user.name, user.name]
                    })

            # Отправка всех чатов
            emit('get_user_chats', {"name": user_name, "chats": chat_list}, to=request.sid)

        except Exception as e:
            print(f"Ошибка в get_users_and_chats: {e}")
            emit('get_user_chats', {"error": "Внутренняя ошибка"}, to=request.sid)



    
    @socketio.on("create_group")
    def create_group(data):
        print(data["text"]["users"])

        creator_name = data.get('sender')
        creator = User.query.filter_by(name=creator_name).first()

        if creator is None:
            print(f"Ошибка: пользователь с именем '{creator_name}' не найден")
            return

        creator_id = creator._id

        user_names = data.get('text', {}).get('users', [])
        chatname = data.get('text', {}).get('name', '').strip()

        if not isinstance(user_names, list) or not all(isinstance(name, str) for name in user_names):
            print(f"Ошибка: некорректный список имён пользователей: {user_names}")
            return

        # Добавим создателя в список участников
        participants_names = set(user_names)
        participants_names.add(creator_name)

        # Получаем пользователей по именам
        users = User.query.filter(User.name.in_(participants_names)).all()
        found_names = set(user.name for user in users)

        # Проверим, всех ли нашли
        missing_names = participants_names - found_names
        if missing_names:
            print(f"Ошибка: следующие пользователи не найдены: {missing_names}")
            return

        # Сопоставим имена → ID
        name_to_id = {user.name: user._id for user in users}

        if chatname == "":
            chatname = f"Группа от {creator_name}"

        # Создаем чат
        new_chat = Chat(is_group=True, name=chatname, creator_id=creator_id)
        db.session.add(new_chat)
        db.session.flush()  # теперь у new_chat есть _id

        # Добавляем участников в чат
        for user_name in participants_names:
            user_id = name_to_id[user_name]
            db.session.add(ChatParticipant(chat_id=new_chat._id, user_id=user_id))

        db.session.commit()

        print(f"Группа '{chatname}' успешно создана с участниками: {participants_names}")

        # emit('get_user_chats', {
            
        # })

        @socketio.on("add_user")
        def add_user_to_group(data):
            print(data)