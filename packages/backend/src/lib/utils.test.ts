import { popParam, repliedAccounts } from './utils'

test.each([
  [null, ''],
  [undefined, ''],
  ['', ''],
  [' ', ''],
  ['　', ''],
  ['　 　', ''],
  ['aaa', 'aaa'],
  ['  aaaa', 'aaaa'],
  ['&aa%><', '&amp;aa%&gt;&lt;']
])('popParam (%s)', (arg, answer) => {
  const pop = popParam(arg)
  expect(pop).toStrictEqual(answer)
})

test.each([
  ['@dev', ['dev']],
  ['@dev-1', ['dev-1']],
  ['@dev1 ', ['dev1']],
  [' @dev1', ['dev1']],
  [' @dev ', ['dev']],
  ['a @dev ', ['dev']],
  ['@dev1 @dev2 @dev3', ['dev1', 'dev2', 'dev3']],
  ['@dev1 @dev2 message @dev3 @dev4', ['dev1', 'dev2', 'dev3', 'dev4']],
  // uniq
  ['@dev1 @dev3 @dev2 @dev2 @dev1', ['dev1', 'dev2', 'dev3']]
])('repliedAccount (%s)', (message, accounts) => {
  const replied = repliedAccounts(message)
  expect(replied.length).toEqual(accounts.length)
  expect(replied.sort().join('')).toEqual(accounts.sort().join(''))
})

test.each([['@dev.com'], ['a@dev.com']])(
  'repliedAccount: is not reply (%s)',
  (message) => {
    const replied = repliedAccounts(message)
    expect(replied.length).toStrictEqual(0)
  }
)
