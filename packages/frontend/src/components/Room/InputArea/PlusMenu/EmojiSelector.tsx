import React, { forwardRef, useState, type MutableRefObject } from 'react'
import styled from '@emotion/styled'
import {
  WIDTH_MOBILE,
  emojis,
  type EmojisKey,
  type EmojisValue
} from '../../../../constants'
import Dialog from '../../../Dialog'

const emojiList = Array.from(emojis.entries())

export type EmojiSelectorProps = {
  onSelect: (key: string, value: EmojisValue) => void
  onClose?: () => void
}

function EmojiSelector(
  props: EmojiSelectorProps,
  ref: MutableRefObject<HTMLDialogElement>
) {
  const [emojiKey, setEmojiKey] = useState<EmojisKey>(emojiList[0][0])

  const candidateEmoji = emojis.get(emojiKey) ?? emojiList[0][1]

  return (
    <Dialog ref={ref} onClose={props.onClose}>
      <Wrap>
        <h4>絵文字</h4>
        <div className="selector">
          <ul>
            {emojiList.map(([key, value]) => {
              return (
                <li
                  className="emoji"
                  key={key}
                  onMouseOver={() => setEmojiKey(key)}
                >
                  <button
                    className="value"
                    onClick={() => props.onSelect(key, value)}
                  >
                    {value.value}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="candidate">
            <div className="emoji">
              <span className="value">{candidateEmoji.value}</span>
              <span className="key">{emojiKey}</span>
            </div>
          </div>
        </div>
      </Wrap>
    </Dialog>
  )
}
export default forwardRef(EmojiSelector)

const Wrap = styled.div`
  padding: 1em;
  bottom: calc(100% + 8px);
  min-width: 360px;

  @container page-container (max-width: ${WIDTH_MOBILE}px) {
    max-width: calc(100% - 2em);
  }

  h4 {
    margin: 0;
    padding: 10px 0;
  }

  .selector {
    border-top: 1px solid var(--color-border);
    margin-top: 0.5em;
    padding-top: 1em;

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1px;
      grid-template-columns: repeat(auto-fill, 48px);
    }

    li {
      width: 48px;
      height: 48px;
      &:first-of-type {
        margin-top: 0;
      }
    }

    .emoji {
      button {
        width: 100%;
        height: 100%;
        padding: 0;
        background: none;
        border: none;
        &:hover {
          background: var(--color-surface);
        }
      }

      .value {
        font-size: 1.5em;
      }
    }
  }

  .candidate {
    border-top: 1px solid var(--color-border);
    margin-top: 1em;
    padding: 1em;
    background: #282c34;

    .emoji {
      display: flex;
      align-items: center;
    }

    .value {
      font-size: 1.5em;
    }

    .key {
      margin-left: 1em;
      font-size: 1em;
    }
  }
`
