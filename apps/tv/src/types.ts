export interface Channel {
  id: string
  name: string
  url: string
  logoUrl: string | null
  categoryId: string | null
  order: number
}

export interface Category {
  id: string
  name: string
  order: number
}
