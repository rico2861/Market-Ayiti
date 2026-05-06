FROM node:20-slim AS base
WORKDIR /app
RUN mkdir -p data logs

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src/ ./src/
COPY prisma/ ./prisma/
COPY .env.example ./.env.example

RUN chown -R node:node /app
USER node

EXPOSE 4000
CMD ["node", "src/server.js"]
