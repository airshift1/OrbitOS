FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY server ./server
COPY src/apps/Snake/engine.ts ./src/apps/Snake/engine.ts

ENV NODE_ENV=production
EXPOSE 8080
USER node
CMD ["npm", "run", "multiplayer:server"]
