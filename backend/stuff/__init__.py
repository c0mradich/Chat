import os
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from .db import db
from .WebSocket import register_socket_handlers
from .routes import register_routes

# -----------------------------
# Настройки окружения
# -----------------------------
import os
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "YOUR_SECRET_KEY")

# -----------------------------
# Инициализация приложения
# -----------------------------
app = Flask(__name__)
app.secret_key = SECRET_KEY

socketio = SocketIO(app, cors_allowed_origins=["https://chat-qddu.vercel.app", "http://localhost:3000"])
CORS(app, origins=["https://chat-qddu.vercel.app", "http://localhost:3000"], supports_credentials=True)


# -----------------------------
# Настройка папок для БД и загрузок
# -----------------------------
basedir = os.path.abspath(os.path.dirname(__file__))

# База данных
db_dir = os.path.join(basedir, '..', '..', 'instance')
os.makedirs(db_dir, exist_ok=True)
db_path = os.path.join(db_dir, 'users.sqlite3')
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_TYPE'] = 'filesystem'

# Папка для загрузок
UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# -----------------------------
# Инициализация DB и SocketIO
# -----------------------------
db.init_app(app)

socketio = SocketIO(app, cors_allowed_origins=FRONTEND_URL, async_mode='eventlet', max_http_buffer_size=50 * 1024 * 1024 )

# -----------------------------
# Роуты и Socket обработчики
# -----------------------------
register_socket_handlers(socketio)
register_routes(app, socketio)

# -----------------------------
# Запуск (только при прямом старте)
# -----------------------------
if __name__ == '__main__':
    # debug=True можно выключить в Docker
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)