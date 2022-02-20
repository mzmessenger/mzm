import React, { useMemo, useEffect, useState } from 'react'
import styled from '@emotion/styled'
import { TextArea, Props as TextAreaProps } from '../../atoms/TextArea'
import { MessageBody } from '../../atoms/MessageBody'
import { convertToHtml } from '../../../lib/markdown'

export type Props = {
  edit: boolean
  id: string
  name: string
  description: string
  onChangeDescription: TextAreaProps['onChange']
}

const Description: React.FC<{ description: string }> = (props) => {
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!props.description) {
      setDescription('')
      return
    }

    convertToHtml(props.description).then((html) => {
      setDescription(html)
    })
  }, [props.description])

  if (!props.description) {
    return <div className="item">部屋の説明</div>
  }

  return (
    <div className="item">
      <MessageBody message={props.description} html={description} />
    </div>
  )
}

export const RoomInfo: React.FC<Props> = (props) => {
  const rows = useMemo(() => {
    const minRows = 5
    if (!props.description) {
      return minRows
    }

    const d = props.description.split('\n').length
    const rows = d <= minRows ? minRows : d
    return rows
  }, [props.description])

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
            rows={rows}
          />
        )}
        {!props.edit && <Description description={props.description} />}
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

      p {
        margin: 0 0 0.5em 0;
      }
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
