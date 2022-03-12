import React, { useState, useCallback } from 'react'
import styled from '@emotion/styled'
import { isValidAccount } from 'mzm-shared/validator'
import { WIDTH_MOBILE } from '../../lib/constants'
import { useUser, useDispatchUser } from '../../contexts/user/hooks'
import { Button } from '../atoms/Button'
import { InputText, Props as InputTextProps } from '../atoms/InputText'
import { DropImage } from '../atoms/DropImage'
import { SocialAccounts } from './SocialAccounts'
import { ModalIcon } from '../atoms/ModalIcon'

const ERROR_TXT = '利用できない文字が含まれるか、すでに存在するアカウントです。'

export const SettingAccount = () => {
  const { me } = useUser()
  const { uploadIcon, updateUser } = useDispatchUser()
  const [open, setOpen] = useState(false)
  const [image, setImage] = useState('')
  const [edit, setEdit] = useState(false)
  const [accountText, setAccountText] = useState(me.account ?? '')
  const [accountErrorText, setAccountErrorText] = useState('')

  const onSave = useCallback(() => {
    setEdit(false)
    if (me.account !== accountText) {
      updateUser(accountText).then((res) => {
        if (res.status === 400) {
          setAccountErrorText(ERROR_TXT)
        }
      })
    }
  }, [accountText, me.account, updateUser])

  const onCancel = useCallback(() => {
    setEdit(false)
    setAccountText(me.account ?? '')
  }, [me.account])

  const onModalSave = useCallback(
    (image: Blob) => {
      uploadIcon(image).then((res) => {
        if (res.ok) {
          onSave()
          setOpen(false)
        } else {
          res.text().then((text) => {
            alert(`アップロードにエラーが発生しました(${text})`)
          })
        }
      })
    },
    [onSave, uploadIcon]
  )

  const onModalCancel = useCallback(() => {
    setOpen(false)
  }, [])

  const onEdit = useCallback(() => {
    setEdit(true)
  }, [])

  const onloadFile = useCallback((file: string) => {
    setImage(file)
    setOpen(true)
  }, [])

  const onChangeAccount: InputTextProps['onChange'] = useCallback((e) => {
    const value = e.currentTarget.value
    setAccountText(value)
    if (isValidAccount(value)) {
      setAccountErrorText('')
    } else {
      setAccountErrorText(ERROR_TXT)
    }
  }, [])

  return (
    <Wrap>
      <div className="icon">
        {edit && <DropImage onloadFile={onloadFile} />}
        {!edit && <img src={me.iconUrl} />}
      </div>
      <ul className="info">
        <li>
          <h4>ユーザーID</h4>
          <span>{me.id}</span>
        </li>
        <li>
          <h4>ユーザー名</h4>
          {edit && (
            <InputText
              value={accountText}
              onChange={onChangeAccount}
              errorText={accountErrorText}
            />
          )}
          {!edit && <span>{accountText}</span>}
        </li>
        <li>
          <SocialAccounts />
        </li>
      </ul>
      <div className="button">
        {edit && (
          <>
            <Button className="cancel" onClick={onCancel}>
              キャンセル
            </Button>
            <Button className="save" onClick={onSave}>
              保存
            </Button>
          </>
        )}
        {!edit && (
          <Button className="edit" onClick={onEdit}>
            編集
          </Button>
        )}
      </div>
      <ModalIcon
        image={image}
        open={open}
        onSave={onModalSave}
        onCancel={onModalCancel}
      />
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;

  .button {
    display: flex;
    flex-direction: column;

    button {
      width: 100px;
      height: 32px;
    }
    .cancel {
      background: none;
    }
    .save {
      margin: 1em 0 0 0;
    }
  }

  .info {
    list-style-type: none;
    margin: 0;
    padding: 1em 0;
    > li {
      padding: 1em 1em 0;
    }
    flex: 1;
    span {
      font-size: 16px;
    }
  }

  .icon {
    .drop,
    img {
      padding: 1em;
      width: 100px;
      height: 100px;
    }
    .drop {
      border: dashed 2px var(--color-border);
      border-radius: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      .drop-inner {
        display: flex;
        span {
          margin-left: 4px;
          line-height: 27px;
        }
        input {
          display: none;
        }
      }
    }
  }

  @media (max-width: ${WIDTH_MOBILE}px) {
    flex-direction: column;
  }
`
