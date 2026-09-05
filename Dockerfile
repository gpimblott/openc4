# Multi-stage Dockerfile for OpenC4 Platform (TypeScript)
FROM node:22-alpine AS builder
WORKDIR /app

# Build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# Production runtime
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

COPY --from=builder /app/backend/dist ./dist/
COPY --from=builder /app/frontend/dist /app/frontend/dist/

WORKDIR /app
EXPOSE 8000
ENV PORT=8000
CMD ["node", "backend/dist/index.js"]
