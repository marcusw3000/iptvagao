'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { ResellerSidebar } from '@/components/reseller-sidebar'

export default function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, role } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!_hasHydrated) return
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (role !== 'reseller') {
      router.replace('/dashboard')
    }
  }, [_hasHydrated, isAuthenticated, role, router])

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || role !== 'reseller') return null

  return (
    <div className="flex min-h-screen bg-gray-950">
      <ResellerSidebar />
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  )
}
