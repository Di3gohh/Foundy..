import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import './globals.css'

export const metadata: Metadata = {
  title: 'Foundy | O que se perdeu, volta.',
  description: 'Encontre e devolva itens perdidos na sua comunidade.',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
