import React, {
  useState,
  useEffect,
  type MouseEventHandler,
  type PropsWithChildren
} from 'react'
import styled from '@emotion/styled'
import {
  Twitter as TwitterIcon,
  GitHub as GitHubIcon
} from '@mui/icons-material'
import { pkceChallenge, savePkceChallenge } from '../../lib/auth'
import { AUTH_URL_BASE, REDIRECT_URI } from '../../constants'
import { Loading } from '../../components/Loading'

function LoginButton(
  props: PropsWithChildren<{
    target: string
    onClick: MouseEventHandler<HTMLButtonElement>
  }>
) {
  return (
    <button
      className="login-button"
      value={props.target}
      onClick={(e) => {
        e.preventDefault()
        props.onClick(e)
        location.href = props.target
      }}
    >
      {props.children}
    </button>
  )
}

export default function LoginButtons() {
  const [pkce, setPkce] = useState({ codeChallenge: '', codeVerifier: '' })
  useEffect(() => {
    pkceChallenge().then(({ code_challenge, code_verifier }) => {
      setPkce({ codeChallenge: code_challenge, codeVerifier: code_verifier })
    })
  }, [])

  if (pkce.codeChallenge === '') {
    return <Loading />
  }

  const queryParams = new URLSearchParams([
    ['code_challenge', pkce.codeChallenge],
    ['code_challenge_method', 'S256'],
    ['redirect_uri', REDIRECT_URI]
  ])

  const save = () => {
    return savePkceChallenge({
      code_challenge: pkce.codeChallenge,
      code_verifier: pkce.codeVerifier
    })
  }

  return (
    <Wrap>
      <LoginButton
        target={`${AUTH_URL_BASE}/auth/twitter?${queryParams.toString()}`}
        onClick={() => save()}
      >
        <TwitterIcon className="icon" />
        Twitter
      </LoginButton>
      <LoginButton
        target={`${AUTH_URL_BASE}/auth/github?${queryParams.toString()}`}
        onClick={() => save()}
      >
        <GitHubIcon className="icon" />
        GitHub
      </LoginButton>
    </Wrap>
  )
}

const Wrap = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 1em;
  margin: 1em 0 0 0;

  .login-button {
    padding: 0 14px 0 10px;
    font-size: 1rem;
    background-color: var(--color-guide);
    color: var(--color-on-guide);
    border-radius: 4px;
    border: none;
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
`
