import { useCallback } from 'react'
import { atom, useAtom } from 'jotai'

type PostTextAreaState = {
  inputMode: 'normal' | 'edit'
  txt: string
  editTxt: string
  editId: string
}

const postTextAreaState = atom<PostTextAreaState>({
  inputMode: 'normal',
  txt: '',
  editTxt: '',
  editId: null
})

export const usePostTextArea = () => {
  const [postTextArea, setPostTextArea] = useAtom(postTextAreaState)

  const startToEdit = useCallback(
    (messageId: string, txt: string) => {
      setPostTextArea((current) => ({
        ...current,
        inputMode: 'edit',
        editTxt: txt,
        editId: messageId
      }))
    },
    [setPostTextArea]
  )

  const endToEdit = useCallback(() => {
    setPostTextArea((current) => ({
      ...current,
      inputMode: 'normal',
      editTxt: '',
      editId: null
    }))
  }, [setPostTextArea])

  const modifyMessage = useCallback(
    (txt: string) => {
      setPostTextArea((current) => ({
        ...current,
        editTxt: txt
      }))
    },
    [setPostTextArea]
  )

  const inputMessage = useCallback(
    (txt: string) => {
      setPostTextArea((current) => ({
        ...current,
        txt
      }))
    },
    [setPostTextArea]
  )

  return {
    postTextArea,
    startToEdit,
    endToEdit,
    modifyMessage,
    inputMessage
  } as const
}
