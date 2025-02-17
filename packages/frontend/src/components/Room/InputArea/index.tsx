import React, {
  useState,
  useRef,
  useEffect,
  type FormEventHandler
} from 'react'
import styled from '@emotion/styled'
import Add from '@mui/icons-material/Add'
import SendIcon from '@mui/icons-material/Send'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { WIDTH_MOBILE } from '../../../constants'
import { useCurrentRoom } from '../../../state/rooms/hooks'
import { useSocketActions } from '../../../state/socket/hooks'
import { usePostTextArea } from '../../../state/postTextArea/hooks'
import { Button } from '../../atoms/Button'
import { ResizerY } from '../../atoms/ResizerY'
import { TextArea } from '../../atoms/TextArea'
import { useNumberLocalStorage } from '../../../lib/hooks/useLocalStorage'
import PlusMenu from './PlusMenu'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [height, setHeight] = useNumberLocalStorage(HEIGHT_KEY, 68)
  const [openPlusMenu, setOpenPlusMenu] = useState(false)
  const { sendMessage, sendModifyMessage } = useSocketActions()
  const [lastSelection, setLastSelection] = useState<{
    start: number
    end: number
  }>({ start: 0, end: 0 })

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

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
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

  const setInputText = (value: string) => {
    if (inputMode === 'normal') {
      inputMessage(value)
    } else if (inputMode === 'edit') {
      modifyMessage(value)
    }
    setRows(value.split('\n').length)
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputText(value)
  }

  const onEmojiSelect = (key: string) => {
    const value =
      lastSelection.start === 0
        ? key
        : txt.substring(0, lastSelection.start) +
          ` ${key} ` +
          txt.substring(lastSelection.start, textareaRef.current.value.length)
    textareaRef.current.value = value
    const position = lastSelection.end + key.length + 2
    textareaRef.current.selectionStart = position
    textareaRef.current.selectionEnd = position
    setInputText(value)
  }

  const classNames = ['form-wrap']
  if (inputMode === 'edit') {
    classNames.push('edit')
  }

  return (
    <Wrap style={{ minHeight: height }}>
      <ResizerY height={height} setHeight={setHeight} />
      <PlusMenu
        open={openPlusMenu}
        onClose={() => setOpenPlusMenu(false)}
        onEmojiSelect={onEmojiSelect}
        onEmojiClose={() => {
          textareaRef.current.focus()
        }}
        onVoteCancel={() => {
          textareaRef.current.focus()
        }}
      />
      <div className={classNames.join(' ')}>
        <div className="attach-wrap">
          <button
            className={'attach-button' + (openPlusMenu ? ' rotate' : '')}
            onClick={() => {
              setOpenPlusMenu(!openPlusMenu)
            }}
          >
            <Add />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <TextArea
            className="text-area-wrap"
            autoFocus={true}
            value={inputMode === 'edit' ? editTxt : txt}
            rows={rows}
            onKeyDown={onKeyDown}
            onChange={onChange}
            onSelect={() =>
              setLastSelection({
                start: textareaRef.current.selectionStart,
                end: textareaRef.current.selectionEnd
              })
            }
            ref={textareaRef}
          />
          <div className="button-area">
            <div style={{ flex: '1' }}></div>
            {inputMode === 'edit' && (
              <CancelButton
                onClick={() => {
                  textareaRef.current.focus()
                  endToEdit()
                }}
              >
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
      background-color: var(--color-input-background);
      color: var(--color-input);
      border-radius: 50%;
      border: none;
      padding: 2px;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: 0.3s ease-out;

      &.rotate {
        transform: rotate(45deg);
      }
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
