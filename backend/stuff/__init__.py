from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
import os
import eventlet
from .db import db
from .WebSocket import register_socket_handlers
from .routes import register_routes


app = Flask(__name__)
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "http://localhost:3000"}})
app.secret_key = "YOUR_SECRET_KEY"

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, '..','..', 'instance', 'users.sqlite3')
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_TYPE'] = 'filesystem'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

db.init_app(app)

socketio = SocketIO(app, cors_allowed_origins="http://localhost:3000", async_mode='eventlet')
register_socket_handlers(socketio)
register_routes(app, socketio)