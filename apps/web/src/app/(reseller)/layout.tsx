'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { ResellerSidebar } from '@/components/reseller-sidebar'

export default function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    } else if (role !== 'reseller') {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, role, router])

  if (!isAuthenticated || role !== 'reseller') return null

  return (
    <div className="flex min-h-screen bg-gray-950">
      <ResellerSidebar />
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  )
}
