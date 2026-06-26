import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IPTV Agão',
  description: 'Plataforma SaaS de TV Corporativa',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={geist.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
