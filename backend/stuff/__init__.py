import os
from flask import Flask
from flask_socketio import SocketIO
from .db import db
from .WebSocket import register_socket_handlers
from .routes import register_routes
from flask_cors import CORS


# -----------------------------
# Настройки окружения
# -----------------------------
FRONTEND_URL_TEST = os.environ.get("FRONTEND_URL", "http://localhost:3000")
FRONTEND_URL = os.environ.get("FRONTEND_URL", FRONTEND_URL_TEST)
SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "YOUR_SECRET_KEY")
DATABASE_URL = os.environ.get("DATABASE_URL")  # Postgres URL из Render

# -----------------------------
# Инициализация приложения
# -----------------------------
app = Flask(__name__)
app.secret_key = SECRET_KEY

# -----------------------------
# Настройка базы данных
# -----------------------------
if DATABASE_URL:
    # Для Postgres на Render
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    # fallback локально (SQLite)
    basedir = os.path.abspath(os.path.dirname(__file__))
    db_dir = os.path.join(basedir, '..', '..', 'instance')
    os.makedirs(db_dir, exist_ok=True)
    db_path = os.path.join(db_dir, 'users.sqlite3')
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_TYPE'] = 'filesystem'
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE='None',
    SESSION_COOKIE_HTTPONLY=True
)

# -----------------------------
# Папка для загрузок
# -----------------------------
UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# -----------------------------
# Инициализация DB и SocketIO
# -----------------------------
CORS(app, resources={r"/*": {"origins": FRONTEND_URL}}, supports_credentials=True)
db.init_app(app)

socketio = SocketIO(
    app,
    cors_allowed_origins=[FRONTEND_URL],
    async_mode='eventlet',   # <--- меняем с threading на eventlet
    max_http_buffer_size=50 * 1024 * 1024
)

# -----------------------------
# Роуты и Socket обработчики
# -----------------------------
register_socket_handlers(socketio)
register_routes(app, socketio)

# -----------------------------
# Запуск (только при прямом старте)
# -----------------------------
# -----------------------------
# Запуск (только при прямом старте)
# -----------------------------
if __name__ == '__main__':
    import eventlet
    import eventlet.wsgi

    # Меняем async_mode на 'eventlet'
    socketio.async_mode = 'eventlet'

    # Для учебного проекта: безопасный сервер на Render
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=True  # можно ставить False на проде
    )
