from flask_socketio import join_room, leave_room, emit
from flask import request
from .db import db, Message, User, ChatParticipant, Chat
import hashlib, os, time
from datetime import datetime
import base64
from Python_Utils.mime import get_mime_type_from_extension
import redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
r = redis.from_url(REDIS_URL)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')


def register_socket_handlers(socketio):
    @socketio.on('connect')
    def on_connect():
        print('Client connected:', request.sid)

    @socketio.on('join')
    def on_join(data):
        try:
            name = data.get('name')
            chat_id = data.get('chat_id')
            sid = request.sid

            if not name or not chat_id:
                print("⚠️ join пропущен — нет name или chat_id")
                return

            # сохраняем связку user -> sid
            r.set(f"user:{name}", sid)

            # небольшая пауза, чтобы гарантировать, что клиент зарегистрирован
            time.sleep(0.05)

            # добавляем в комнату
            join_room(chat_id)
            print(f"✅ {name} ({sid}) вошёл в комнату {chat_id}")

            # опционально можно уведомить комнату
            emit("user_joined", {"user": name}, room=chat_id)

        except Exception as e:
            print(f"❌ Ошибка в on_join: {e}")


    @socketio.on('leave')
    def on_leave(data):
        chat_id = data.get('chat_id')
        name = data.get('name')

        if not name:
            print("Ошибка: 'name' отсутствует в данных leave")
            return 

        if not chat_id:
            print("Ошибка: 'chat_id' отсутствует в данных leave")
            return

        r.delete(f"user:{name}")
        leave_room(chat_id)


    @socketio.on('send_message')
    def handle_send_message(data):
        print("RAW DATA:", data)  # теперь точно выведет
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
        filename = data['text'].get("name")
        sender = data.get("sender")
        chat_id = data.get("chat_id")
        file_path = data['text'].get("path")  # тут уже ссылка на загруженный файл

        user = User.query.filter_by(name=sender).first()
        if not user:
            emit('error', {'message': 'Пользователь не найден'}, room=request.sid)
            return

        # Сохраняем сообщение как ссылку на файл
        msg = Message(
            chat_id=chat_id,
            sender_id=user._id,
            text=file_path  # вместо base64 просто путь
        )
        db.session.add(msg)
        db.session.commit()

        emit('receive_message', {
            'id': msg._id,
            'sender': sender,
            'text': filename,
            'content': file_path,  # фронт сам подгрузит по этому URL
            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }, room=chat_id)

    @socketio.on("delete_msg")
    def handleDeleteMsg(data):
        print("Data to delete", data)
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

                if not chat.is_group:  # 👈 только для личных чатов
                    for p in participants:
                        if p.user and p.user._id != user._id:
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

        chat_info = {
            "id": new_chat._id,
            "name": chatname,
            "is_group": True,
            "chatParticipants": list(participants_names)
        }

        for user_name in participants_names:
            sid = r.get(f'user:{user_name}')
            if sid:
                sid_str = sid.decode() if isinstance(sid, bytes) else sid
                emit('get_user_chats', {"chats": [chat_info], "name": user_name}, to=sid_str)
            else:
                print(f"Пользователь {user_name} оффлайн или sid не найден в Redis")

    @socketio.on("add_user_to_group")
    def add_user_to_group(data):
        users = data['text']['users']  # список имён пользователей
        chat_id = data['chat_id']
        participants_names = data['text']['participants']
        chatname = Chat.query.get(chat_id).name

        chat_info = {
            "id": chat_id,
            "name": chatname,
            "is_group": True,
            "chatParticipants": list(participants_names)
        }

        for user_name in users:
            existing_user = User.query.filter_by(name=user_name).first()
            if existing_user is None:
                print(f"Ошибка: пользователь {user_name} не найден")
                continue  # или return, в зависимости от логики
            user_id = existing_user._id

            # Проверка, что пользователь не в чате — лишней не будет
            already_in_chat = ChatParticipant.query.filter_by(chat_id=chat_id, user_id=user_id).first()
            if already_in_chat:
                print(f"Пользователь {user_name} уже в чате {chat_id}")
                continue

            db.session.add(ChatParticipant(chat_id=chat_id, user_id=user_id))
            sid = r.get(f'user:{user_name}')
            if sid:
                sid_str = sid.decode() if isinstance(sid, bytes) else sid
                emit('get_user_chats', {"chats": [chat_info], "name": user_name}, to=sid_str)
            else:
                print(f"Пользователь {user_name} оффлайн или sid не найден в Redis")
                
            db.session.commit()

    @socketio.on("changeUser")
    def changeUser(data):
        name = data["name"]
        oldName = data["oldName"]

        old_key = f"user:{oldName}"
        new_key = f"user:{name}"
        try:
            sid_bytes = r.get(old_key)
            if sid_bytes:
                sid = sid_bytes.decode("utf-8")
                
                # Удаляем старый ключ
                r.delete(old_key)
                
                # Создаём новый
                r.set(new_key, sid)

                print(f"Redis: {old_key} → {new_key} (sid: {sid})")
            else:
                print(f"Redis: старый ключ {old_key} не найден")
        except Exception as e:
            print(e)

        # ==========================================
    # WEBRTC CALL SIGNALING
    # ==========================================

    @socketio.on("call_offer")
    def handle_call_offer(data):
        try:
            chat_id = data.get("chat_id")
            sender = data.get("sender")
            offer = data.get("offer")

            if not chat_id or not sender or not offer:
                print("❌ call_offer: missing data")
                return

            print(
                f"📞 CALL OFFER: {sender} -> chat {chat_id}"
            )

            # Отправляем offer всем в комнате,
            # кроме того, кто его отправил
            emit(
                "call_offer",
                {
                    "sender": sender,
                    "offer": offer
                },
                room=chat_id,
                include_self=False
            )

        except Exception as e:
            print(f"❌ Ошибка call_offer: {e}")


    @socketio.on("call_answer")
    def handle_call_answer(data):
        try:
            chat_id = data.get("chat_id")
            sender = data.get("sender")
            answer = data.get("answer")

            if not chat_id or not sender or not answer:
                print("❌ call_answer: missing data")
                return

            print(
                f"📞 CALL ANSWER: {sender} -> chat {chat_id}"
            )

            emit(
                "call_answer",
                {
                    "sender": sender,
                    "answer": answer
                },
                room=chat_id,
                include_self=False
            )

        except Exception as e:
            print(f"❌ Ошибка call_answer: {e}")


    @socketio.on("call_ice_candidate")
    def handle_call_ice_candidate(data):
        try:
            chat_id = data.get("chat_id")
            sender = data.get("sender")
            candidate = data.get("candidate")

            if not chat_id or not sender or not candidate:
                print("❌ call_ice_candidate: missing data")
                return

            emit(
                "call_ice_candidate",
                {
                    "sender": sender,
                    "candidate": candidate
                },
                room=chat_id,
                include_self=False
            )

        except Exception as e:
            print(
                f"❌ Ошибка call_ice_candidate: {e}"
            )


    @socketio.on("call_end")
    def handle_call_end(data):
        try:
            chat_id = data.get("chat_id")
            sender = data.get("sender")

            if not chat_id or not sender:
                print("❌ call_end: missing data")
                return

            print(
                f"📞 CALL END: {sender} -> chat {chat_id}"
            )

            emit(
                "call_end",
                {
                    "sender": sender
                },
                room=chat_id,
                include_self=False
            )

        except Exception as e:
            print(f"❌ Ошибка call_end: {e}")

