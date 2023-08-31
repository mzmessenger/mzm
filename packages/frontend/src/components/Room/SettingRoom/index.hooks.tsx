import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useRoomActions,
  useCurrentRoom,
  useRoomById
} from '../../../recoil/rooms/hooks'
import { useSocketActions } from '../../../recoil/socket/hooks'
import { Props as RoomInfoProps } from './RoomInfo'

export const useSettiongRooms = () => {
  const navigate = useNavigate()
  const { currentRoomId, currentRoomName } = useCurrentRoom()
  const { getRooms, updateRoomDescription } = useSocketActions()
  const { exitRoom, uploadIcon } = useRoomActions({ getRooms })
  const room = useRoomById(currentRoomId)
  const [image, setImage] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(false)
  const [description, setDescription] = useState(room?.description || '')

  const { name, isGeneral } = useMemo(() => {
    const name = currentRoomName || ''
    const isGeneral = name === 'general'
    return { name, isGeneral }
  }, [currentRoomName])

  const iconUrl = useMemo(() => {
    return room?.iconUrl
  }, [room])

  const onExit = useCallback(() => {
    exitRoom({ room: currentRoomId })
    navigate('/')
  }, [exitRoom, currentRoomId, navigate])

  const onLoadFile = (file: string) => {
    setImage(file)
    setOpen(true)
  }

  const onModalSave = useCallback(
    (image: Blob) => {
      uploadIcon({ roomName: name }, image).then((res) => {
        if (res.ok) {
          setOpen(false)
        } else {
          alert(`アップロードでエラーが発生しました`)
        }
      })
    },
    [name, uploadIcon]
  )

  const onModalCancel = useCallback(() => {
    setOpen(false)
  }, [])

  const onEdit = useCallback(() => {
    setEdit(true)
  }, [])

  const onSave = useCallback(() => {
    setImage('')
    setEdit(false)
    if (room.description !== description) {
      updateRoomDescription(currentRoomId, description)
    }
  }, [currentRoomId, description, room?.description, updateRoomDescription])

  const onCancel = useCallback(() => {
    setImage('')
    setEdit(false)
  }, [])

  const onChangeDescription: RoomInfoProps['onChangeDescription'] = useCallback(
    (e) => {
      setDescription(e.target.value)
    },
    []
  )

  return {
    id: currentRoomId,
    name,
    iconUrl,
    isGeneral,
    image,
    open,
    edit,
    description,
    onExit,
    onLoadFile,
    onModalSave,
    onModalCancel,
    onEdit,
    onSave,
    onCancel,
    onChangeDescription
  }
}
