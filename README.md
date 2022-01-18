# mzm

## how to develop

### init

```bash
# init
$ docker-compose up
# set user_password
$ node -r esbuild-register ./bin/init_mongodb.ts --password=example --user=mzm --user_password={{user_password}}
```

### start development

```bash
$ docker-compose up

# start
$ npm start --workspace=packages/auth
$ npm start --workspace=packages/socket
```

### test

```bash
# test all components
$ npm test --workspaces --if-present

# test "pachages/auth"
$ npm test --workspace=packages/auth
```