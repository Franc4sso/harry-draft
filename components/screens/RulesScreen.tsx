import Link from 'next/link'
import { GlowPanel } from '@/components/ui/GlowPanel'

const SECTIONS: Array<{ title: string; body: string }> = [
  { title: 'Draft', body: 'Scegli 1 mago tra 5 carte. Ripeti finché la tua squadra ha 5 maghi. Le carte non scelte vengono scartate.' },
  { title: 'Tier', body: 'Tier 1 Leggendario (raro e forte) → Tier 4 Comune. Mai più di un Tier 1 per schermata; ogni schermata garantisce almeno un Tier alto.' },
  { title: 'Statistiche & Magie', body: 'Ogni mago ha HP, Attacco, Difesa e Velocità generati casualmente nel suo range, e riceve una magia casuale dal suo arsenale.' },
  { title: 'Sinergie', body: 'Combina case, ruoli e gruppi (Golden Trio, Weasley, Mangiamorte…) per bonus potenti.' },
  { title: 'Combattimento', body: 'Le battaglie sono simulate automaticamente e in modo deterministico: velocità, danni, critici, schivate, cure e sinergie decidono il vincitore.' },
]

export function RulesScreen() {
  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-8 max-w-2xl mx-auto w-full">
      <h1 className="font-display text-4xl mt-6">Regole</h1>
      <div className="grid gap-4 w-full">
        {SECTIONS.map((s) => (
          <GlowPanel key={s.title} className="p-5 text-left">
            <h2 className="font-display text-xl mb-1">{s.title}</h2>
            <p className="text-white/70 text-sm leading-relaxed">{s.body}</p>
          </GlowPanel>
        ))}
      </div>
      <Link href="/" className="text-white/70 hover:text-white text-sm uppercase tracking-wider font-display">← Indietro al menu</Link>
    </main>
  )
}
