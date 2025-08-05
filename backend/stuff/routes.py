from flask import request, jsonify, session, render_template
from stuff import db
from stuff.db import User, Chat, Message, ChatParticipant
from Python_Utils.utils import get_or_create_chat
import base64, os

def get_mime_type_from_extension(ext):
    ext = ext.lower()
    mime_types = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.svg': 'image/svg+xml',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.oga': 'audio/ogg',  # Доп. расширение OGG
        '.webm': 'audio/webm',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
    }
    return mime_types.get(ext, 'application/octet-stream')


def register_routes(app):
    @app.route('/')
    def home():
        return "You are welcome!"


    @app.route('/addUser', methods=["POST"])
    def addUser():
        # Получаем данные из запроса
        data = request.get_json()
        name = data.get('name')
        password = data.get('password')

        # Проверка, существует ли пользователь
        existing_user = User.query.filter_by(name=name).first()
        if existing_user:
            return jsonify({"success": False, "message": "Пользователь с таким именем уже существует!"}), 400

        # Создание и добавление нового пользователя
        new_user = User(name, password)
        db.session.add(new_user)
        db.session.commit()

        return jsonify({"success": True, "message": "Пользователь успешно зарегистрирован!"})


    @app.route("/login", methods=["POST"])
    def login():
        data = request.get_json()  # Получаем данные в формате JSON
        name = data.get('name')
        password = data.get('password')
        current_user = User.query.filter_by(name=name).first()
        current_user.isActive = True
        db.session.commit()


        # Проверяем, есть ли пользователь с таким именем и паролем
        existing_user = User.query.filter_by(name=name, password=password).first()
        if existing_user:
            # Успешный вход
            session['user_id'] = existing_user._id  # сохраняем ID в сессию
            session['username'] = existing_user.name
            return jsonify({"success": True, "message": "Вход успешен!"}), 200
        else:
            # Неверные данные
            return jsonify({"success": False, "message": "Неверное имя пользователя или пароль!"}), 401

    @app.route("/me")
    def me():
        try:
            if 'user_id' in session:
                user = User.query.get(session['user_id'])  # быстрее и безопаснее, чем filter_by
                if user:
                    return jsonify({
                        "user_id": user._id,
                        "username": user.name
                    })
                else:
                    # юзер не найден в базе, очищаем сессию на всякий случай
                    session.clear()
                    return jsonify({"error": "Пользователь не найден"}), 404
            else:
                return jsonify({"error": "Не авторизован"}), 401
        except Exception as e:
            print(f"Ошибка в /me: {e}")
            return jsonify({"error": "Внутренняя ошибка сервера"}), 500


    @app.route('/get_or_create_chat', methods=['POST'])
    def get_chat():
        data = request.get_json()
        sender = data.get('sender')
        chat_name = data.get('name')
        chat_info = data.get('chatInfo')

        if not sender or not chat_name or not chat_info:
            return jsonify({'error': 'Missing sender, name, or chatInfo'}), 400

        chat_id = chat_info.get('id')

        if chat_id is None:
            print(chat_info)
            # Создаем новый чат, если id не передан
            chat_id = get_or_create_chat(chat_info['chatParticipants'][0], chat_info['chatParticipants'][1], db, Chat, ChatParticipant, User, chat_info)

            if chat_id is None:
                return jsonify({'error': 'Failed to create chat'}), 500

        return jsonify({'chat_id': chat_id})



    @app.route('/send_message', methods=['POST'])
    def send_msg():
        try:
            data = request.get_json()
            sender_name = data.get('sender')
            chat_id = data.get('chat_id')
            text = data.get('text')

            if not sender_name or chat_id is None or not text:
                return jsonify({"error": "Missing sender, chat_id or text"}), 400

            # Получаем пользователя по имени
            user = User.query.filter_by(name=sender_name).first()
            if not user:
                return jsonify({"error": "Пользователь не найден"}), 400

            # Создаём сообщение с sender_id
            msg = Message(chat_id=chat_id, sender_id=user._id, text=text)
            db.session.add(msg)
            db.session.commit()

            return jsonify({"success": True, "message": "Сообщение отправлено"})

        except Exception as e:
            print("🔥 Ошибка в /send_message:", e)
            return jsonify({"error": str(e)}), 500



    @app.route('/get_messages/<int:chat_id>', methods=['GET'])
    def get_messages(chat_id):
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
        try:
            messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.timestamp.asc()).all()
            messages_data = []
            for msg in messages:
                msg_dict = {
                    "id": msg._id,
                    "sender": msg.sender.name,
                    "text": msg.text,
                    "timestamp": msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
                }

                # Проверка на файл по пути /uploads/имяфайла
                if msg.text.startswith("/uploads/"):
                    filename = msg.text[len("/uploads/"):]  # Оставляем только имя файла
                    name_part, ext_part = os.path.splitext(filename)
                    if len(name_part) == 64 and ext_part:  # Строго 64 символа + расширение
                        file_path = os.path.join(UPLOAD_FOLDER, filename)
                        if os.path.isfile(file_path):
                            with open(file_path, "rb") as f:
                                file_bytes = f.read()
                                base64_data = base64.b64encode(file_bytes).decode('utf-8')
                            
                            # MIME тип — можно улучшить по желанию
                            mime_type = get_mime_type_from_extension(ext_part)
                            data_url = f"data:{mime_type};base64,{base64_data}"
                            
                            # Добавляем content
                            msg_dict['content'] = data_url


                messages_data.append(msg_dict)

            return jsonify({"messages": messages_data}), 200

        except Exception as e:
            print("Ошибка при получении сообщений:", e)
            return jsonify({"error": "Internal server error"}), 500




    @app.route("/getUserList", methods=["GET"])
    def getUserList():
        userList = User.query.all()
        users_data = []

        # Преобразуем список объектов в список словарей
        for user in userList:
            users_data.append({
                "id": user._id,
                "name": user.name,
            })
        return users_data
    
    @app.route("/leave", methods=["POST"])
    def leave():
        data = request.get_json()
        name = data.get("name")
        user = User.query.filter_by(name=name).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        user.isActive = False
        db.session.commit()
        return jsonify({"message": f"User {name} marked as inactive"}), 200


    @app.route('/admin')

    def admin():
        users_list = User.query.all()
        message_list = Message.query.all()
        chats_raw = Chat.query.all()

        # ChatParticipant.query.delete()
        # Message.query.delete()
        # Chat.query.delete()
        # User.query.delete()
        # db.session.commit()
        #session.clear()
        
        chats = []
        for chat in chats_raw:
            participant_names = []
            for p in chat.participants:
                if p.user:
                    participant_names.append(p.user.name)
                else:
                    print(f"Warning: ChatParticipant {p._id} has no valid user")

            chats.append({
                "id": chat._id,
                "name": chat.name,
                "is_group": chat.is_group,
                "creator_id": chat.creator_id,
                "participants": participant_names
            })

        return render_template("Users.html", users=users_list, chats=chats, messages=message_list)

