import isEmpty from 'validator/lib/isEmpty'
import { ACCOUNT_STR } from './constants'

export const isValidAccount = (account: string): boolean => {
  if (
    isEmpty(account, { ignore_whitespace: true }) ||
    !/^([a-zA-Z\d])/.test(account) ||
    /.*(insert|update|find|remove).*/.test(account) ||
    /^(here|all|online|channel)$/.test(account) ||
    /^(X|x)-/.test(account)
  ) {
    return false
  } else if (
    account.length < ACCOUNT_STR.MIN_LENGTH ||
    account.length > ACCOUNT_STR.MAX_LENGTH
  ) {
    return false
  }
  return /^[a-zA-Z\d_-]+$/.test(account)
}
