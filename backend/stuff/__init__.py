import os
from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS

from .db import db
from .WebSocket import register_socket_handlers
from .routes import register_routes

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
FRONTEND_PRIOR_URL = os.environ.get("FRONTEND_PRIOR_URL", "http://localhost:3000")
SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "YOUR_SECRET_KEY")
DATABASE_URL = os.environ.get("DATABASE_URL")
FRONTEND_URLS = [FRONTEND_URL, FRONTEND_PRIOR_URL]

app = Flask(__name__)
app.secret_key = SECRET_KEY

app.config.update(
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
)

basedir = os.path.abspath(os.path.dirname(__file__))
uploads_path = os.path.join(basedir, 'uploads')
os.makedirs(uploads_path, exist_ok=True)

if DATABASE_URL:
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    db_path = os.path.join(basedir, '..', '..', 'instance', 'users.sqlite3')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, resources={r"/*": {"origins": FRONTEND_URLS}}, supports_credentials=True)

db.init_app(app)

socketio = SocketIO(
    app,
    cors_allowed_origins=FRONTEND_URLS,
    async_mode='threading',
    max_http_buffer_size=50 * 1024 * 1024,
    logger=True,
    engineio_logger=True
)

register_socket_handlers(socketio)
register_routes(app, socketio)
