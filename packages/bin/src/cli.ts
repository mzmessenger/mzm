#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initMongoDb } from './initMongodb.js'
import { createSeeds } from './createSeeds.js'

/**
 * npm run cli -w bin init_mongodb -- --password example --user=mzm --user_password=password
 * npm run cli -w bin create_seeds -- --password example --user=mzm
 */

yargs(hideBin(process.argv))
  .command('init_mongodb', 'init mongodb', (yargs) => {
    return yargs
      .option('password', {
        describe: 'root password',
        type: 'string',
        demandOption: true
      })
      .option('user', {
        describe: 'db user',
        type: 'string',
        demandOption: true
      })
      .option('user_password', {
        describe: 'db user password',
        type: 'string',
        demandOption: true
      })
      .option('port', {
        describe: 'db port',
        type: 'string',
        demandOption: true,
        default: '27017'
      })
  }, (argv) => {
    initMongoDb(argv.password, argv.user, argv.user_password, argv.port)
  })
  .command('create_seeds', 'create seeds', (yargs) => {
    return yargs
      .option('password', {
        describe: 'root password',
        type: 'string',
        demandOption: true
      })
      .option('user', {
        describe: 'user',
        type: 'string',
        demandOption: true
      })
  }, (argv) => {
    createSeeds(argv.user, argv.password)
  })
  .parse()
