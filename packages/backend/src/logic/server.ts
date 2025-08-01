import { MongoClient } from 'mongodb'
import { addInitializeSearchRoomQueue } from '../lib/provider/index.js'
import { initGeneral } from './rooms.js'
import { initConsumer } from '../lib/consumer/index.js'

export async function init(db: MongoClient) {
  await Promise.all([initGeneral(db), initConsumer(db)])

  addInitializeSearchRoomQueue()
}
