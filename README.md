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

# start all components
$ npm run start --workspaces
```

### test

```bash
# test all components
$ npm run test --workspaces

# test "pachages/auth"
$ npm run test --workspace=packages/auth
```