FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p uploads

EXPOSE 5055
CMD ["node", "src/server.js"]
