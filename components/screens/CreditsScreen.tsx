import Link from 'next/link'
import { GlowPanel } from '@/components/ui/GlowPanel'

export function CreditsScreen() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div>
        <p className="kicker">Dietro le quinte</p>
        <h1 className="title-gradient mt-1 font-display text-4xl font-bold">Credits</h1>
        <div aria-hidden className="mx-auto mt-2 h-px w-40" style={{ background: 'linear-gradient(90deg, transparent, rgba(202,162,74,0.6), transparent)' }} />
      </div>
      <GlowPanel className="p-6 max-w-md">
        <p className="text-white/80">Harry Draft — un gioco roguelite a draft.</p>
        <p className="text-white/50 text-sm mt-2">
          Progetto fan-made non ufficiale. Universo di Harry Potter © dei rispettivi proprietari.
          Nessuna immagine o asset originale utilizzato.
        </p>
      </GlowPanel>
      <Link href="/" className="text-white/70 hover:text-white text-sm uppercase tracking-wider font-display">← Indietro al menu</Link>
    </main>
  )
}
