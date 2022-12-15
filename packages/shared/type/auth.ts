export type AccessToken = {
  user: {
    _id: string
    twitterId: string | null
    githubId: string | null
    twitterUserName: string | null
    githubUserName: string | null
  }
}
