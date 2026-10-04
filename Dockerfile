# Multi-stage build for Local Markdown Explorer (local-md)

# Stage 1: Build React 19 Frontend SPA
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Python FastAPI Runtime
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist
COPY server.py ./server.py
COPY docs /docs

ENV HOST=0.0.0.0
ENV PORT=8000
ENV ROOT_DIR=/docs
ENV PINNED_ROOTS=/docs
ENV LOCK_ROOT=false

EXPOSE 8000

CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "8000", "--root", "/docs"]
