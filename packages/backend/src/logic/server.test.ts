import { expect } from 'vitest'
import { createTest } from '../../test/testUtil.js'
import { collections } from '../lib/db.js'
import * as config from '../config.js'
import { init } from './server.js'

const test = await createTest(globalThis)

test('初期化を複数回実行してもgeneral roomは一件だけ作成される', async ({
  testDb
}) => {
  await init({ db: testDb })
  await init({ db: testDb })

  const general = await collections(testDb)
    .rooms.find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()
  expect(general).toHaveLength(1)
})
