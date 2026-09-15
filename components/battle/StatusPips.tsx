import type { ActiveEffect } from '@/types'
import { STATUS_BY_ID } from '@/data/statuses'

/** Glifo e colore per stato. Copre TUTTI i 24 `id` di `data/statuses.ts` —
 *  il test di copertura più sotto lo fa rispettare. I colori riprendono quelli
 *  già usati dal gioco per le stesse idee (verde veleno, ambra stordimento,
 *  azzurro scudo), e gli stati della stessa famiglia condividono il glifo:
 *  tre gradi di lentezza sono la stessa idea, non tre icone da imparare. */
const PIP: Record<string, { glyph: string; color: string }> = {
  // controllo — il turno salta o si perde un'opzione
  stun:     { glyph: '✦', color: '#f0d48a' },
  freeze:   { glyph: '❄', color: '#7dd3ff' },
  silence:  { glyph: '✖', color: '#c4a3ff' },
  disarm:   { glyph: '✋', color: '#ffd37d' },
  // danno nel tempo
  veleno:   { glyph: '☠', color: '#8fd98f' },
  burn:     { glyph: '🔥', color: '#ffb37d' },
  // difesa
  shield:   { glyph: '◈', color: '#8ab6f0' },
  protego:  { glyph: '❖', color: '#8ab6f0' },
  regen:    { glyph: '✚', color: '#7cfc9b' },
  // potenziamenti
  atkUp:    { glyph: '▲', color: '#ff9a7a' },
  atkUp1:   { glyph: '▲', color: '#ff9a7a' },
  defUp:    { glyph: '▲', color: '#8ab6f0' },
  spdUp:    { glyph: '▲', color: '#f0d48a' },
  raccolto: { glyph: '✦', color: '#f0d48a' },
  // indebolimenti
  slow:     { glyph: '▼', color: '#ffb37d' },
  slow1:    { glyph: '▼', color: '#ffb37d' },
  slow2:    { glyph: '▼', color: '#ffb37d' },
  slow3:    { glyph: '▼', color: '#ffb37d' },
  weaken1:  { glyph: '▼', color: '#ffb37d' },
  weaken2:  { glyph: '▼', color: '#ffb37d' },
  weaken3:  { glyph: '▼', color: '#ffb37d' },
  expose1:  { glyph: '◇', color: '#ff9a7a' },
  expose2:  { glyph: '◇', color: '#ff9a7a' },
  expose3:  { glyph: '◇', color: '#ff9a7a' },
}

/** Il numero da mostrare sulla pillola. Per il veleno e la bruciatura sono le
 *  DOSI (`stacks`): il veleno è permanente, quindi `remaining` resta fermo a 2
 *  e mostrarlo sarebbe una bugia — il numero che cresce a ogni dose è `stacks`.
 *  Per tutto il resto il numero utile è quanti turni mancano. */
function pipCount(e: ActiveEffect): number | undefined {
  const id = e.statusId ?? e.kind
  const stacks = e.stacks ?? 1
  const remaining = e.remaining
  if (id === 'veleno' || id === 'burn') return stacks > 1 ? stacks : undefined
  return remaining !== undefined && remaining > 1 ? remaining : undefined
}

/** Gli stati attivi di un'unità, come pillole sul suo ritratto. Oggi non si
 *  vedono affatto: dal frame dopo l'applicazione il giocatore non ha modo di
 *  sapere che un mago è avvelenato, silenziato o congelato. */
export function StatusPips({ effects, className }: { effects: ActiveEffect[]; className?: string }) {
  if (!effects || effects.length === 0) return null
  return (
    <span className={`pointer-events-none absolute left-1.5 top-1.5 z-20 flex max-w-[86%] flex-wrap gap-[3px] ${className ?? ''}`}>
      {effects.map((e, i) => {
        const id = e.statusId ?? e.kind
        const meta = PIP[id] ?? { glyph: '•', color: '#9aa3ad' }
        const def = STATUS_BY_ID[id]
        const n = pipCount(e)
        return (
          <span
            key={`${id}-${i}`}
            data-testid="status-pip"
            data-kind={id}
            title={def ? `${def.name}${n ? ` — ${n}` : ''}` : id}
            className="flex h-[15px] items-center gap-[2px] rounded-[5px] px-1 text-[9px] font-black leading-none text-[#0a0814]"
            style={{ background: meta.color }}
          >
            {meta.glyph}{n !== undefined && <b>{n}</b>}
          </span>
        )
      })}
    </span>
  )
}
