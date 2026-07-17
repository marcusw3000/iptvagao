import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { AuthBootstrap } from '@/components/auth-bootstrap'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IPTV Agão',
  description: 'Plataforma SaaS de TV Corporativa',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthBootstrap />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
