import type { RunEvent } from '@/types'
import { upgradeWizardSpell, SPELL_LEVEL_MAX } from '../spellForge'
import type { NodeResolver } from './types'

/**
 * "Aumento Magia" node: the player picks one wizard whose equipped spell levels up,
 * scaling its power/heal for the rest of the run (see `upgradeWizardSpell`). The magic
 * level is a per-wizard mastery on the wizard's single fixed spell. No RNG — the choice
 * is the only input. Picking a wizard already at the cap is a no-op.
 */
export const spellForgeResolver: NodeResolver = {
  id: 'spellForge',
  enter: (state) => ({ offers: { wizardIds: state.team.map(d => d.wizard.id) }, isCombat: false }),
  resolve: (state, node, choice) => {
    if (choice.kind !== 'spell-upgrade') return state
    const target = state.team.find(d => d.wizard.id === choice.wizardId)
    if (!target || (target.spellLevel ?? 1) >= SPELL_LEVEL_MAX) return state
    const upgraded = upgradeWizardSpell(target)
    const team = state.team.map(d => (d.wizard.id === choice.wizardId ? upgraded : d))
    const ev: RunEvent = {
      area: state.area ?? 0, nodeId: node.id, kind: 'spellForge',
      summary: `${target.wizard.name}: «${upgraded.spell.name}» sale a Magia Lv. ${upgraded.spellLevel}`,
    }
    return { ...state, team, log: [...(state.log ?? []), ev] }
  },
}
