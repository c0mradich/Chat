from flask import request, jsonify, session, render_template
from stuff import db
from stuff.db import User, Chat, Message, ChatParticipant
from Python_Utils.utils import get_or_create_chat
from Python_Utils.mime import get_mime_type_from_extension
from flask_socketio import emit
import base64, os
from werkzeug.security import generate_password_hash, check_password_hash

def register_routes(app, socketio):
    @app.route('/')
    def home():
        return "You are welcome!"


    @app.route('/addUser', methods=["POST"])
    def addUser():
        # Получаем данные из запроса
        data = request.get_json()
        name = data.get('name')
        password = data.get('password')
        hashed = generate_password_hash(password)

        # Проверка, существует ли пользователь
        existing_user = User.query.filter_by(name=name).first()
        if existing_user:
            return jsonify({
                "success": False,
                "message": "Пользователь с таким именем уже существует!"
            }), 400

        # Создание и добавление нового пользователя
        new_user = User(name, hashed)
        db.session.add(new_user)
        db.session.commit()
        user_id = getattr(new_user, 'id', getattr(new_user, '_id', None))

        # Уведомление всех по сокету
        socketio.emit("add_user", { "name": name, "id": user_id })

        # Возвращаем ответ клиенту
        return jsonify({
            "success": True,
            "message": "Пользователь успешно зарегистрирован!",
            "user": { "name": name }
        }), 200

    @app.route("/login", methods=["POST"])
    def login():
        data = request.get_json() or {}
        name = data.get('name')
        password = data.get('password')

        if not name or not password:
            return jsonify({"success": False, "message": "Имя и пароль обязательны"}), 400

        user = User.query.filter_by(name=name).first()
        if user and check_password_hash(user.password, password):
            if hasattr(user, 'isActive'):
                user.isActive = True
                db.session.commit()

            session['user_id'] = getattr(user, 'id', getattr(user, '_id', None))
            session['username'] = user.name
            return jsonify({"success": True, "message": "Вход успешен!"}), 200
        else:
            return jsonify({"success": False, "message": "Неверное имя пользователя или пароль!"}), 401


    @app.route("/me")
    def me():
        try:
            if 'user_id' in session:
                user = User.query.get(session['user_id']) 
                if user:
                    user.isActive = True
                    db.session.commit()
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
            # Создаем новый чат, если id не передан
            chat_id = get_or_create_chat(chat_info['chatParticipants'][0], chat_info['chatParticipants'][1], db, Chat, ChatParticipant, User, chat_info)

            if chat_id is None:
                return jsonify({'error': 'Failed to create chat'}), 500

        return jsonify({'chat_id': chat_id})

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
        #r.flushdb()
        
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
    
    @app.route("/aboutMe", methods=["GET", "POST"])
    def aboutMe():
        username = session.get("username")
        user_id = session.get("user_id")
        if not username or not user_id:
            return jsonify({"error": "Неавторизованный"}), 401

        if request.method == "POST":
            data = request.get_json()
            if not data or "name" not in data:
                return jsonify({"error": "Нет имени в запросе"}), 400
            
            currentUser = User.query.filter_by(name=data["name"]).first()
            if currentUser:
                return jsonify({"error": "Это имя уже используеться!"}), 401
            
            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "Пользователь не найден"}), 404

            user.name = data["name"]
            db.session.commit()
            socketio.emit("changeUser", {"name": user.name, "oldName": session["username"]})
            session["username"] = user.name
    
            return jsonify({"success": True})

        else:
            return jsonify({"name": username})

        
