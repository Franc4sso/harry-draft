import type { LogEntry } from '@/types'

export type SpellArchetype =
  | 'beam' | 'curse' | 'fire' | 'dark' | 'shield' | 'heal' | 'stun' | 'disarm' | 'none'

export interface ArchetypeStyle {
  archetype: SpellArchetype
  /** Core color of the projectile/flash. */
  color: string
  /** Trailing glow color (rgba ok). */
  trail: string
  /** Motion silhouette the SpellFx renders. */
  shape: 'bolt' | 'orb' | 'wave' | 'burst'
}

/** Named spells whose identity overrides the generic type/flags mapping. */
const BY_NAME: Array<[RegExp, SpellArchetype]> = [
  [/avada|kedavra|crucio|sectumsempra|morsmordre/i, 'dark'],
  [/expelliarmus|disarm/i, 'disarm'],
  [/incendio|confringo|bombarda|fuoco|fiend/i, 'fire'],
  [/protego|scudo|difes/i, 'shield'],
]

/**
 * Maps a replay log entry to a visual archetype. Derived purely from the
 * entry's existing data (spell name, type, flags) — no engine concept added.
 * Precedence: explicit named spells → status flags → spell type → fallback.
 */
export function archetypeFor(entry: LogEntry | null): SpellArchetype {
  if (!entry) return 'none'

  // System narration (KO, etc.) and self-targetless effects have no projectile.
  if (entry.type === 'system' && entry.action === 'KO') return 'none'

  for (const [re, a] of BY_NAME) if (re.test(entry.action)) return a

  if (entry.flags.includes('heal') || entry.type === 'Cura') return 'heal'
  if (entry.type === 'Difesa' || entry.flags.includes('block')) return 'shield'
  if (entry.flags.includes('stun')) return 'stun'
  if (entry.flags.includes('dot')) return 'fire'

  if (entry.type === 'Controllo') return 'curse'
  if (entry.type === 'Attacco') return 'beam'
  return 'none'
}

const STYLES: Record<Exclude<SpellArchetype, 'none'>, ArchetypeStyle> = {
  beam:   { archetype: 'beam',   color: '#7CFC9B', trail: 'rgba(124,252,155,0.5)', shape: 'bolt' },
  curse:  { archetype: 'curse',  color: '#FF6B6B', trail: 'rgba(255,107,107,0.5)', shape: 'bolt' },
  fire:   { archetype: 'fire',   color: '#FF9D3C', trail: 'rgba(255,157,60,0.55)', shape: 'burst' },
  dark:   { archetype: 'dark',   color: '#a855f7', trail: 'rgba(168,85,247,0.55)', shape: 'orb' },
  shield: { archetype: 'shield', color: '#7dd3fc', trail: 'rgba(125,211,252,0.5)', shape: 'wave' },
  heal:   { archetype: 'heal',   color: '#7CFC9B', trail: 'rgba(124,252,155,0.5)', shape: 'orb' },
  stun:   { archetype: 'stun',   color: '#fde047', trail: 'rgba(253,224,71,0.6)',  shape: 'burst' },
  disarm: { archetype: 'disarm', color: '#caa24a', trail: 'rgba(202,162,74,0.5)',  shape: 'bolt' },
}

const NONE_STYLE: ArchetypeStyle = { archetype: 'none', color: '#ffffff', trail: 'rgba(255,255,255,0.3)', shape: 'bolt' }

export function archetypeStyle(a: SpellArchetype): ArchetypeStyle {
  return a === 'none' ? NONE_STYLE : STYLES[a]
}
