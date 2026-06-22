import type { Metadata } from 'next'
import { Inter, Cinzel } from 'next/font/google'
import './globals.css'

const inter = Inter({ variable: '--font-sans', subsets: ['latin'] })
const cinzel = Cinzel({ variable: '--font-display', subsets: ['latin'], weight: ['600', '700', '800'] })

export const metadata: Metadata = {
  title: 'Harry Draft — Draft Roguelite',
  description: 'Costruisci la tua squadra di maghi e affronta la campagna.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${cinzel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}
