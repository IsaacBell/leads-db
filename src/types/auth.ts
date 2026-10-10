export type User = {
  id: string
  email: string
  name: string
  role: string
  created_at: string
}

export type AuthResponse = {
  token: string
  user: User
}
