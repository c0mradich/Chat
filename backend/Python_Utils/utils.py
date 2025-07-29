def get_or_create_chat(user1, user2, Chat, db):
    if(user1!=user2):
        u1, u2 = sorted([user1, user2])  # Чтобы избежать дубликатов
        chat = Chat.query.filter_by(user1=u1, user2=u2).first()
        if not chat:
            chat = Chat(user1=u1, user2=u2)
            db.session.add(chat)
            db.session.commit()
        return chat.id
