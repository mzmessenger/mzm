import { test, expect } from 'vitest'
import { ACCOUNT_STR } from './constants.js'
import { isValidAccount } from './index.js'

test.each([
  ['valid1234'],
  ['valid_1234'],
  ['a-ho-ge'],
  ['yx-'],
  ['a'.repeat(ACCOUNT_STR.MAX_LENGTH)]
])('isValidAccount success (%s)', (arg: string) => {
  const isValid = isValidAccount(arg)
  expect(isValid).toStrictEqual(true)
})

test.each([
  ['  aaaa'],
  ['test test'],
  ['a@hoge'],
  ['&amp;aa%&gt;&lt;'],
  ['@hoge'],
  ['insert'],
  ['update'],
  ['find'],
  ['remove'],
  ['removed'],
  ['X-'],
  ['x-'],
  ['here'],
  ['online'],
  ['all'],
  ['channel'],
  ['a'],
  ['a'.repeat(ACCOUNT_STR.MAX_LENGTH + 1)],
  ['-a'],
  ['_a']
])('isValidAccount fail (%s)', (arg: string) => {
  const isValid = isValidAccount(arg)
  expect(isValid).toStrictEqual(false)
})
