# https://hub.docker.com/_/node
FROM node:18 as builder

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/shared ./packages/shared
COPY ./packages/socket/package.json \
  ./packages/socket/tsconfig.json \
  ./packages/socket/
COPY ./packages/socket/src/ ./packages/socket/src/

RUN npm install -w mzm-socket -w mzm-shared && npm run -w mzm-socket cleanbuild

FROM node:18-alpine

WORKDIR /usr/app

COPY --from=builder /usr/app/package.json /usr/app/package-lock.json ./
COPY --from=builder /usr/app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /usr/app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /usr/app/packages/socket/package.json ./packages/socket/
COPY --from=builder /usr/app/packages/socket/dist/ packages/socket/dist/
RUN npm install -w mzm-socket -w mzm-shared --production

ENV NODE_ENV=production
CMD [ "node", "packages/socket/dist/server.js" ]
