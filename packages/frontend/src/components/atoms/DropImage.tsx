import React, { useEffect, useRef } from 'react'
import styled from '@emotion/styled'
import ImageIcon from '@mui/icons-material/Image'

type Props = {
  onloadFile: (file: string) => void
}

export const DropImage: React.FC<Props> = ({ onloadFile }) => {
  const fileInputRef = useRef(null)

  // ターゲット以外の場所にdropしてしまった時にブラウザで画像を開かないように
  useEffect(() => {
    const _onDragOver: EventListener = (e) => e.preventDefault()
    const _onDrop: EventListener = (e) => e.preventDefault()
    document.addEventListener('dragover', _onDragOver, false)
    document.addEventListener('drop', _onDrop, false)

    return () => {
      document.removeEventListener('dragover', _onDragOver)
      document.removeEventListener('drop', _onDrop)
    }
  }, [])

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (
      e.dataTransfer.types &&
      Array.from(e.dataTransfer.types).includes('Files')
    ) {
      e.dataTransfer.dropEffect = 'copy'
      e.preventDefault()
    }
  }

  const onClickDrop = () => {
    fileInputRef.current.click()
  }

  const openFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const [file] = Array.from(e.target.files)
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      onloadFile(reader.result.toString())
      fileInputRef.current.value = ''
    }
    reader.readAsDataURL(file)
  }

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()

    const data = e.dataTransfer

    const [file] = Array.from(data.files).filter(
      (f) => f.type.includes('image/jpeg') || f.type.includes('image/png')
    ) as Blob[]

    const reader = new FileReader()
    reader.onload = () => {
      onloadFile(reader.result.toString())
      fileInputRef.current.value = ''
    }
    reader.readAsDataURL(file)
  }
  return (
    <Wrap
      className="drop"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onClick={onClickDrop}
    >
      <div className="drop-inner">
        <ImageIcon />
        <span>Drop</span>
        <input
          type="file"
          accept=".jpg,.jpeg,.png"
          onChange={openFile}
          ref={fileInputRef}
        />
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
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
`
