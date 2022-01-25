# https://hub.docker.com/_/node
FROM node:16 as builder

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/auth/package.json \
  ./packages/auth/tsconfig.json \
  ./packages/auth/
COPY ./packages/auth/src/ ./packages/auth/src/

RUN npm install -w packages/auth && npm run -w packages/auth cleanbuild

FROM node:16-alpine

WORKDIR /usr/app

COPY --from=builder /usr/app/package.json /usr/app/package-lock.json ./
COPY --from=builder /usr/app/packages/auth/package.json ./packages/auth/
COPY --from=builder /usr/app/packages/auth/dist/ packages/auth/dist/
RUN npm install -w packages/auth --production

ENV NODE_ENV=production
CMD [ "node", "packages/auth/dist/server.js" ]
