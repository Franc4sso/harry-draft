import type { BattleUnit } from '@/types'
import { applyStatus } from '@/game/engine/status'
import { STATUS_BY_ID } from '@/data/statuses'
import { MAX_STAT_STACKS } from '@/data/constants'

const CARNEFICE_THRESHOLD_STEP = 0.05  // +5% soglia per kill (STIMA tarabile — playtest)
const CARNEFICE_THRESHOLD_CAP = 0.6    // tetto soglia (STIMA)

/** MIETITORE (Duo Combos, player-only, per-battle): each execute/kill landed by a player unit
 *  grants that killer one stack of `raccolto` — a permanent (rest-of-battle) +6 atk buff. No rng
 *  involved: the killer is already known at the call site, so there's no determinism concern
 *  (unlike UNTORE/MIASMA, which must pick a random recipient). */
export function maybeReap(killer: BattleUnit): void {
  applyStatus(killer, 'raccolto', { sourceId: `${killer.side}:${killer.wizard.id}` })
}

/** Sbircia, SENZA mutare nulla: il prossimo `raccolto` atterrerebbe davvero su questo carnefice?
 *
 *  `raccolto` usa `stack: 'stack'` con un tetto (MAX_STAT_STACKS): a tetto pieno `applyStatus` è un
 *  no-op silenzioso. La riga KO viene marchiata `duoId: 'mietitore'` PRIMA che `maybeReap` venga
 *  chiamato (spostare la chiamata cambierebbe lo snapshot di quel frame e farebbe divergere il
 *  replay), quindi il marchio deve poter prevedere l'esito senza toccare lo stato — altrimenti un
 *  carnefice al tetto produrrebbe una riga marchiata dove non è successo niente. Gli altri Duo
 *  tracciabili marchiano tutti solo quando l'effetto atterra davvero: questo li allinea. */
export function willReap(killer: BattleUnit): boolean {
  const cap = STATUS_BY_ID['raccolto']?.maxStacks ?? MAX_STAT_STACKS
  return killer.statusEffects.filter(e => e.statusId === 'raccolto').length < cap
}

/** SPIETATEZZA (archetipo Carnefice): ogni kill di un carnefice alza la soglia di esecuzione
 *  della sua SQUADRA (l'oggetto execute è condiviso). Pura mutazione, no rng — non tocca il
 *  replay determinismo. No-op sicuro su unità senza execute. */
export function bumpExecuteThreshold(team: BattleUnit[]): void {
  for (const u of team) {
    if (u.execute) {
      u.execute.threshold = Math.min(CARNEFICE_THRESHOLD_CAP, u.execute.threshold + CARNEFICE_THRESHOLD_STEP)
    }
  }
}
