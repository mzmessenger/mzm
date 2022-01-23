# https://hub.docker.com/_/node
FROM node:16

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/auth/package.json ./packages/auth/tsconfig.json ./packages/auth/
COPY ./packages/auth/src/ ./packages/auth/

RUN npm install -w packages/auth --production && npm run -w packages/auth cleanbuild

ENV NODE_ENV=production
CMD [ "node", "packages/auth/dist/server.js" ]