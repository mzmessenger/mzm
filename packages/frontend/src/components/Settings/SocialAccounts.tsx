import React, { ReactNode } from 'react'
import styled from '@emotion/styled'
import {
  LinkOff as LinkOffIcon,
  Twitter as TwitterIcon,
  GitHub as GitHubIcon
} from '@mui/icons-material'
import { useAuth } from '../../state/auth/hooks'
import {
  useSocialAccount,
  useRemoveAccountActions
} from '../../state/user/hooks'

export const SocialAccounts = () => {
  const { twitterUserName, githubUserName } = useSocialAccount()
  const { getAccessTokenFromIframe } = useAuth()
  const { removeTwitter, removeGithub } = useRemoveAccountActions()

  const isTwitterLinked = !!twitterUserName
  const isGithubLinked = !!githubUserName

  const onRemoveTwitter = () => {
    removeTwitter(() => {
      getAccessTokenFromIframe()
    })
  }

  const onRemoveGithub = () => {
    removeGithub(() => {
      getAccessTokenFromIframe()
    })
  }

  return (
    <Wrap>
      <header>ソーシャルログイン</header>
      <div className="accounts">
        <div className="login-account">
          <h4>Twitter</h4>
          <AccountLink
            type="Twitter"
            href="/auth/twitter"
            renderIcon={({ className }) => (
              <TwitterIcon className={className} />
            )}
            isLinked={isTwitterLinked}
            onRemoveHandler={onRemoveTwitter}
          />
        </div>
        <div className="login-account">
          <h4>GitHub</h4>
          <AccountLink
            type="GitHub"
            href="/auth/github"
            renderIcon={({ className }) => <GitHubIcon className={className} />}
            isLinked={isGithubLinked}
            onRemoveHandler={onRemoveGithub}
          />
        </div>
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  .accounts {
    margin-top: 4px;
    display: flex;
  }

  .login-account {
    display: flex;
    flex-direction: column;
    margin: 0 0 0 1em;
  }
  .login-account:first-of-type {
    margin-left: 0;
  }

  @container user-info-container (max-width: 540px) {
    .accounts {
      flex-direction: column;
      .login-account {
        margin: 0.5em 0 0 0;
      }
    }
  }
`

function AccountLink(props: {
  type: 'Twitter' | 'GitHub'
  href: string
  isLinked: boolean
  renderIcon: (props: { className: string }) => ReactNode
  onRemoveHandler: () => void
}) {
  if (props.isLinked) {
    return (
      <WrapAccountLink className="lock" onClick={props.onRemoveHandler}>
        <span>
          <LinkOffIcon className="account-link-icon" />
          {props.type}ログインを解除する
        </span>
      </WrapAccountLink>
    )
  }

  return (
    <WrapAccountLink href={props.href}>
      <span>
        {props.renderIcon({ className: 'account-link-icon' })}
        {props.type}ログイン
      </span>
    </WrapAccountLink>
  )
}

const WrapAccountLink = styled.a`
  padding: 0 10px 0 10px;
  font-size: 1rem;
  background-color: var(--color-guide);
  color: var(--color-on-guide);
  border-radius: 4px;
  height: 40px;
  margin: 0.5em 0 0 0;

  &.lock {
    cursor: not-allowed;
  }

  &:visited {
    color: var(--color-on-guide);
  }

  .account-link-icon {
    margin: 0 8px 0 0;
  }

  span {
    height: 100%;
    display: flex;
    align-items: center;
  }
`
