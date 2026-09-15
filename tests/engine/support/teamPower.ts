import { powerOf } from '@/game/engine/combat/teamGen'
import {
  DUO_SIGNALS_IN_USE, SIGNAL_TIERS, detectDuos, duoProgress, signalGrade, tier2Contributors,
} from '@/game/engine/duos'
import { trioGates } from '@/game/engine/trios'
import type { ActiveRelic, DraftedWizard } from '@/types'

/** Quanto vale un segnale al grado 2 (una Costellazione accesa: +0.5 alla sua parola
 *  chiave nel motore), espresso come frazione della potenza grezza della squadra. */
const TIER2_WEIGHT = 0.25
/** Credito per un grado 2 INCOMPLETO, proporzionale ai portatori raccolti. È ciò che
 *  spinge il bot a prendere il mago che COMPLETA un archetipo invece del più muscoloso. */
const TIER2_PARTIAL = 0.15
/** Un Duo attivo (due segnali accesi insieme). */
const DUO_WEIGHT = 0.20
/** Un Duo a metà: un segnale acceso su due. */
const DUO_PARTIAL = 0.08
/** Un cancello di Trio (tre maghi della stessa Casa con almeno un Duo attivo);
 *  `grade` 1 (quattro maghi) vale il doppio. */
const TRIO_WEIGHT = 0.15

/**
 * Potenza di una squadra INTERA: la somma di `powerOf` moltiplicata per quanto la
 * squadra è *sinergica* (segnali al grado 2, Duo, Trii).
 *
 * Perché esiste, separata da `powerOf`: `powerOf` somma statistiche grezze
 * (hp + atk*2 + def*1.5 + spd) e non sa nulla di archetipi. Un bot che sceglie con
 * quella misura draftà tre picchiatori scoordinati e perde, mentre un giocatore vero
 * costruisce un archetipo e vince — per questo il winRate misurato dall'harness non
 * diceva nulla su quanto sia difficile il gioco per una persona.
 *
 * SOLO harness: nessun file sotto `game/`, `lib/`, `app/` o `components/` deve
 * importarla (c'è un test che lo verifica). `powerOf` resta la nozione del motore,
 * perché la usano la generazione delle squadre nemiche e la UI: cambiarla
 * cambierebbe il gioco, non la misura.
 *
 * Pura, senza RNG.
 */
export function teamPower(team: DraftedWizard[], relics: ActiveRelic[]): number {
  if (team.length === 0) return 0
  const base = team.reduce((n, d) => n + powerOf(d), 0)

  let mult = 0

  // Segnali al grado 2 = le Costellazioni/archetipi. Un grado 2 acceso vale pieno;
  // uno incompleto vale in proporzione ai portatori, così completare un archetipo
  // è sempre più attraente che iniziarne un altro.
  for (const tier of SIGNAL_TIERS) {
    const have = tier2Contributors(tier, team).length
    if (have === 0) continue
    mult += have >= tier.need ? TIER2_WEIGHT : TIER2_PARTIAL * (have / tier.need)
  }

  // Duo attivi, più un credito per quelli a metà strada.
  const duos = detectDuos(team, relics)
  mult += DUO_WEIGHT * duos.length
  for (const p of duoProgress(team, relics)) {
    if (p.active) continue
    const lit = p.lit.filter(Boolean).length
    if (lit > 0) mult += DUO_PARTIAL * (lit / p.lit.length)
  }

  // I Trii richiedono almeno un Duo attivo: `trioGates(team, [])` ritorna sempre [].
  for (const g of trioGates(team, duos)) mult += TRIO_WEIGHT * (1 + g.grade)

  return base * (1 + mult)
}

/** I segnali accesi almeno al grado 1, per diagnostica dell'harness. */
export function litSignalGrades(
  team: DraftedWizard[], relics: ActiveRelic[],
): { signal: string; grade: 0 | 1 | 2 }[] {
  return [...DUO_SIGNALS_IN_USE]
    .map(s => ({ signal: s as string, grade: signalGrade(s, team, relics) }))
    .filter(x => x.grade > 0)
}
