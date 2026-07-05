import type { RunNodeType } from '@/types'

export interface NodeKind {
  type: RunNodeType
  label: string
  emoji: string
  theme: string          // Hogwarts location flavor (used by Fase 4 rendering)
  isCombat: boolean
  resolverId: string
  generatedInPhase: 1 | 2 | 3
}

export const NODE_CATALOG: Record<RunNodeType, NodeKind> = {
  battle:     { type: 'battle',     label: 'Combattimento', emoji: '⚔️', theme: 'Corridoio',        isCombat: true,  resolverId: 'battle',     generatedInPhase: 1 },
  elite:      { type: 'elite',      label: 'Elite',         emoji: '⚫', theme: 'Duello',           isCombat: true,  resolverId: 'elite',      generatedInPhase: 1 },
  boss:       { type: 'boss',       label: 'Boss',          emoji: '👑', theme: 'Sala del Boss',    isCombat: true,  resolverId: 'boss',       generatedInPhase: 1 },
  recruit:    { type: 'recruit',    label: 'Reclutamento',  emoji: '👥', theme: 'Sala Comune',      isCombat: false, resolverId: 'recruit',    generatedInPhase: 1 },
  relic:      { type: 'relic',      label: 'Reliquia',      emoji: '💎', theme: 'Stanza Segreta',   isCombat: false, resolverId: 'relic',      generatedInPhase: 1 },
  infirmary:  { type: 'infirmary',  label: 'Infermeria',    emoji: '🏥', theme: "Ala dell'Infermeria", isCombat: false, resolverId: 'infirmary',  generatedInPhase: 1 },
  spellForge: { type: 'spellForge', label: 'Aumento Magia', emoji: '✨', theme: 'Camera degli Incantesimi', isCombat: false, resolverId: 'spellForge', generatedInPhase: 1 },
  shop:       { type: 'shop',       label: 'Negozio',       emoji: '🏪', theme: 'Diagon Alley',     isCombat: false, resolverId: 'shop',       generatedInPhase: 2 },
  event:      { type: 'event',      label: 'Evento',        emoji: '📖', theme: 'Imprevisto',       isCombat: false, resolverId: 'event',      generatedInPhase: 2 },
  commonRoom: { type: 'commonRoom', label: 'Sala Comune',   emoji: '🛏', theme: 'Sala Comune',      isCombat: false, resolverId: 'commonRoom', generatedInPhase: 2 },
  library:    { type: 'library',    label: 'Biblioteca',    emoji: '📚', theme: 'Biblioteca',       isCombat: false, resolverId: 'library',    generatedInPhase: 3 },
  potions:    { type: 'potions',    label: 'Aula Pozioni',  emoji: '🧪', theme: 'Sotterranei',      isCombat: false, resolverId: 'potions',    generatedInPhase: 3 },
  forest:     { type: 'forest',     label: 'Foresta',       emoji: '🌲', theme: 'Foresta Proibita', isCombat: false, resolverId: 'forest',     generatedInPhase: 3 },
}

export function nodeKind(type: RunNodeType): NodeKind {
  return NODE_CATALOG[type]
}

export function phase1Types(): RunNodeType[] {
  return (Object.values(NODE_CATALOG) as NodeKind[])
    .filter(k => k.generatedInPhase === 1)
    .map(k => k.type)
}
