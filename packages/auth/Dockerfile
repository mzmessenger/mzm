# https://hub.docker.com/_/node
FROM node:16

WORKDIR /usr/app

COPY ./package.json ./package-lock.json tsconfig.json ./
COPY src/ ./src

RUN npm install --production && npm install typescript && npm run cleanbuild

ENV NODE_ENV=production
CMD [ "node", "dist/server.js" ]