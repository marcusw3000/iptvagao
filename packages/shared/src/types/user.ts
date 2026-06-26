export type UserRole = 'master_admin' | 'support' | 'financial' | 'client_admin' | 'client_user' | 'reseller'

export interface User {
  id: string
  email: string | null
  username: string
  role: UserRole
  clientId: string | null
  resellerId: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateUserDto {
  email?: string
  username: string
  password: string
  role: UserRole
  clientId?: string
  resellerId?: string
}

export interface UpdateUserDto {
  email?: string
  username?: string
  password?: string
  active?: boolean
}
