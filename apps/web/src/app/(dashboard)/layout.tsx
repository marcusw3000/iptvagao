'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, _hasHydrated, router])

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
