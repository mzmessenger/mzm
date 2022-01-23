# https://hub.docker.com/_/node
FROM node:16 as builder

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/backend/package.json \
  ./packages/backend/tsconfig.json \
  ./packages/backend/
COPY ./packages/backend/src/ ./packages/backend/src/

RUN npm install -w packages/backend && npm run -w packages/backend cleanbuild

FROM node:16

WORKDIR /usr/app

COPY --from=builder /usr/app/package.json /usr/app/package-lock.json ./
COPY --from=builder /usr/app/packages/backend/package.json ./packages/backend/
COPY --from=builder /usr/app/packages/backend/dist/ packages/backend/dist/
RUN npm install -w packages/backend --production

ENV NODE_ENV=production
CMD [ "node", "packages/backend/dist/server.js" ]
