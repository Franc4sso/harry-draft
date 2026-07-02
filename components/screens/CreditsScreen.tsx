import Link from 'next/link'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'

export function CreditsScreen() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <Insegna kicker="Dietro le quinte" title="Credits" />
      <Frame variant="panel" className="max-w-md" innerClassName="p-6">
        <p className="text-white/80">Harry Draft — un gioco roguelite a draft.</p>
        <p className="text-white/50 text-sm mt-2">
          Progetto fan-made non ufficiale. Universo di Harry Potter © dei rispettivi proprietari.
          Nessuna immagine o asset originale utilizzato.
        </p>
      </Frame>
      <Link href="/" className="text-white/70 hover:text-white text-sm uppercase tracking-wider font-display">← Indietro al menu</Link>
    </main>
  )
}
