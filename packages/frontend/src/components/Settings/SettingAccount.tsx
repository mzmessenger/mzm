import React, { useState, useCallback } from 'react'
import styled from '@emotion/styled'
import { isValidAccount } from 'mzm-shared/src/validator'
import { WIDTH_MOBILE } from '../../constants'
import { useUser, useUserIdAndAccount } from '../../recoil/user/hooks'
import { Button } from '../atoms/Button'
import { InputText, Props as InputTextProps } from '../atoms/InputText'
import { DropImage } from '../atoms/DropImage'
import { SocialAccounts } from './SocialAccounts'
import { ModalIcon } from '../atoms/ModalIcon'

const ERROR_TXT = '利用できない文字が含まれるか、すでに存在するアカウントです。'

export const SettingAccount = () => {
  const { userId, userAccount, userIconUrl } = useUserIdAndAccount()
  const { uploadIcon, updateUser } = useUser()
  const [open, setOpen] = useState(false)
  const [image, setImage] = useState('')
  const [edit, setEdit] = useState(false)
  const [accountText, setAccountText] = useState(userAccount ?? '')
  const [accountErrorText, setAccountErrorText] = useState('')

  const onSave = useCallback(() => {
    setEdit(false)
    if (userAccount !== accountText) {
      updateUser(accountText).then((res) => {
        if (res.status === 400) {
          setAccountErrorText(ERROR_TXT)
        }
      })
    }
  }, [accountText, userAccount, updateUser])

  const onCancel = useCallback(() => {
    setEdit(false)
    setAccountText(userAccount ?? '')
  }, [userAccount])

  const onModalSave = useCallback(
    (image: Blob) => {
      uploadIcon(image).then((res) => {
        if (res.ok) {
          onSave()
          setOpen(false)
        } else {
          alert(`アップロードでエラーが発生しました`)
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
        {!edit && <img src={userIconUrl} crossOrigin="anonymous" />}
      </div>
      <ul className="info">
        <li>
          <h4>ユーザーID</h4>
          <span>{userId}</span>
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
    padding: 1em 1em;

    button {
      width: 100px;
      height: 32px;
    }
    .cancel {
      background: none;
      border: 1px solid var(--color-border);
    }
    .save {
      margin: 1em 0 0 0;
    }
  }

  .info {
    list-style-type: none;
    margin: 0;
    padding: 1em 0;
    container-name: user-info-container;
    container-type: inline-size;
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

  @container page-container (max-width: ${WIDTH_MOBILE}px) {
    flex-direction: column;
  }
`
