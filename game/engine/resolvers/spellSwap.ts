import type { RunEvent, RunNode, RunState, Spell } from '@/types'
import type { Rng } from '../rng'
import { parseAreaNodeId } from '../map'
import { scaledSpell } from '../spellForge'
import type { NodeResolver } from './types'
import { SPELLS, SPELL_BY_ID } from '@/data/spells'

const ATTACK_SPELLS = SPELLS.filter(s => s.type === 'Attacco' && s.id !== 'base_attack')

/** 2 spell d'attacco casuali, deterministici dal nodo (stesso pattern di altareOffer, salt 6000
 *  per non collidere con recruit 1000 / relic 2000 / event 3000 / shop 4000 / altare 5000). */
export function swapOffer(state: RunState, node: RunNode, rng: Rng): Spell[] {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const r = rng.fork(6000 + area * 100 + floor * 10 + idx)
  const pool = [...ATTACK_SPELLS]
  const a = r.int(0, pool.length - 1)
  const first = pool.splice(a, 1)[0]!
  const b = r.int(0, pool.length - 1)
  const second = pool[b]!
  return [first, second]
}

/** "Cambia Magia" node: swap a wizard's equipped spell for one of 2 randomly-offered attack
 *  spells. FREE — no cost, no life/relic/team-size change. Does NOT import sacrifice.ts. The
 *  new spell is scaled to the wizard's current spellLevel (preserved, not reset). */
export const spellSwapResolver: NodeResolver = {
  id: 'spellSwap',
  enter: (state, node, rng) => ({ offers: { swapSpells: swapOffer(state, node, rng).map(s => s.id) }, isCombat: false }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'spell-swap') return state
    const target = state.team.find(d => d.wizard.id === choice.wizardId)
    if (!target) return state
    const offered = swapOffer(state, node, rng).map(s => s.id)
    if (!offered.includes(choice.spellId)) return state // ANTI-CHEAT: solo tra i 2 offerti
    const base = SPELL_BY_ID[choice.spellId]
    if (!base) return state
    const spell = scaledSpell(base, target.spellLevel ?? 1) // preserva spellLevel. NESSUN COSTO.
    const team = state.team.map(d => (d.wizard.id === choice.wizardId ? { ...d, spell } : d))
    const ev: RunEvent = {
      area: state.area ?? 0, nodeId: node.id, kind: 'spellSwap',
      summary: `${target.wizard.name}: nuova magia «${spell.name}»`,
    }
    return { ...state, team, log: [...(state.log ?? []), ev] }
  },
}
