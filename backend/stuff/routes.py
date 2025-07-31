from flask import request, jsonify, session, render_template
from stuff import db
from stuff.db import users, Chat, Message
from Python_Utils.utils import get_or_create_chat
import base64, os

def get_mime_type_from_extension(ext):
    ext = ext.lower()
    return {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.svg': 'image/svg+xml',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.pdf': 'application/pdf',
        # и т.д.
    }.get(ext, 'application/octet-stream')  # default fallback

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
        existing_user = users.query.filter_by(name=name).first()
        if existing_user:
            return jsonify({"success": False, "message": "Пользователь с таким именем уже существует!"}), 400

        # Создание и добавление нового пользователя
        new_user = users(name, password)
        db.session.add(new_user)
        db.session.commit()

        return jsonify({"success": True, "message": "Пользователь успешно зарегистрирован!"})


    @app.route("/login", methods=["POST"])
    def login():
        data = request.get_json()  # Получаем данные в формате JSON
        name = data.get('name')
        password = data.get('password')


        # Проверяем, есть ли пользователь с таким именем и паролем
        existing_user = users.query.filter_by(name=name, password=password).first()
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
        if 'user_id' in session:
            print(200)
            return jsonify({
                "user_id": session['user_id'],
                "username": session['username']
            })
        else:
            print(401)
            return jsonify({"error": "Не авторизован"}), 401

    @app.route('/get_or_create_chat', methods=['POST'])
    def get_chat():
        data = request.get_json()
        sender = data.get('sender')
        recipient = data.get('recipient')

        if not sender or not recipient:
            return jsonify({'error': 'Missing sender or recipient'}), 400

        chat_id = get_or_create_chat(sender, recipient, Chat, db)
        return jsonify({'chat_id': chat_id})

    @app.route('/send_message', methods=['POST'])
    def send_msg():
        try:
            data = request.get_json()
            sender = data.get('sender')
            chat_id = data.get('chat_id')
            text = data.get('text')

            if sender is None or chat_id is None:
                return jsonify({"error": "Missing sender or chat_id"}), 400

            if text:
                msg = Message(chat_id=chat_id, sender=sender, text=text)
                db.session.add(msg)
                db.session.commit()

            return jsonify({"success": True, "message": "Сообщение отправлено"})

        except Exception as e:
            print("🔥 Ошибка в /send_message:", e)
            return jsonify({"error": str(e)}), 500


    @app.route('/get_messages/<int:chat_id>', methods=['GET'])
    def get_messages(chat_id):
        UPLOAD_FOLDER = 'uploads'
        try:
            messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.timestamp.asc()).all()

            messages_data = []
            for msg in messages:
                msg_dict = {
                    "id": msg.id,
                    "sender": msg.sender,
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
        userList = users.query.all()
        users_data = []

        # Преобразуем список объектов в список словарей
        for user in userList:
            users_data.append({
                "id": user._id,
                "name": user.name,
            })
        return users_data

    @app.route('/admin')
    def admin():
        users_list = users.query.all()
        chat_list = Chat.query.all()
        message_list = Message.query.all()
        return render_template("Users.html", users=users_list, chats=chat_list, messages=message_list)
