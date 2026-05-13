FROM node:20-slim AS base

# Build tools needed to compile better-sqlite3 native binding
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN mkdir -p /data logs

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src/ ./src/

RUN chown -R node:node /app /data

USER node

EXPOSE 4000
CMD ["node", "src/server.js"]
