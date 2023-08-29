/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
import { test } from 'vitest'
import type { RouteParams } from './api.js'

test('RouteParams', async () => {
  type P = RouteParams<'/api/rooms/:roomid/users/:version'>
  const params: P = {
    roomid: 'roomid',
    version: 'version'
  }
})

test('RouteParams: no params', async () => {
  type P = RouteParams<'/api/rooms'>
  const params: P = {}
})
