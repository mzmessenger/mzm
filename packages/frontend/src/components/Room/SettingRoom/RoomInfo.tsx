import React from 'react'
import styled from '@emotion/styled'
import { TextArea, Props as TextAreaProps } from '../../atoms/TextArea'

export type Props = {
  edit: boolean
  id: string
  name: string
  description: string
  onChangeDescription: TextAreaProps['onChange']
}

export const RoomInfo: React.FC<Props> = (props) => {
  const description = props.description ?? '部屋の説明'

  return (
    <Wrap>
      <div className="info">
        <h4>ID</h4>
        <p className="item">{props.id}</p>
      </div>
      <div className="info">
        <h4>部屋名</h4>
        <p className="item room-name">{props.name}</p>
      </div>
      <div className="info">
        <h4>説明</h4>
        {props.edit && (
          <TextArea
            style={{ marginTop: '0.3em' }}
            onChange={props.onChangeDescription}
            value={props.description}
            rows={props.description.split('\n').length}
          />
        )}
        {!props.edit && <p className="item">{description}</p>}
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  flex: 1;
  padding: 0 1em 0;
  .info {
    margin-top: 2em;

    &:first-of-type {
      margin-top: 0;
    }

    h4 {
      font-size: small;
      color: var(--color-label);
    }

    .item {
      margin: 0.3em 0 0 0;
      padding: 0.5em;
      border-radius: 4px;
      border: 1px solid var(--color-border);
      font-size: 16px;
    }
  }

  p {
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .room-name {
    word-break: break-word;
  }
`
