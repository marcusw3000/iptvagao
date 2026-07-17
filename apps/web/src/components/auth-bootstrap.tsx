'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth'

export function AuthBootstrap() {
  const initialize = useAuth((state) => state.initialize)

  useEffect(() => {
    void initialize()
  }, [initialize])

  return null
}
