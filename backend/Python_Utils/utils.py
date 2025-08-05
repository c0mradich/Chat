def get_or_create_chat(user1_name, user2_name, db, Chat, ChatParticipant, User, chatInfo):
    if user1_name == user2_name:
        return None  # Нельзя создать чат с самим собой

    # Получаем всех участников из chatInfo
    participant_names = chatInfo.get('chatParticipants', [])
    if not participant_names:
        return None  # Без участников смысла нет

    # Получаем объекты всех пользователей
    users = User.query.filter(User.name.in_(participant_names)).all()
    if len(users) != len(participant_names):
        return None  # Кто-то из участников не найден

    # Личный чат
    if chatInfo['isGroup'] == False:
        user1 = next((u for u in users if u.name == user1_name), None)
        user2 = next((u for u in users if u.name == user2_name), None)

        # Найдём все чаты user1
        user1_chats = db.session.query(Chat._id).join(ChatParticipant).filter(
            ChatParticipant.user_id == user1._id
        ).subquery()

        # Ищем общий чат user1 и user2
        existing_chat = db.session.query(Chat).join(ChatParticipant).filter(
            ChatParticipant.user_id == user2._id,
            Chat._id.in_(user1_chats),
            Chat.is_group == False
        ).first()

        if existing_chat:
            return existing_chat._id

        # Создаём новый личный чат
        new_chat = Chat(is_group=False)
        db.session.add(new_chat)
        db.session.commit()

        db.session.add_all([
            ChatParticipant(chat_id=new_chat._id, user_id=user1._id),
            ChatParticipant(chat_id=new_chat._id, user_id=user2._id)
        ])
        db.session.commit()
        return new_chat._id

    else:
        # Групповой чат
        group_name = chatInfo['name']
        existing_group = Chat.query.filter_by(name=group_name, is_group=True).first()
        if existing_group:
            return existing_group._id

        # Создаём новый групповой чат
        creator = next((u for u in users if u.name == user1_name), users[0])
        new_group = Chat(name=group_name, is_group=True, creator_id=creator._id)
        db.session.add(new_group)
        db.session.commit()

        db.session.add_all([
            ChatParticipant(chat_id=new_group._id, user_id=u._id) for u in users
        ])
        db.session.commit()
        return new_group._id