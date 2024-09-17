#!/usr/bin/env node
/**
 * npm run cli -w bin init_mongodb -- --password example --user=mzm --user_password=password
 * npm run cli -w bin create_env -- --password password --user=mzm
 * npm run cli -w bin create_seeds -- --password password --user=mzm
 */

import { parseArgs } from 'node:util'
import { initMongoDb } from './initMongodb.ts'
import { createSeeds } from './createSeeds.ts'
import { createEnv } from './createEnv.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    password: {
      type: 'string',
      describe: 'root password',
    },
    'user': {
      type: 'string',
      describe: 'db user',
    },
    user_password: {
      type: 'string',
      describe: 'db user password',
    },
    port: {
      type: 'string',
      default: '27017',
      describe: 'db port'
    }
  }
})

async function main() {
  if (positionals[0] === 'init_mongodb') {
    if (!values.password) {
      throw new Error('password is required')
    }
    if (!values.user) {
      throw new Error('user is required')
    }
    if (!values.user_password) {
      throw new Error('user_password is required')
    }
    await initMongoDb(values.password, values.user, values.user_password, values.port)
    return
  }

  if (positionals[0] === 'create_env') {
    if (!values.user) {
      throw new Error('user is required')
    }
    if (!values.password) {
      throw new Error('password is required')
    }
    await createEnv(values.user, values.password)
    return
  }

  if (positionals[0] === 'create_seeds') {
    if (!values.user) {
      throw new Error('user is required')
    }
    if (!values.password) {
      throw new Error('password is required')
    }
    await createSeeds(values.user, values.password)
    return
  }
}

main().catch(console.error)
