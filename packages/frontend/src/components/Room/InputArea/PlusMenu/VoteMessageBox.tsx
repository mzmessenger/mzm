import React, { useState, forwardRef } from 'react'
import styled from '@emotion/styled'
import { Add } from '@mui/icons-material'
import { WIDTH_MOBILE } from '../../../../constants'
import { useCurrentRoom } from '../../../../recoil/rooms/hooks'
import { useSocketActions } from '../../../../recoil/socket/hooks'
import { TextArea } from '../../../atoms/TextArea'
import { Button } from '../../../atoms/Button'
import { TransparentButton } from '../../../atoms/Button'
import { Question } from './Question'
import Dialog from '../../../Dialog'

type Props = {
  onSave: (e: React.MouseEvent) => void
  onCancel: (e: React.MouseEvent) => void
}

function VoteMessageBox({ onSave, onCancel }: Props, ref) {
  const { currentRoomId } = useCurrentRoom()
  const [text, setText] = useState('候補日')
  const [questions, setQuestions] = useState<string[]>(['4/1', '4/2', '4/3'])
  const { sendMessage } = useSocketActions()

  const onChange = (e) => {
    setText(e.target.value)
  }

  const onQuestionChange = (e, i: number) => {
    questions[i] = e.target.value
    setQuestions([...questions])
  }

  const onQuestionClear = (e, i: number) => {
    if (questions.length <= 1) {
      return
    }
    questions.splice(i, 1)
    setQuestions([...questions])
  }

  const addQuestion = () => setQuestions([...questions, ''])

  const post = async (e) => {
    const q = questions
      .filter((e) => e.trim())
      .map((e) => {
        return {
          text: e
        }
      })
    const vote = { questions: q }
    await sendMessage(text, currentRoomId, vote)
    onSave(e)
  }

  return (
    <Dialog ref={ref}>
      <VoteWrap>
        <h4>アンケート</h4>
        <p>本文</p>
        <div className="text-area">
          <TextArea value={text} onChange={onChange} rows={4} />
        </div>
        <p>選択肢</p>
        <div className="questions">
          {questions.map((q, i) => {
            return (
              <Question
                key={i}
                value={q}
                onChange={(e) => onQuestionChange(e, i)}
                onClear={(e) => onQuestionClear(e, i)}
                showClearButton={questions.length > 1}
              />
            )
          })}
        </div>
        {questions.length <= 10 && (
          <button onClick={addQuestion} className="add-button">
            <Add />
            追加
          </button>
        )}
        <div className="buttons">
          <TransparentButton className="cancel-button" onClick={onCancel}>
            キャンセル
          </TransparentButton>
          <Button style={{ height: '40px', minWidth: '100px' }} onClick={post}>
            投稿
          </Button>
        </div>
      </VoteWrap>
    </Dialog>
  )
}
export default forwardRef(VoteMessageBox)

const VoteWrap = styled.div`
  padding: 1em;
  bottom: calc(100% + 8px);
  width: 780px;

  @container page-container (max-width: ${WIDTH_MOBILE}px) {
    max-width: calc(100% - 2em);
  }

  h4 {
    margin: 0;
    padding: 10px 0;
  }

  .text-area {
    width: 100%;
  }

  .questions {
    max-width: 480px;
    display: flex;
    flex-direction: column;
  }

  .add-button {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: transparent;
    border: 1px solid var(--color-on-primary);
    border-radius: 2px;
    color: var(--color-on-primary);
    padding: 2px 8px 2px 4px;
    margin: 8px 0;
  }

  .buttons {
    padding: 16px 0 0 0;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--color-border);
  }

  .cancel-button {
    margin-right: 8px;
  }
`
