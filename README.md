# mzm

## how to develop

Node.js >= v18

Docker >= 20.10.8 (`--add-host=host.docker.internal:host-gateway`)

### init

setup DB

```bash
# init
$ docker-compose up
# set mongodb user_password
$ node -r esbuild-register ./bin/init_mongodb.ts --password=example --user=mzm --user_password={{user_password}}
```

setup env

```bash
# copy environment file and write your token, secret...
$ cp ./packages/backend/.env.sample ./packages/backend/.env
$ cp ./packages/auth/.env.sample ./packages/auth/.env
$ cp ./packages/socket/.env.sample ./packages/socket/.env
```

### start development

```bash
$ npm install

# start middleware
$ docker-compose up

# start
$ npm run start

# reload backend, auth, socket...
$ npm run build -w mzm-backend
```

### test

```bash
# test all components
$ npm test --workspaces --if-present

# test "pachages/auth"
$ npm test --workspace=packages/auth
```

## Docker build

```bash
$ docker build -f packages/auth/Dockerfile -t mzm-auth .
```
