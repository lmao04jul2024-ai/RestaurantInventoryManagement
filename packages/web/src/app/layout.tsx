import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
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
    // suppressHydrationWarning: the boot script stamps data-theme pre-hydration.
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} font-sans bg-surface text-content-default antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
