'use client'
import { useState } from 'react'
import { Info } from 'lucide-react'

/** One-line Italian effect blurbs, keyed by the visible status name. */
const LEGEND: Array<{ name: string; effect: string }> = [
  { name: 'Stordito', effect: 'salta il turno (nessuna azione)' },
  { name: 'Congelamento', effect: 'salta il turno (nessuna azione)' },
  { name: 'Silenziato', effect: 'non può lanciare incantesimi' },
  { name: 'Disarmato', effect: 'non può attaccare' },
  { name: 'Bruciatura', effect: 'danno nel tempo ogni turno' },
  { name: 'Indebolimento', effect: 'attacco ridotto (%)' },
  { name: 'Vulnerabilità', effect: 'difesa ridotta (%)' },
  { name: 'Lentezza', effect: 'velocità ridotta (%)' },
  { name: 'Scudo', effect: 'assorbe danni' },
  { name: 'Rigenerazione', effect: 'recupera vita ogni turno' },
]

export function StatusLegend({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div data-testid="status-legend" className="w-full max-w-md">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-white/50 hover:text-white/80"
      >
        <Info size={13} aria-hidden /> Legenda stati
      </button>
      {open && (
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          {LEGEND.map((s) => (
            <li key={s.name} className="flex justify-between gap-2">
              <span className="font-semibold text-white/80">{s.name}</span>
              <span className="text-white/45 text-right">{s.effect}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
