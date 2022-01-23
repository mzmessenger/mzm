# https://hub.docker.com/_/node
FROM node:16

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/backend/package.json ./packages/backend/tsconfig.json ./packages/backend/src/ ./packages/backend/

RUN npm install -w packages/backend --production && npm run -w packages/backend cleanbuild

ENV NODE_ENV=production
CMD [ "node", "packages/backend/dist/server.js" ]