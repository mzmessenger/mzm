import React from 'react'
import styled from '@emotion/styled'
import { LoginHeader as Header } from '../../components/atoms/LoginHeader'
import { Link } from '../../components/atoms/Link'
import LoginButtons from './Buttons'

const Login = () => {
  return (
    <Wrap>
      <Header />
      <div className="login">
        <h4>
          <Link to="/tos">利用規約</Link>に同意してログイン
        </h4>
        <LoginButtons />
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
