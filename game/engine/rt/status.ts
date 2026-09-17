import type { UnitStatusKind } from '@/types/rt'
import type { RtUnit } from './state'
export const hasStatus = (u: RtUnit, kind: UnitStatusKind) => u.statuses.some(s => s.kind === kind && s.remaining > 0)
