import { addInitializeSearchRoomQueue } from '../lib/provider/index.js'
import { initGeneral } from './rooms.js'
import { initConsumer } from '../lib/consumer/index.js'

export const init = async () => {
  await Promise.all([initGeneral(), initConsumer()])

  addInitializeSearchRoomQueue()
}
