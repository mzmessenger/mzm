# https://hub.docker.com/_/node
FROM node:16

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/socket/package.json ./packages/socket/tsconfig.json ./packages/socket/src/ ./packages/socket/

RUN npm install -w packages/socket && npm run -w packages/socket cleanbuild

ENV NODE_ENV=production
CMD [ "node", "packages/socket/dist/server.js" ]
