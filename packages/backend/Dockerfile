# https://hub.docker.com/_/node
FROM node:24 AS builder

WORKDIR /usr/app

COPY ./.npmrc ./package.json ./package-lock.json ./
COPY ./packages/shared ./packages/shared
COPY ./packages/backend/package.json \
  ./packages/backend/tsconfig.json \
  ./packages/backend/
COPY ./packages/backend/src/ ./packages/backend/src/

RUN npm install --min-release-age=7 --no-audit --no-progress -w mzm-backend -w mzm-shared && npm run -w mzm-backend cleanbuild

FROM node:24-alpine

WORKDIR /usr/app

COPY --from=builder /usr/app/package.json /usr/app/package-lock.json ./
COPY --from=builder /usr/app/.npmrc ./
COPY --from=builder /usr/app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /usr/app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /usr/app/packages/backend/package.json ./packages/backend/
COPY --from=builder /usr/app/packages/backend/dist/ packages/backend/dist/
RUN npm install --min-release-age=7 --omit=dev --no-audit --no-progress -w mzm-backend -w mzm-shared

ENV NODE_ENV=production
CMD [ "node", "packages/backend/dist/src/server.js" ]
