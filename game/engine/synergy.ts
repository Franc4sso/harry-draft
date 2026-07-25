import type { ActiveSynergy, DraftedWizard, Stats, Synergy } from '@/types'
import { SYNERGIES } from '@/data/synergies'
import { SIGNAL_TIERS, tier2Contributors } from '@/game/engine/duos'

/** Il grado 2 del segnale, indicizzato per l'id storico della sua ex-Sinergia. `SYNERGIES` è
 *  la proiezione di `SIGNAL_TIERS`, quindi la corrispondenza è 1:1 e nello stesso ordine. */
const TIER_BY_ID = new Map(SIGNAL_TIERS.map(t => [t.id, t]))

/** I segnali arrivati al **grado 2** (3 maghi col tag), consegnati nel tipo di trasporto
 *  storico `ActiveSynergy[]` che il motore già consuma. Soglia e contribuenti li decide una
 *  sola funzione — `tier2Contributors` nel modello dei segnali (game/engine/duos.ts).
 *  Le RELIQUIE non entrano qui: accendono il grado 1, mai il grado 2 (regola documentata in
 *  duos.ts), ed è il motivo per cui questa funzione non prende `relics`. */
export function detectSynergies(team: DraftedWizard[]): ActiveSynergy[] {
  const out: ActiveSynergy[] = []
  for (const syn of SYNERGIES) {
    const tier = TIER_BY_ID.get(syn.id)
    if (!tier) continue
    const members = tier2Contributors(tier, team)
    if (members.length >= tier.need) out.push({ synergy: syn, memberIds: members.map(d => d.wizard.id) })
  }
  return out
}

// `synergyProgress` (progresso parziale 2/3 nel tipo `Synergy`) è stato RIMOSSO il 2026-07-25
// con la Fase 2 del piano "Un solo asse": esisteva solo per l'ArchetypeTracker («Costellazioni»),
// pannello ora fuso nel tracker unico. Il conteggio parziale per la UI si legge direttamente nel
// modello dei segnali — `tier2Contributors` / `tier2Of` / `signalGrade` in game/engine/duos.ts —
// senza passare dal tipo di trasporto storico.

// Still exported: game/engine/combat/themes.ts uses this to derive each theme's
// minCount (Tossicità needs 3 veleno-tagged members) for themed enemy team generation.
export function synergyThreshold(syn: Synergy): number {
  const req = syn.requires
  return req.count ?? (req.ids ? req.ids.length : 3)
}

// Still used by game/engine/combat/simulate.ts: SYNERGIES-detected entries no longer carry
// stat bonuses (Tossicità is keywordMult-only), but a boss's synthetic exclusiveSynergy
// (data/bosses.ts) is delivered through the same ActiveSynergy[] channel and DOES carry a
// flat/allPct bonus (e.g. Voldemort's allPct 0.2) — this must keep applying it.
export function applyBonuses(stats: Stats, synergies: ActiveSynergy[]): Stats {
  let { hp, atk, def, spd } = stats
  let pct = 0
  for (const { synergy } of synergies) {
    const b = synergy.bonus
    hp += b.hp ?? 0
    atk += b.atk ?? 0
    def += b.def ?? 0
    spd += b.spd ?? 0
    pct += b.allPct ?? 0
  }
  const m = 1 + pct
  return {
    hp: Math.round(hp * m),
    atk: Math.round(atk * m),
    def: Math.round(def * m),
    spd: Math.round(spd * m),
  }
}
