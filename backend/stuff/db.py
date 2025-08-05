from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
db = SQLAlchemy()
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    _id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    password = db.Column(db.String(100), nullable=False)
    messages = db.relationship('Message', back_populates='sender', lazy=True)

    def __init__(self, name, password):
        self.name = name
        self.password = password


class Message(db.Model):
    __tablename__ = 'messages'
    _id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chats._id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users._id'), nullable=False)
    text = db.Column(db.String(1000), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    sender = db.relationship('User', back_populates='messages')

    def __init__(self, chat_id, sender_id, text, timestamp=None):
        self.chat_id = chat_id
        self.sender_id = sender_id
        self.text = text
        self.timestamp = timestamp or datetime.utcnow()


class Chat(db.Model):
    __tablename__ = 'chats'
    _id = db.Column(db.Integer, primary_key=True)
    is_group = db.Column(db.Boolean, default=False)
    name = db.Column(db.String(100))  # имя группы, если это группа
    creator_id = db.Column(db.Integer, db.ForeignKey('users._id'))

    participants = db.relationship('ChatParticipant', backref='chat', cascade='all, delete-orphan')
    messages = db.relationship('Message', backref='chat', lazy=True)
    
    def __init__(self, is_group=False, name=None, creator_id=None):
        self.is_group = is_group
        self.name = name
        self.creator_id = creator_id



class ChatParticipant(db.Model):
    __tablename__ = 'chat_participants'
    _id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chats._id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users._id'), nullable=False)

    user = db.relationship('User', backref='chat_participations')

    def __init__(self, chat_id, user_id):
        self.chat_id = chat_id
        self.user_id = user_id

