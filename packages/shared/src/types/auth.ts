export interface LoginDto {
  username: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

export interface JwtPayload {
  sub: string
  username: string
  role: string
  clientId: string | null
  iat: number
  exp: number
}
