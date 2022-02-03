# https://hub.docker.com/_/node
FROM node:16 as builder

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/shared ./packages/shared
COPY ./packages/auth/package.json \
  ./packages/auth/tsconfig.json \
  ./packages/auth/
COPY ./packages/auth/src/ ./packages/auth/src/

RUN npm install -w packages/auth -w packages/shared && npm run -w packages/auth cleanbuild

FROM node:16-alpine

WORKDIR /usr/app

COPY --from=builder /usr/app/package.json /usr/app/package-lock.json ./
COPY --from=builder /usr/app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /usr/app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /usr/app/packages/auth/package.json ./packages/auth/
COPY --from=builder /usr/app/packages/auth/dist/ packages/auth/dist/
RUN npm install -w packages/auth -w packages/shared --production

ENV NODE_ENV=production
CMD [ "node", "packages/auth/dist/server.js" ]
