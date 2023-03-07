import React, { useState, useRef, useEffect } from 'react'
import styled from '@emotion/styled'
import Add from '@mui/icons-material/Add'
import SendIcon from '@mui/icons-material/Send'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { WIDTH_MOBILE } from '../../../lib/constants'
import { useCurrentRoom } from '../../../recoil/rooms/hooks'
import { useSocketActions } from '../../../recoil/socket/hooks'
import { usePostTextArea } from '../../../recoil/postTextArea/hooks'
import { Button } from '../../atoms/Button'
import { ResizerY } from '../../atoms/ResizerY'
import { TextArea } from '../../atoms/TextArea'
import { VoteMessageBox } from './VoteMessageBox'
import { useNumberLocalStorage } from '../../../lib/hooks/useLocalStorage'

const HEIGHT_KEY = 'mzm:input:height'

export const InputArea = () => {
  const { currentRoomId } = useCurrentRoom()
  const {
    postTextArea: { txt, editTxt, editId, inputMode },
    inputMessage,
    endToEdit,
    modifyMessage
  } = usePostTextArea()
  const [rows, setRows] = useState(
    inputMode === 'normal' ? txt.split('\n').length : editTxt.split('\n').length
  )
  const textareaRef = useRef(null)
  const [height, setHeight] = useNumberLocalStorage(HEIGHT_KEY, 68)
  const [showVote, setShowVote] = useState(false)

  const { sendMessage, sendModifyMessage } = useSocketActions()

  useEffect(() => {
    if (inputMode === 'edit') {
      textareaRef.current.focus()
    }
  }, [inputMode])

  const submit = () => {
    if (inputMode === 'normal') {
      sendMessage(txt, currentRoomId)
      inputMessage('')
    } else if (inputMode === 'edit') {
      sendModifyMessage(editTxt, editId)
      endToEdit()
    }
    setRows(1)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    submit()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.shiftKey && e.keyCode === 13) {
      e.preventDefault()
      submit()
      return
    }
  }

  const onChange = (e) => {
    const value = e.target.value
    if (inputMode === 'normal') {
      inputMessage(value)
    } else if (inputMode === 'edit') {
      modifyMessage(value)
    }
    setRows(value.split('\n').length)
  }

  const classNames = ['form-wrap']
  if (inputMode === 'edit') {
    classNames.push('edit')
  }

  return (
    <Wrap style={{ minHeight: height }}>
      <ResizerY height={height} setHeight={setHeight} />
      {showVote && (
        <VoteMessageBox
          onSave={() => setShowVote(false)}
          onCancel={() => setShowVote(false)}
        />
      )}
      <div className={classNames.join(' ')}>
        <div className="attach-wrap">
          <button className="attach-button" onClick={() => setShowVote(true)}>
            <Add />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <TextArea
            className="text-area-wrap"
            value={inputMode === 'edit' ? editTxt : txt}
            rows={rows}
            onKeyDown={onKeyDown}
            onChange={onChange}
            ref={textareaRef}
          />
          <div className="button-area">
            <div style={{ flex: '1' }}></div>
            {inputMode === 'edit' && (
              <CancelButton onClick={() => endToEdit()}>
                <span className="text">キャンセル</span>
                <span className="icon">
                  <CancelOutlinedIcon />
                </span>
              </CancelButton>
            )}
            <SendButton type="submit">
              <span className="text">投稿</span>
              <span className="icon">
                <SendIcon />
              </span>
            </SendButton>
          </div>
        </form>
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0 15px;
  color: var(--color-on-background);
  border-top: 1px solid var(--color-border);

  .form-wrap {
    padding: 10px 0;
    flex: 1;
    display: flex;
  }

  form {
    flex: 1;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .form-wrap.edit {
    .text-area-wrap {
      border: 1px solid hsl(46.8, 79.3%, 52.7%);
    }
  }

  .attach-wrap {
    height: 100%;
    display: flex;
    align-items: center;
    margin-right: 10px;

    .attach-button {
      border-radius: 50%;
      padding: 0px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }

  .text-area-wrap {
    height: 100%;
    flex: 1;
    margin-right: 10px;
  }

  .button-area {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
`

const SendButton = styled(Button)`
  padding: 0 1em;
  display: inline-flex;
  justify-content: center;
  height: 40px;
  .text {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    margin-right: 0.5em;
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  @container page-container (max-width: ${WIDTH_MOBILE}px) {
    border-radius: 50%;
    width: 40px;
    .text {
      display: none;
    }
  }
`

const CancelButton = styled(Button)`
  margin-bottom: 8px;
  padding: 0 1em;
  display: inline-flex;
  justify-content: center;
  height: 40px;
  border: 1px solid #90caf9;
  background: var(--color-guide);

  .text {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    margin-right: 0.5em;
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  @container page-container (max-width: ${WIDTH_MOBILE}px) {
    border-radius: 50%;
    width: 40px;
    .text {
      display: none;
    }
  }
`
