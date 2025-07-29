from flask import Flask, redirect, url_for, request, jsonify, flash, render_template, session
from flask_session import Session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
from datetime import datetime
from Python_Utils.utils import get_or_create_chat
from flask_socketio import SocketIO, join_room, leave_room, emit
import eventlet

app = Flask(__name__)
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "http://localhost:3000"}})  # разрешить запросы с других доменов
socketio = SocketIO(app, cors_allowed_origins="http://localhost:3000", async_mode='eventlet')
app.secret_key = "YOUR_SECRET_KEY"
basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, '..', 'instance', 'users.sqlite3')
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_TYPE'] = 'filesystem'

db = SQLAlchemy(app)

class users(db.Model):
    _id = db.Column("id", db.Integer, primary_key=True)
    name = db.Column("name", db.String(100))
    password = db.Column("password", db.String(100))

    def __init__(self, name, password):
        self.name = name
        self.password = password

class Chat(db.Model):
    __tablename__ = 'chats'
    id = db.Column(db.Integer, primary_key=True)
    user1 = db.Column(db.String(50), nullable=False)
    user2 = db.Column(db.String(50), nullable=False)

    def __init__(self, user1, user2):
        self.user1 = user1
        self.user2 = user2

class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chats.id'), nullable=False)
    sender = db.Column(db.String(50), nullable=False)
    text = db.Column(db.String(1000), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def __init__(self, chat_id, sender, text):
        self.chat_id = chat_id
        self.sender = sender
        self.text = text

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
    """
    data = {
      'chat_id': <int>,
      'sender': <str>,
      'text': <str>
    }
    """
    chat_id = data['chat_id']
    sender  = data['sender']
    text    = data['text']
    # 1) Сохраняем в БД
    msg = Message(chat_id=chat_id, sender=sender, text=text)
    db.session.add(msg)
    db.session.commit()
    # 2) Шлём всем в комнате
    emit('receive_message', {
      'id': msg.id,
      'sender': sender,
      'text': text,
      'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    }, room=chat_id)


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
    try:
        messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.timestamp.asc()).all()

        messages_data = []
        for msg in messages:
            messages_data.append({
                "id": msg.id,
                "sender": msg.sender,
                "text": msg.text,
                "timestamp": msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            })

        return jsonify({"messages": messages_data}), 200

    except Exception as e:
        print("🔥 Ошибка в /get_messages:", e)
        return jsonify({"error": "Ошибка при получении сообщений"}), 500




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


if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Создаём таблицы
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    app.run(debug=True)
