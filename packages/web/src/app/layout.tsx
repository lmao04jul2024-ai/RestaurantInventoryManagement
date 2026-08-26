import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'Restaurant Management System',
    template: '%s | Restaurant Manager',
  },
  description: 'Cross-platform solution for inventory management and ordering',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} font-sans bg-surface text-content-default antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
