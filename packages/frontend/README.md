# mzm-frontend

## test Docker

```bash
$ docker build -f packages/frontend/Dockerfile -t mzm-frontend .
$ docker run --init --rm -p 9000:4000 --add-host=host.docker.internal:host-gateway -e PORT=4000 -e MZM_SOCKET=host.docker.internal:3000 -e MZM_API=host.docker.internal:3001 -e MZM_AUTH=host.docker.internal:8000 -it mzm-frontend sh -c "envsubst '\$PORT \$MZM_SOCKET \$MZM_API \$MZM_AUTH' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"
```
