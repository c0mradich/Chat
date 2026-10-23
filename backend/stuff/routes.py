from itsdangerous import URLSafeTimedSerializer
from flask import current_app, url_for
from flask import request, jsonify, session, render_template
from stuff import db
from stuff.db import User, Chat, Message, ChatParticipant
from Python_Utils.utils import find_chat, create_chat
from Python_Utils.mime import get_mime_type_from_extension
from Python_Utils.func import generate_file_hash4
import base64, os
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from werkzeug.security import generate_password_hash, check_password_hash
from flask import send_from_directory
from datetime import datetime

ph = PasswordHasher()

Su_name = os.environ.get("SU_NAME")
Su_password = os.environ.get("SU_PASSWORD")

if not Su_name or not Su_password:
    Su_name = "root"
    Su_password = "root"

SU_name_hashed = ph.hash(Su_name)
SU_password_hashed = ph.hash(Su_password)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
UPLOAD_AVATARS_DIR = os.path.join(BASE_DIR, 'avatars')

def generate_verification_token(user_id):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(user_id, salt='email-verification')

def register_routes(app, socketio):
    @app.route('/')
    def home():
        return render_template("WelcomePage.html")


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
            user_id = getattr(user, 'id', None)

            if user_id is None:
                user_id = getattr(user, '_id', None)

            if user_id is None:
                return jsonify({
                    "success": False,
                    "message": "Не удалось определить ID пользователя"
                }), 500

            # Удаляем данные предыдущей сессии
            session.clear()

            # Записываем данные нового пользователя
            session['user_id'] = user_id
            session['username'] = user.name

            if hasattr(user, 'isActive'):
                user.isActive = True

            db.session.commit()

            return jsonify({
                "success": True,
                "message": "Вход успешен!"
            }), 200

        return jsonify({
            "success": False,
            "message": "Неверное имя пользователя или пароль!"
        }), 401


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

    @app.route('/get_messages/<int:chat_id>', methods=['GET'])
    def get_messages(chat_id):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Не авторизован'}), 401

        is_participant = ChatParticipant.query.filter_by(
            chat_id=chat_id,
            user_id=user_id
        ).first()

        if not is_participant:
            return jsonify({'error': 'Нет доступа к этому чату'}), 403
        
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
        try:
            messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.timestamp.asc()).all()
            messages_data = []
            for msg in messages:
                msg_dict = {
                    "id": msg._id,
                    "sender": msg.sender.name if msg.sender else None,
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
    
    @app.route("/uploads", methods=["POST"])
    def uploads():
        if "file" not in request.files:
            return jsonify({"success": False, "message": "Файл не найден"}), 400
        
        file = request.files["file"]  # <— Werkzeug FileStorage
        filename = file.filename
        sender = request.form.get("sender")
        chat_id = request.form.get("chatId")

        timestamp = datetime.utcnow().isoformat()
        hashed_filename = generate_file_hash4(filename, sender, chat_id, timestamp)
        save_path = os.path.join(UPLOAD_FOLDER, hashed_filename)
        file.save(save_path)          # сохраняем на диск
        
        return jsonify({"success": True, "filename": filename, "path": f"/uploads/{hashed_filename}"})
    
    @app.route("/uploads/<path:filename>", methods=["GET"])
    def get_upload(filename):
        return send_from_directory(UPLOAD_FOLDER, filename)

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

    @app.route('/admin/login')
    def adminLogin():
        return render_template("Verification.html")

    @app.route("/loginAdmin", methods=["POST"])
    def loginAdmin():
        data = request.get_json(silent=True) or {}

        username = data.get("username")
        password = data.get("password")

        if not isinstance(username, str) or not isinstance(password, str) \
                or not username.strip() or not password:
            return jsonify({
                "success": False,
                "message": "Missing credentials"
            }), 400

        try:
            ph.verify(SU_name_hashed, username.strip())
            ph.verify(SU_password_hashed, password)

        except VerifyMismatchError:
            session["admin_authenticated"] = False
            return jsonify({
                "success": False,
                "message": "Wrong credentials"
            }), 401

        except VerificationError:
            app.logger.exception("Credential verification failed")
            session["admin_authenticated"] = False
            return jsonify({
                "success": False,
                "message": "Internal server error"
            }), 500

        session["admin_authenticated"] = True

        return jsonify({
            "success": True,
            "redirect_url": "/admin"
        }), 200


    @app.route('/admin')
    def admin():
        access = session.get("admin_authenticated", False)
        if not access:
            return render_template("AccessNotPermitted.html")
        
        users_list = User.query.all()
        message_list = Message.query.all()
        chats_raw = Chat.query.all()

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
        user_avatar = User.query.get(user_id).avatar
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
            return jsonify({"name": username, "avatar": user_avatar})


    @app.route("/changeAvatar", methods=["POST"])
    def change_avatar():
        user_id = session.get("user_id")

        if not user_id:
            return jsonify({
                "success": False,
                "message": "Необходима авторизация."
            }), 401

        user = db.session.get(User, user_id)

        if not user:
            return jsonify({
                "success": False,
                "message": "Пользователь не найден."
            }), 404

        avatar = request.files.get("avatar")

        if not avatar or not avatar.filename:
            return jsonify({
                "success": False,
                "message": "Файл не передан."
            }), 400

        filename = avatar.filename
        timestamp = datetime.utcnow().isoformat()
        hashed_filename = generate_file_hash4(
            filename, user.name, timestamp, ''
        )

        save_path = os.path.join(UPLOAD_AVATARS_DIR, hashed_filename)

        try:
            avatar.save(save_path)

            user.avatar = f"/avatars/{hashed_filename}"
            db.session.commit()

        except Exception:
            db.session.rollback()

            if os.path.exists(save_path):
                os.remove(save_path)

            app.logger.exception("Ошибка сохранения аватара")

            return jsonify({
                "success": False,
                "message": "Не удалось сохранить аватар."
            }), 500

        return jsonify({
            "success": True,
            "filename": filename,
            "path": user.avatar
        }), 200


    @app.route("/avatars/<path:filename>", methods=["GET"])
    def get_avatars(filename):
        return send_from_directory(UPLOAD_AVATARS_DIR, filename)
    
    @app.route('/find_chat/<int:other_user_id>', methods=['GET'])
    def find_personal_chat(other_user_id):
        user_id = session.get('user_id')

        if not user_id:
            return jsonify({'error': 'Не авторизован'}), 401

        if user_id == other_user_id:
            return jsonify({'error': 'Нельзя открыть чат с самим собой'}), 400

        other_user = db.session.get(User, other_user_id)
        if not other_user:
            return jsonify({'error': 'Пользователь не найден'}), 404

        user_chats = (
            db.session.query(ChatParticipant.chat_id)
            .filter(ChatParticipant.user_id == user_id)
            .subquery()
        )

        chat = (
            db.session.query(Chat)
            .join(ChatParticipant, ChatParticipant.chat_id == Chat._id)
            .filter(
                Chat._id.in_(user_chats),
                ChatParticipant.user_id == other_user_id,
                Chat.is_group.is_(False)
            )
            .first()
        )

        # Чат ещё не создан — это нормальная ситуация
        return jsonify({
            'chat_id': chat._id if chat else None,
            'messages': []
        }), 200

    @app.route('/create_chat', methods=['POST'])
    def create_personal_chat():
        user_id = session.get('user_id')

        if not user_id:
            return jsonify({'error': 'Не авторизован'}), 401

        data = request.get_json() or {}
        other_user_id = data.get('other_user_id')

        if not isinstance(other_user_id, int) or isinstance(other_user_id, bool):
            return jsonify({'error': 'Некорректный ID собеседника'}), 400

        if user_id == other_user_id:
            return jsonify({'error': 'Нельзя создать чат с самим собой'}), 400

        other_user = db.session.get(User, other_user_id)
        if not other_user:
            return jsonify({'error': 'Пользователь не найден'}), 404

        try:
            user_chats = (
                db.session.query(ChatParticipant.chat_id)
                .filter(ChatParticipant.user_id == user_id)
                .subquery()
            )

            existing_chat = (
                db.session.query(Chat)
                .join(ChatParticipant, ChatParticipant.chat_id == Chat._id)
                .filter(
                    Chat._id.in_(user_chats),
                    ChatParticipant.user_id == other_user_id,
                    Chat.is_group.is_(False)
                )
                .first()
            )

            # Повторная проверка: чат мог появиться после первого поиска
            if existing_chat:
                return jsonify({'chat_id': existing_chat._id}), 200

            new_chat = Chat(is_group=False)
            db.session.add(new_chat)
            db.session.flush()  # Получаем new_chat._id до создания участников

            db.session.add_all([
                ChatParticipant(chat_id=new_chat._id, user_id=user_id),
                ChatParticipant(chat_id=new_chat._id, user_id=other_user_id)
            ])

            db.session.commit()

            return jsonify({'chat_id': new_chat._id}), 201

        except Exception:
            db.session.rollback()
            app.logger.exception('Ошибка при создании личного чата')
            return jsonify({'error': 'Не удалось создать чат'}), 500