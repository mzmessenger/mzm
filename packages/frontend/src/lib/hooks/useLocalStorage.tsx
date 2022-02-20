import { useState } from 'react'

const getNumberItem = (key: string, defaultValue: number) => {
  const item = localStorage.getItem(key)
  if (!item) {
    return defaultValue
  }
  const parsed = Number(item)
  return parsed
}

export const useNumberLocalStorage = (key: string, defaultValue: number) => {
  const [value, setValue] = useState(getNumberItem(key, defaultValue))

  const setItem = (val: number) => {
    localStorage.setItem(key, `${val}`)
    setValue(val)
  }

  return [value, setItem] as const
}
