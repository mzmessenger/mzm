import { vi, expect } from 'vitest'
import { createTest } from '../../../test/testUtil.js'
vi.mock('../../lib/logger')
vi.mock('../../lib/elasticsearch/index', () => {
  return {
    client: {}
  }
})

import { ObjectId } from 'mongodb'
import { BadRequest } from 'mzm-shared/src/lib/errors'
import { collections } from '../../lib/db.js'
import { createRoom } from './index.js'

const test = await createTest(globalThis)

test.for([
  ['aaa', 'aaa'],
  ['日本語　', '日本語'],
  ['🍣', '🍣']
])('createRoom success (%s, %s)', async ([name, createdName], { testDb }) => {
  const userId = new ObjectId()
  const body = { name }

  const { id } = await createRoom({
    db: testDb,
    userId,
    body
  })

  const created = await collections(testDb).rooms.findOne({
    _id: new ObjectId(id)
  })

  expect(created?.name).toStrictEqual(createdName)
  expect(created?.createdBy).toStrictEqual(userId.toHexString())
})

test.for([
  ['slash', '/hoge/fuga'],
  ['00A0', '\u00A0']
])('createRoom fail', async ([, name], { testDb }) => {
  expect.assertions(1)

  const userId = new ObjectId()
  const body = { name }

  try {
    await createRoom({ db: testDb, userId, body })
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
