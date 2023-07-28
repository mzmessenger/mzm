import React, { useState, useEffect } from 'react'
import styled from '@emotion/styled'
import {
  Twitter as TwitterIcon,
  GitHub as GitHubIcon
} from '@mui/icons-material'
import { LoginHeader as Header } from '../components/atoms/LoginHeader'
import { Link } from '../components/atoms/Link'
import { pkceChallenge } from '../lib/auth'
import { AUTH_URL_BASE } from '../constants'
import { Loading } from '../components/Loading'

const LoginButtons = (props: { codeChallenge: string }) => {
  const queryParams = new URLSearchParams([
    ['code_challenge', props.codeChallenge],
    ['code_challenge_method', 'S256']
  ])

  return (
    <div className="button">
      <a
        href={`${AUTH_URL_BASE}/auth/twitter?${queryParams.toString()}`}
        className="login-link"
      >
        <TwitterIcon className="icon" />
        Twitter
      </a>
      <a
        href={`${AUTH_URL_BASE}/auth/github?${queryParams.toString()}`}
        className="login-link"
      >
        <GitHubIcon className="icon" />
        GitHub
      </a>
    </div>
  )
}

const Login = () => {
  const [codeChallenge, setCodeChallenge] = useState('')
  // @todo worker
  useEffect(() => {
    pkceChallenge().then(({ code_challenge }) => {
      setCodeChallenge(code_challenge)
    })
  }, [])

  return (
    <Wrap>
      <Header />
      <div className="login">
        <h4>
          <Link to="/tos">利用規約</Link>に同意してログイン
        </h4>
        {codeChallenge === '' ? (
          <Loading />
        ) : (
          <LoginButtons codeChallenge={codeChallenge} />
        )}
      </div>
      <div className="attention">
        <h2>注意事項</h2>
        <p>
          MZMはβリリース中です。エラーの発生や予告なくデータの削除等が発生する可能性があります。
        </p>
      </div>
      <div className="policy-link">
        <Link to="/tos">利用規約</Link>
        <Link to="/privacy-policy">プライバシーポリシー</Link>
      </div>
    </Wrap>
  )
}
export default Login

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  .login {
    color: var(--color-on-background);
    h4 {
      a {
        margin: 0 0.5em 0 0;
      }
    }
    .button {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-gap: 1em;
      margin: 1em 0 0 0;
    }
    .login-link {
      padding: 0 14px 0 10px;
      font-size: 1rem;
      background-color: var(--color-guide);
      color: var(--color-on-guide);
      border-radius: 4px;
      height: 40px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .icon {
      width: 20px;
      height: 20px;
      background-size: contain;
      margin: 0 8px 0 0;
    }
  }

  .attention {
    max-width: 90vw;
    padding: 20px;
    background-color: var(--color-surface);
    color: var(--color-on-surface);
    margin: 40px 0 0 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .policy-link {
    margin: 40px 0 0 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 8px;
  }
`
