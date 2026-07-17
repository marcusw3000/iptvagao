export interface LoginDto {
  username: string
  password: string
}

export interface AuthSessionUser {
  id: string
  username: string
  email: string | null
  role: string
  clientId: string | null
  resellerId: string | null
}

export interface AuthSession {
  user: AuthSessionUser
  expiresIn: number
}

export interface JwtPayload {
  sub: string
  username: string
  role: string
  clientId: string | null
  resellerId: string | null
  iat: number
  exp: number
}
