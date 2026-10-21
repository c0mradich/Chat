def find_chat(user1_name, user2_name, db, Chat, ChatParticipant, User):
    if user1_name == user2_name:
        return None

    user1 = User.query.filter_by(name=user1_name).first()
    user2 = User.query.filter_by(name=user2_name).first()

    if not user1 or not user2:
        return None

    # Находим личный чат, в котором состоят оба пользователя
    chat = (
        db.session.query(Chat._id)
        .join(ChatParticipant, ChatParticipant.chat_id == Chat._id)
        .filter(
            Chat.is_group.is_(False),
            Chat._id.in_(
                db.session.query(ChatParticipant.chat_id)
                .filter(ChatParticipant.user_id == user1._id)
            ),
            ChatParticipant.user_id == user2._id
        )
        .first()
    )

    return chat[0] if chat else None


def create_chat(user1_name, user2_name, db, Chat, ChatParticipant, User):
    if user1_name == user2_name:
        return None

    user1 = User.query.filter_by(name=user1_name).first()
    user2 = User.query.filter_by(name=user2_name).first()

    if not user1 or not user2:
        return None

    # Не создаём дубликат, если чат уже появился
    existing_id = find_chat(
        user1_name, user2_name, db, Chat, ChatParticipant, User
    )

    if existing_id is not None:
        return existing_id

    new_chat = Chat(is_group=False)
    db.session.add(new_chat)

    try:
        db.session.flush()  # Получаем ID до создания участников

        db.session.add_all([
            ChatParticipant(chat_id=new_chat._id, user_id=user1._id),
            ChatParticipant(chat_id=new_chat._id, user_id=user2._id)
        ])

        db.session.commit()
        return new_chat._id

    except Exception:
        db.session.rollback()
        raise