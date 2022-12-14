export const useAuth = () => {
  const refreshToken = async () => {
    const res = await fetch('/auth/jwt/refresh', {
      credentials: 'include',
      method: 'POST'
    })
    const body = await res.json()
    return body
  }

  const getAccessToken = async () => {
    try {
      const token = document.cookie.split('; ')[0].split('=')[1]
      return token
    } catch (e) {
      return await refreshToken()
    }
  }

  return {
    getAccessToken,
    refreshToken
  } as const
}
