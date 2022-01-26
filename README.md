# mzm

## how to develop

Node.js >= v16
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
```

### start development

```bash
$ npm install

# start middleware
$ docker-compose up

# start
$ npm run start-auth
$ npm run start-socket
$ npm run start-backend
$ npm run start-frontend

# add package
$ npm install -w packages/backend typescript -D
```

### test

```bash
# test all components
$ npm test --workspaces --if-present

# test "pachages/auth"
$ npm test --workspace=packages/auth

# test file
$ npx jest --config=./packages/frontend/jest.config.js ./packages/frontend/src/worker/markdown.test.ts
```

## Docker build

```bash
$ docker build -f packages/auth/Dockerfile -t mzm-auth .
```