import type { Keyword, Synergy } from '@/types'
import { SIGNAL_TIERS } from '@/game/engine/duos'

// NON è più un sistema a sé. Dal 2026-07-25 (piano "Un solo asse", Fase 1) le quattro
// "Sinergie" di archetipo sono il **grado 2 dei segnali Duo** — un solo asse per parola chiave,
// due scaglioni: 2 maghi/1 reliquia = acceso (abilita i Duo), 3 maghi = potenziato (+50%).
//
// Soglia e bonus vivono in UN SOLO posto: `SIGNAL_TIERS` in game/engine/duos.ts. Questo array
// ne è la PROIEZIONE nel tipo `Synergy`, che sopravvive solo come **mezzo di trasporto** verso
// il motore (keywordDamageMult, teamExecute, teamShieldConvert, teamDarkMagic,
// registerSynergyTriggers, applyBonuses/simulate) — lo stesso canale su cui viaggia anche la
// sinergia sintetica dei boss (`exclusiveSynergy` in data/bosses.ts). Non aggiungere voci qui:
// un nuovo grado 2 si dichiara in SIGNAL_TIERS.
export const SYNERGIES: Synergy[] = SIGNAL_TIERS.map(t => ({
  id: t.id,
  name: t.name,
  kind: 'origin' as const,
  requires: { tag: t.tag, count: t.need },
  bonus: { keywordMult: { [t.keyword]: t.mult } as Partial<Record<Keyword, number>> },
}))
