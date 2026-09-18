import type { Ability } from '@/types/rt'
import { GRIFONDORO } from './grifondoro'
import { SERPEVERDE } from './serpeverde'
import { CORVONERO } from './corvonero'
import { TASSOROSSO } from './tassorosso'

export { GRIFONDORO, SERPEVERDE, CORVONERO, TASSOROSSO }
export const ABILITIES: Ability[] = [...GRIFONDORO, ...SERPEVERDE, ...CORVONERO, ...TASSOROSSO]
export const ABILITY_BY_ID: Record<string, Ability> = Object.fromEntries(ABILITIES.map(a => [a.id, a]))
