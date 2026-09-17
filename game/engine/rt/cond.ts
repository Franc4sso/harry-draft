import type { Cond } from '@/types/rt'
import { adjacent } from './grid'
import { alive, other, sideOf, unitAt, type RtState, type RtUnit } from './state'
import { hasStatus } from './status'

export interface CondCtx { bersaglio?: RtUnit; lineKey?: string }

export function checkCond(state: RtState, actor: RtUnit, cond: Cond | undefined, ctx: CondCtx): boolean {
  if (!cond) return true
  const me = sideOf(state, actor.side), en = sideOf(state, other(actor.side))
  if ('adiacente' in cond) {
    const q = cond.adiacente
    return adjacent(actor.slot).some(s => {
      const u = unitAt(state, actor.side, s)
      if (!u || u.ko) return false
      if (q.wizardId && u.id !== q.wizardId) return false
      if (q.tag && !u.tags.includes(q.tag)) return false
      if (q.casa && u.house !== q.casa) return false
      if (q.ruolo && u.role !== q.ruolo) return false
      return true
    })
  }
  if ('inSquadra' in cond) {
    const q = cond.inSquadra
    return alive(state, actor.side).some(u => u !== actor && (!q.wizardId || u.id === q.wizardId) && (!q.tag || u.tags.includes(q.tag)))
  }
  if ('hpNemicaSotto' in cond) return en.hp < en.hpMax * cond.hpNemicaSotto
  if ('hpPropriaSotto' in cond) return me.hp < me.hpMax * cond.hpPropriaSotto
  if ('segnoNemico' in cond) return en.segni[cond.segnoNemico.segno] >= cond.segnoNemico.min
  if ('bersaglio' in cond) {
    const b = ctx.bersaglio
    if (!b) return false
    const kind = cond.bersaglio === 'gelato' ? 'gelo' : cond.bersaglio === 'lento' ? 'lentezza' : 'silenzio'
    return hasStatus(b, kind)
  }
  if ('entroSecondiDa' in cond) {
    const q = cond.entroSecondiDa
    const at = q.evento === 'gelo' ? me.lastGeloAt : actor.lastAdjacentCastAt
    return state.t - at <= q.secondi + 1e-9
  }
  if ('ogniNLanci' in cond) return actor.casts > 0 && actor.casts % cond.ogniNLanci === 0
  if ('chance' in cond) return state.rng.chance(cond.chance)
  if ('slotVuotiOKo' in cond) return alive(state, actor.side).length < 6
  if ('nessunAdiacente' in cond) return !adjacent(actor.slot).some(s => { const u = unitAt(state, actor.side, s); return u && !u.ko })
  return false
}
