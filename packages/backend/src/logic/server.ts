import { MongoClient } from 'mongodb'
import { initIndexes } from '../lib/db.js'
import { initGeneral } from './rooms.js'

export async function init({ db }: { db: MongoClient }) {
  await initIndexes(db)
  await initGeneral({ db })
}
