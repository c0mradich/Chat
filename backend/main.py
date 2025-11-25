from flask import Flask
from stuff.db import db, User
from stuff import app, socketio


if __name__ == '__main__':
    with app.app_context():
        db.drop_all()
        db.create_all()
        User.query.update({User.isActive: False})
        db.session.commit()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
