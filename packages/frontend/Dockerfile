# https://hub.docker.com/_/node
FROM node:16 as builder

WORKDIR /usr/app

COPY ./package.json ./package-lock.json ./
COPY ./packages/shared ./packages/shared
COPY ./packages/frontend/package.json \
  ./packages/frontend/tsconfig.json \
  ./packages/frontend/webpack.config.js \
  ./packages/frontend/
COPY ./packages/frontend/src/ ./packages/frontend/src/

RUN npm install -w packages/frontend 
RUN npm run -w packages/frontend build:prod

# https://cloud.google.com/community/tutorials/deploy-react-nginx-cloud-run
FROM nginx:alpine

WORKDIR /usr/app

RUN rm /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY ./packages/frontend/nginx/nginx.conf.template /etc/nginx/conf.d/nginx.conf.template
COPY --from=builder /usr/app/packages/frontend/dist /var/www/public

ENV PORT 8080
ENV HOST 0.0.0.0
EXPOSE 8080

CMD sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"
