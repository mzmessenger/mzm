# https://hub.docker.com/_/node
FROM node:16 as builder

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/shared ./packages/shared
COPY ./packages/backend/package.json \
  ./packages/backend/tsconfig.json \
  ./packages/backend/
COPY ./packages/backend/src/ ./packages/backend/src/

RUN npm install -w packages/backend -w packages/shared && npm run -w packages/backend cleanbuild

FROM node:16-alpine

WORKDIR /usr/app

COPY --from=builder /usr/app/package.json /usr/app/package-lock.json ./
COPY --from=builder /usr/app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /usr/app/packages/backend/package.json ./packages/backend/
COPY --from=builder /usr/app/packages/backend/dist/ packages/backend/dist/
RUN npm install -w packages/backend --production

ENV NODE_ENV=production
CMD [ "node", "packages/backend/dist/server.js" ]
