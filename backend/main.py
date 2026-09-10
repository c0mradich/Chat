from stuff.db import db, User
from stuff import app, socketio
import os

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        User.query.update({User.isActive: False})
        db.session.commit()

        socketio.run(
            app,
            host='0.0.0.0',
            port=int(os.environ.get('PORT', 5000)),
            debug=False,
            allow_unsafe_werkzeug=True
        )