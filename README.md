# mzm

[mzm](https://mzm.dev)

## how to develop

Node.js >= v20

Docker

Cloudflare R2

### init

setup DB

```bash
# init
$ docker-compose up
# set mongodb user_password
$ npm run cli -w bin init_mongodb -- --password example --user=mzm --user_password=password
# create env file
$ npm run cli -w bin create_env -- --password password --user=mzm

# write your client id, secret of GitHub or X, ... packages/auth/.env
# write your token of AWS S3 (Cloudflare R2) in packages/backend/.env

# create general room
$ npm run start -w mzm-backend
```

### start development

```bash
$ npm install

# start middleware
$ docker-compose up

# start
$ npm run start

# access http://localhost:8080

# reload backend, auth...
$ npm run build -w mzm-backend

# mongosh
$ docker exec -it mzm-mongo mongosh -u root -p example
```

### test

```bash
# test all components
$ npm test --workspaces --if-present

# test "pachages/auth"
$ npm test -w mzm-auth
```

## Docker build

```bash
$ docker build -f packages/auth/Dockerfile -t mzm-auth .
```
