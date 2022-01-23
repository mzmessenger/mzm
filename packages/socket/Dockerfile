# https://hub.docker.com/_/node
FROM node:16 as builder

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/socket/package.json \
  ./packages/socket/tsconfig.json \
  ./packages/socket/
COPY ./packages/socket/src/ ./packages/socket/src/

RUN npm install -w packages/socket && npm run -w packages/socket cleanbuild

FROM node:16

WORKDIR /usr/app

COPY --from=builder /usr/app/package.json /usr/app/package-lock.json ./
COPY --from=builder /usr/app/packages/socket/package.json ./packages/socket/
COPY --from=builder /usr/app/packages/socket/dist/ packages/socket/dist/
RUN npm install -w packages/socket --production

ENV NODE_ENV=production
CMD [ "node", "packages/socket/dist/socket.js" ]
