# Chat

## Description

This is a simple full-stack project with a Flask backend, Next.js frontend, and Redis cache, all containerized with Docker.

---

## Prerequisites

- Docker
- Docker Compose

---

## How to run the project

1. Clone this repository:

git clone https://github.com/c0mradich/Chat
cd Chat
Build and start all services (backend, frontend, Redis):

docker-compose up --build
Open your browser and go to:

Frontend: http://localhost:3000

Backend API: http://localhost:5000

To stop all containers:

docker-compose down
Notes
The backend is located in the /backend folder (entry point: main.py).

The frontend is in the /frontend folder (Next.js dev server runs on port 3000).

Redis is running in a separate container, accessible via redis:6379 inside the Docker network.

The project runs in development mode (npm run dev for frontend).

Troubleshooting
Make sure Docker and Docker Compose are installed and running.

If ports 3000 or 5000 are busy, change them in docker-compose.yml.

If you make changes to backend or frontend dependencies, rebuild images:

docker-compose up --build
