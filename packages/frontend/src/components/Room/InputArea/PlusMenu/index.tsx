import React, { useRef } from 'react'
import styled from '@emotion/styled'
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions'
import EditNoteIcon from '@mui/icons-material/EditNote'
import ListItem from './ListItem'
import EmojiSelector, { type EmojiSelectorProps } from './EmojiSelector'
import VoteMessageBox from './VoteMessageBox'

type Props = {
  open: boolean
  onClose: () => void
  onEmojiSelect: EmojiSelectorProps['onSelect']
  onEmojiClose?: () => void
  onVoteCancel?: () => void
}

export default function PlusMenu(props: Props) {
  const emojiRef = useRef(null)
  const voteRef = useRef(null)

  return (
    <>
      <Wrap className={props.open ? 'open' : ''}>
        <div>
          <ul>
            <li
              onClick={() => {
                emojiRef.current.showModal()
                props.onClose()
              }}
            >
              <ListItem
                icon={<EmojiEmotionsIcon fontSize="small" />}
                text="emoji"
              />
            </li>
            <li
              onClick={() => {
                voteRef.current.showModal()
                props.onClose()
              }}
            >
              <ListItem
                icon={<EditNoteIcon fontSize="small" />}
                text="アンケート"
              />
            </li>
          </ul>
        </div>
      </Wrap>
      <EmojiSelector
        ref={emojiRef}
        onSelect={(key, value) => {
          props.onEmojiSelect(key, value)
          emojiRef.current.close()
        }}
        onClose={() => props.onEmojiClose()}
      />
      <VoteMessageBox
        ref={voteRef}
        onSave={() => voteRef.current.close()}
        onCancel={() => voteRef.current.close()}
      />
    </>
  )
}

const Wrap = styled.div`
  visibility: hidden;
  position: absolute;
  max-width: 400px;
  bottom: calc(100% + 8px);
  left: 0.5em;
  padding: 0.5em;
  background: var(--color-background);
  color: var(--color-on-surface);
  border: solid 1px var(--color-base);
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(4, 4, 5, 0.15);

  &.open {
    visibility: visible;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    margin-top: 1em;
    cursor: pointer;
    padding: 1em;

    &:first-of-type {
      margin-top: 0;
    }

    &:hover {
      background: var(--color-surface);
    }
  }
`
