import type { ActiveDuo, ActiveRelic, DraftedWizard, House } from '@/types'
import { livingOf } from '@/game/engine/roster'
import { detectDuos } from '@/game/engine/duos'

// BILANCIAMENTO (misurato 2026-07-14, fase 2). I Trio sono potenza SOLO del player, gated su
// ≥1 Duo attivo + 3 maghi stessa casa. A/B su campaignBalanceRestricted (il gate REALE; l'harness
// full campaignBalanceB è a 0.0000 da "UN MAGO UNA MAGIA", reference-only):
//   pre-Trio (5c4a7f6): winRate 0.0833  →  post-Trio (tutti i 4 buff): winRate 0.0833  (INVARIATO).
// I Trio NON muovono il bot: la policy near-optimal fissa lo starter a Grifondoro e recluta per
// POTENZA, non per coerenza di casata → schiera 3-stessa-casa-mentre-un-Duo-è-attivo quasi mai, e
// il gate Trio non scatta. I Trio sono potenza che un UMANO che costruisce team di casata sblocca,
// invisibile a un bot power-greedy (stessa conclusione della fase 1: il bot non decide la
// difficoltà, la decide il playtest umano). Nessun ritocco leva applicato (in banda, >0.07 floor).
// Se il playtest umano risulta troppo facile → leva enemy count, NON reintrodurre i poteri casata.
// Numeri iniziali sotto; se in futuro si tarano, ri-misurare campaignBalanceRestricted.

export interface TrioEffect {
  firstStrike?: { bonus: number }              // Serpeverde
  analysis?: { exposeId: 'expose1' | 'expose2' } // Corvonero
  statusDurationBonus?: number                 // Tassorosso
  cooldownReduction?: number                   // Grifondoro
}

// grade 0 = 3 members, grade 1 = 4+ members. Numeri iniziali — tarare via campaignBalanceRestricted
// (vedi la nota di bilanciamento sopra: i Trio non muovono il bot, la taratura serve solo se un
// futuro playtest umano lo richiede).
function effectFor(house: House, grade: 0 | 1): TrioEffect {
  switch (house) {
    case 'Serpeverde':  return { firstStrike: { bonus: grade === 1 ? 0.45 : 0.30 } }
    case 'Corvonero':   return { analysis: { exposeId: grade === 1 ? 'expose2' : 'expose1' } }
    case 'Tassorosso':  return { statusDurationBonus: 1 }
    case 'Grifondoro':  return { cooldownReduction: 1 }
  }
}

/** The houses that have an active Trio and their grade (0 = 3 members, 1 = 4+).
 *  Single source of truth for the gate: ≥1 active Duo AND ≥3 living wizards of the house.
 *  Both trioEffects (combat) and the run UI consume this so they can never drift. */
export function trioGates(team: DraftedWizard[], duos: ActiveDuo[]): { house: House; grade: 0 | 1 }[] {
  if (duos.length === 0) return []
  const living = livingOf(team)
  const countByHouse = new Map<House, number>()
  for (const d of living) countByHouse.set(d.wizard.house, (countByHouse.get(d.wizard.house) ?? 0) + 1)
  const out: { house: House; grade: 0 | 1 }[] = []
  for (const [house, n] of countByHouse) {
    if (n < 3) continue
    out.push({ house, grade: n >= 4 ? 1 : 0 })
  }
  return out
}

/** Le case il cui Trio è attivo ORA e cade dopo lo swap. Il gate Trio (trioGates) richiede
 *  >=1 Duo attivo E >=3 maghi vivi della casa: entrambe le rotture (perdere il Duo o scendere
 *  sotto i 3 di casata) fanno cadere il Trio. Pure. */
export function trioGateLoss(current: DraftedWizard[], next: DraftedWizard[], relics: ActiveRelic[]): House[] {
  const before = trioGates(current, detectDuos(livingOf(current), relics)).map(g => g.house)
  const after = new Set(trioGates(next, detectDuos(livingOf(next), relics)).map(g => g.house))
  return before.filter(h => !after.has(h))
}

/** Player-only. For each wizard, its house's Trio effect IF the team has ≥1 active Duo AND
 *  ≥3 living wizards share that house. Empty map when no Duo is active. Pure; no RNG. */
export function trioEffects(team: DraftedWizard[], duos: ActiveDuo[]): Record<string, TrioEffect> {
  const gates = trioGates(team, duos)
  if (gates.length === 0) return {}
  const gradeByHouse = new Map(gates.map(g => [g.house, g.grade]))
  const map: Record<string, TrioEffect> = {}
  for (const d of livingOf(team)) {
    const grade = gradeByHouse.get(d.wizard.house)
    if (grade === undefined) continue
    map[d.wizard.id] = effectFor(d.wizard.house, grade)
  }
  return map
}
