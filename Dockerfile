# Stage 1: Build React frontend
FROM node:18 AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN ./node_modules/.bin/vite build

# Stage 2: Python backend + serve frontend
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}