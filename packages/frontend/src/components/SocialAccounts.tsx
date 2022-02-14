import React from 'react'
import styled from 'styled-components'
import {
  LinkOff as LinkOffIcon,
  Twitter as TwitterIcon,
  GitHub as GitHubIcon
} from '@mui/icons-material'
import { WIDTH_MOBILE } from '../lib/constants'
import { useUser, useDispatchUser } from '../contexts/user/hooks'

const ShowAccount = () => {
  const { me } = useUser()
  const { removeTwitter, removeGithub } = useDispatchUser()

  const isTwitterLinked = !!me.twitterUserName
  const isGithubLinked = !!me.githubUserName

  const onRemoveTwitter = () => {
    removeTwitter()
  }

  const onRemoveGithub = () => {
    removeGithub()
  }

  const twitterClassName = isGithubLinked
    ? 'login-account'
    : 'login-account lock'

  const githubClassName = isTwitterLinked
    ? 'login-account'
    : 'login-account lock'

  return (
    <Wrap>
      <header>ソーシャルログイン</header>
      <div className="accounts">
        <div className={twitterClassName}>
          <h4>Twitter</h4>
          {isTwitterLinked && (
            <a className="account-link" onClick={onRemoveTwitter}>
              <LinkOffIcon className="account-link-icon" />
              twitterログインを解除する
            </a>
          )}
          {!isTwitterLinked && (
            <a href="/auth/twitter" className="account-link">
              <TwitterIcon className="account-link-icon" />
              Twitterログイン
            </a>
          )}
        </div>
        <div className={githubClassName}>
          <h4>GitHub</h4>
          {isGithubLinked && (
            <a className="account-link" onClick={onRemoveGithub}>
              <LinkOffIcon className="account-link-icon" />
              GitHubログインを解除する
            </a>
          )}
          {!isGithubLinked && (
            <a href="/auth/github" className="account-link">
              <GitHubIcon className="account-link-icon" />
              GitHubログイン
            </a>
          )}
        </div>
      </div>
    </Wrap>
  )
}
export default ShowAccount

const Wrap = styled.div`
  .accounts {
    margin-top: 4px;
    display: flex;
  }

  a {
    cursor: pointer;
  }
  .login-account.lock a {
    cursor: not-allowed;
  }

  .login-account {
    display: flex;
    flex-direction: column;
    margin: 0 0 0 1em;
  }
  .login-account:first-child {
    margin-left: 0;
  }

  .account-link {
    display: flex;
    align-items: center;
    padding: 0 10px 0 10px;
    font-size: 1rem;
    background-color: var(--color-guide);
    color: var(--color-on-guide);
    border-radius: 4px;
    height: 40px;
    margin: 0.5em 0 0 0;

    .account-link-icon {
      margin: 0 8px 0 0;
    }
  }

  @media (max-width: ${WIDTH_MOBILE}px) {
    .accounts {
      flex-direction: column;
      .login-account {
        margin: 0.5em 0 0 0;
      }
    }
  }
`
