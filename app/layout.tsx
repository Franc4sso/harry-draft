import type { Metadata } from 'next'
import { Inter, Cinzel } from 'next/font/google'
import './globals.css'
import { GameShell } from '@/components/ui/GameShell'

const inter = Inter({ variable: '--font-sans', subsets: ['latin'] })
// '900' added for the duellante's name (mockup `.big .nm`: font-weight 900) — the three
// lighter weights already covered every other Cinzel use in the app, but the big portrait
// name specifically asks for the heaviest cut and Google's Cinzel serves it.
const cinzel = Cinzel({ variable: '--font-display', subsets: ['latin'], weight: ['600', '700', '800', '900'] })

export const metadata: Metadata = {
  title: 'Harry Draft — Draft Roguelite',
  description: 'Costruisci la tua squadra di maghi e affronta la campagna.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${cinzel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <GameShell />
        {children}
      </body>
    </html>
  )
}
