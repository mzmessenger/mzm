import React, { useState, useRef, useEffect } from 'react'
import styled from '@emotion/styled'
import Add from '@mui/icons-material/Add'
import { useRooms } from '../contexts/rooms/hooks'
import { useDispatchSocket } from '../contexts/socket/hooks'
import {
  usePostTextArea,
  useDispatchPostTextArea
} from '../contexts/postTextArea/hooks'
import { Button } from './atoms/Button'
import ResizerY from './atoms/ResizerY'
import TextArea from './atoms/TextArea'
import VoteMessageBox from './VoteMessageBox'

const HEIGHT_KEY = 'mzm:input:height'

const InputArea = () => {
  const { currentRoomId } = useRooms()
  const { txt, editTxt, editId, inputMode } = usePostTextArea()
  const { inputMessage, endToEdit, modifyMessage } = useDispatchPostTextArea()
  const [rows, setRows] = useState(
    inputMode === 'normal' ? txt.split('\n').length : editTxt.split('\n').length
  )
  const textareaRef = useRef(null)
  const [height, _setHeight] = useState(
    localStorage.getItem(HEIGHT_KEY)
      ? parseInt(localStorage.getItem(HEIGHT_KEY), 10)
      : 68
  )
  const [showVote, setShowVote] = useState(false)

  const { sendMessage, sendModifyMessage } = useDispatchSocket()

  const setHeight = (h: number) => {
    _setHeight(h)
    localStorage.setItem(HEIGHT_KEY, `${h}`)
  }

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
                キャンセル
              </CancelButton>
            )}
            <SendButton type="submit">投稿</SendButton>
          </div>
        </form>
      </div>
    </Wrap>
  )
}
export default InputArea

const Wrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0 15px;
  color: var(--color-on-background);

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
    width: 100px;
  }
`

const SendButton = styled(Button)`
  height: 40px;
`

const CancelButton = styled(Button)`
  margin-bottom: 8px;
  height: 40px;
  background: var(--color-guide);
`
