import type { RtSideId, Target } from '@/types/rt'
import { adjacent, behind, colOf, colSlots, front, leftOf, rightOf, rowOf, rowSlots } from './grid'
import { alive, other, sideOf, unitAt, type RtState, type RtUnit } from './state'

export function applyCopertura(state: RtState, side: RtSideId, target: RtUnit): RtUnit {
  if (target.copertoDa) { const c = sideOf(state, side).units.find(u => u.key === target.copertoDa); if (c && !c.ko) return c }
  if (rowOf(target.slot) === 0) return target
  const f = unitAt(state, side, front(target.slot)!)
  return f && !f.ko ? f : target
}

/** Bersaglio-unità nemico: opposto → Copertura → stessa riga più vicino (sinistra prima) → casuale tra i vivi. */
export function unitTarget(state: RtState, fromSide: RtSideId, fromSlot: number, opts: { ignoraCopertura?: boolean } = {}): RtUnit | null {
  const side = other(fromSide)
  const cover = (u: RtUnit) => (opts.ignoraCopertura ? u : applyCopertura(state, side, u))
  const opp = unitAt(state, side, fromSlot)
  if (opp && !opp.ko) return cover(opp)
  const row = rowSlots(rowOf(fromSlot) as 0 | 1)
  const col = colOf(fromSlot)
  const candidates = row
    .filter(s => s !== fromSlot)
    .map(s => ({ s, u: unitAt(state, side, s) }))
    .filter(x => x.u && !x.u.ko)
    .sort((a, b) => Math.abs(colOf(a.s) - col) - Math.abs(colOf(b.s) - col) || a.s - b.s)
  if (candidates.length) return cover(candidates[0]!.u!)
  const pool = alive(state, side)
  if (!pool.length) return null
  return cover(state.rng.pick(pool))
}

const bySlot = (state: RtState, side: RtSideId, slots: (number | null)[]): RtUnit[] =>
  slots.filter((s): s is number => s !== null).map(s => unitAt(state, side, s)).filter((u): u is RtUnit => !!u && !u.ko)

export function selectTargets(state: RtState, actor: RtUnit, target: Target, arg?: string, ctx: { bersaglio?: RtUnit } = {}): RtUnit[] {
  const me = actor.side, en = other(me)
  switch (target) {
    case 'se': return actor.ko ? [] : [actor]
    case 'davanti': return bySlot(state, me, [front(actor.slot)])
    case 'dietro': return bySlot(state, me, [behind(actor.slot)])
    case 'sinistra': return bySlot(state, me, [leftOf(actor.slot)])
    case 'destra': return bySlot(state, me, [rightOf(actor.slot)])
    case 'adiacenti': return bySlot(state, me, adjacent(actor.slot))
    case 'riga': return bySlot(state, me, rowSlots(rowOf(actor.slot) as 0 | 1))
    case 'colonna': return bySlot(state, me, colSlots(colOf(actor.slot)))
    case 'tuttiAlleati': return alive(state, me)
    case 'alleatiTag': return alive(state, me).filter(u => u.tags.includes(arg ?? ''))
    case 'alleatiCasa': return alive(state, me).filter(u => u.house === arg)
    case 'alleatiRuolo': return alive(state, me).filter(u => u.role === arg)
    case 'alleatoSlotMinimo': {
      const ko = sideOf(state, me).units.filter(u => u.ko).sort((a, b) => a.slot - b.slot)
      return ko.length ? [ko[0]!] : []
    }
    case 'opposto': { const t = unitTarget(state, me, actor.slot, { ignoraCopertura: sideOf(state, me).mods.ignoraCopertura }); return t ? [t] : [] }
    case 'nemicoCasuale': { const pool = alive(state, en); return pool.length ? [state.rng.pick(pool)] : [] }
    case 'tuttiNemici': return alive(state, en)
    case 'primaFilaNemica': return bySlot(state, en, rowSlots(0))
    case 'adiacenteDelBersaglio': return ctx.bersaglio ? bySlot(state, ctx.bersaglio.side, adjacent(ctx.bersaglio.slot)) : []
    case 'squadraNemica': case 'squadraPropria': return []
  }
}
