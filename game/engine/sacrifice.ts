import type { DraftedWizard, Relic, RunModifiers, RunState } from '@/types'
import { detectSynergies } from './synergy'
import { livingOf } from './roster'

/**
 * P5 — Economia del Sacrificio. UNICA fonte del "pagare un costo" (spec 2026-07-15):
 * consumata sia dall'altareResolver sia dagli EventEffect dei Patti. Mai duplicare
 * questa logica altrove (stesso principio di trioGates).
 *
 * NOTA DI BILANCIAMENTO (A/B 2026-07-15, Task 10 — 120 seed, bot near-optimal):
 * campaignBalanceRestricted pre-altare 0.0833 → post 0.0583. Il delta è rumore da
 * rimescolamento (il roll altare consuma un draw rng in più per area e ridà tutte le
 * mappe sui seed fissi), NON un cambio di difficoltà: con ALTARE_CHANCE=0 (draw
 * consumato, nodo mai piazzato) il gate misura 0.0417, PIÙ BASSO di 0.3 → la leva è
 * non-monotona sul metric e non va "pescata" per riportare il numero nella vecchia
 * banda-commento. Tutto il contenuto sacrificio è player-only e invisibile al bot
 * (rifiuta ogni sacrificio: handler 'skip' negli harness) — stessa classe dei joker
 * e dei Trio. Gate live (winRate>0) verde. campaignBalanceB overall resta 0.0000
 * (reference-only da "UN MAGO UNA MAGIA", non è il gate).
 */
export type SacrificeCost =
  | { kind: 'wizard'; wizardId: string }
  | { kind: 'relic'; relicId: string }
  | { kind: 'maxHp'; wizardId: string; amount: number }
  | { kind: 'runModifier'; modifier: keyof RunModifiers }

export function canPay(state: RunState, cost: SacrificeCost): boolean {
  switch (cost.kind) {
    case 'wizard':
      return state.team.length >= 2 && state.team.some(d => d.wizard.id === cost.wizardId)
    case 'relic':
      return state.relics.some(a => a.relic.id === cost.relicId)
    case 'maxHp': {
      const dw = state.team.find(d => d.wizard.id === cost.wizardId)
      return !!dw && dw.maxHp - cost.amount >= 1
    }
    case 'runModifier':
      return !state.runModifiers?.[cost.modifier]
  }
}

/** Applica il costo. Pure. Scelta invalida → ritorna LO STESSO oggetto state
 *  (convenzione resolver per il no-op, vedi runEngine.resolveCurrentChecked). */
export function applySacrificeCost(state: RunState, cost: SacrificeCost): RunState {
  if (!canPay(state, cost)) return state
  switch (cost.kind) {
    case 'wizard': {
      const team = state.team.filter(d => d.wizard.id !== cost.wizardId)
      return { ...state, team, activeSynergies: detectSynergies(livingOf(team)) }
    }
    case 'relic':
      return { ...state, relics: state.relics.filter(a => a.relic.id !== cost.relicId) }
    case 'maxHp': {
      const team = state.team.map(d => {
        if (d.wizard.id !== cost.wizardId) return d
        const maxHp = d.maxHp - cost.amount
        const stats = { ...d.stats, hp: d.stats.hp - cost.amount }
        const cur = d.currentHp ?? d.maxHp
        return { ...d, stats, maxHp, currentHp: Math.max(1, Math.min(cur, maxHp)) }
      })
      return { ...state, team }
    }
    case 'runModifier':
      return { ...state, runModifiers: { ...state.runModifiers, [cost.modifier]: true } }
  }
}

/** P5 Corruzione: l'ATTO di assegnare una reliquia grantsDarkMagic marchia il carrier per
 *  sempre. Solo qui — il bonus dark da synergy 'oscurita' NON corrompe (nessuna scelta di
 *  equipaggiamento = nessun costo). Identità (reference-equal) se non applicabile. */
export function corruptOnAssign(team: DraftedWizard[], relic: Relic, wizardId: string): DraftedWizard[] {
  if (!relic.grantsDarkMagic) return team
  const target = team.find(d => d.wizard.id === wizardId)
  if (!target || target.corrotto) return team
  return team.map(d => (d.wizard.id === wizardId ? { ...d, corrotto: true as const } : d))
}
