# Лёгкий Node образ
FROM node:20-alpine

WORKDIR /app

# Копируем package.json и package-lock.json (или yarn.lock)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь фронтенд-код
COPY . .

# Прокидываем порт 3000
EXPOSE 3000

# Запускаем dev сервер (можно потом поменять на prod команду)
CMD ["npm", "run", "dev"]
