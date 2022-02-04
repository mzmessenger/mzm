# mzm-frontend

## test Docker

```bash
$ docker build -f packages/frontend/Dockerfile -t mzm-frontend .
$ docker run --init --rm -p 9000:4000 --add-host=host.docker.internal:host-gateway -e PORT=4000 -it mzm-frontend sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"
```
