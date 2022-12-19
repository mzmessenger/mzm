import { useState, useMemo, useCallback } from 'react'
import { useRooms, useRoomActions } from '../../../recoil/rooms/hooks'
import { useSocket } from '../../../recoil/socket/hooks'
import { Props as RoomInfoProps } from './RoomInfo'

export const useSettiongRooms = () => {
  const { currentRoomId, currentRoomName, roomsById } = useRooms()
  const { exitRoom, uploadIcon } = useRoomActions()
  const { getRooms, updateRoomDescription } = useSocket()
  const room = roomsById[currentRoomId]
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
    exitRoom(currentRoomId, getRooms)
  }, [exitRoom, currentRoomId, getRooms])

  const onLoadFile = (file: string) => {
    setImage(file)
    setOpen(true)
  }

  const onModalSave = useCallback(
    (image: Blob) => {
      uploadIcon(name, image).then((res) => {
        if (res.ok) {
          setOpen(false)
        } else {
          res.text().then((text) => {
            alert(`アップロードにエラーが発生しました(${text})`)
          })
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
