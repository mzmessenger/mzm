# https://hub.docker.com/_/node
FROM node:20 as builder

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/shared ./packages/shared
COPY ./packages/backend/package.json \
  ./packages/backend/tsconfig.json \
  ./packages/backend/
COPY ./packages/backend/src/ ./packages/backend/src/

RUN npm install -w mzm-backend -w mzm-shared && npm run -w mzm-backend cleanbuild

FROM node:20-alpine

WORKDIR /usr/app

COPY --from=builder /usr/app/package.json /usr/app/package-lock.json ./
COPY --from=builder /usr/app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /usr/app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /usr/app/packages/backend/package.json ./packages/backend/
COPY --from=builder /usr/app/packages/backend/dist/ packages/backend/dist/
RUN npm install -w mzm-backend -w mzm-shared --production

ENV NODE_ENV=production
CMD [ "node", "packages/backend/dist/server.js" ]
