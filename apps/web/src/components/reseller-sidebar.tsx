'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, TrendingUp, DollarSign, Users, LogOut } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'

const navItems = [
  { href: '/reseller-portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reseller-portal/clients', label: 'Clientes', icon: Users },
  { href: '/reseller-portal/commissions', label: 'Comissões', icon: TrendingUp },
  { href: '/reseller-portal/withdrawals', label: 'Saques', icon: DollarSign },
]

export function ResellerSidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">IPTV Agão</h1>
        <p className="text-xs text-gray-500 mt-0.5">Revendedor</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href || (href !== '/reseller-portal' && pathname.startsWith(href))
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}
