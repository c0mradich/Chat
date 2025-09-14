# Берём минимальный Python образ
FROM python:3.11-slim

# Рабочая директория в контейнере
WORKDIR /app

# Копируем файл зависимостей и ставим их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код приложения в контейнер
COPY . .

# Прокидываем порт
EXPOSE 5000

# Команда запуска (главный файл main.py)
CMD ["python", "main.py"]

