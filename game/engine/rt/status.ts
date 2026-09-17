import type { RtSideId, UnitStatus, UnitStatusKind } from '@/types/rt'
import { RT, near, round1 } from './constants'
import { emit, other, sideOf, type RtState, type RtUnit } from './state'

export const hasStatus = (u: RtUnit, kind: UnitStatusKind) => u.statuses.some(s => s.kind === kind && s.remaining > 1e-9)
export const statusOf = (u: RtUnit, kind: UnitStatusKind): UnitStatus | undefined => u.statuses.find(s => s.kind === kind)
export const isFrozen = (u: RtUnit) => hasStatus(u, 'gelo')
export const timerMult = (u: RtUnit) => (hasStatus(u, 'lentezza') ? RT.lentezzaTimerMult : 1)

const HOSTILE: ReadonlySet<UnitStatusKind> = new Set(['gelo', 'silenzio', 'lentezza', 'indebolito', 'disarmo', 'sospeso'])

export function consumeProtego(u: RtUnit): boolean {
  const i = u.statuses.findIndex(s => s.kind === 'protego')
  if (i < 0) return false
  u.statuses.splice(i, 1)
  return true
}

function upsert(u: RtUnit, st: UnitStatus): UnitStatus {
  const cur = statusOf(u, st.kind)
  if (!cur) { const copy = { ...st }; u.statuses.push(copy); return copy }
  cur.remaining = Math.max(cur.remaining, st.remaining)
  if (st.pct !== undefined) cur.pct = Math.max(cur.pct ?? 0, st.pct)
  return cur
}

/** Ritorna false se l'effetto è stato assorbito (Protego) o ignorato (immune). */
export function applyUnitStatus(state: RtState, target: RtUnit, st: UnitStatus, source?: RtUnit): boolean {
  if (target.ko) return false
  if (st.kind === 'gelo' && target.immune.has('gelo')) return false
  if (st.kind === 'silenzio' && target.immune.has('silenzio')) return false
  if (HOSTILE.has(st.kind) && consumeProtego(target)) {
    emit(state, { kind: 'status', side: target.side, slot: target.slot, status: 'protego', name: 'assorbito', value: 0 })
    return false
  }
  let s = { ...st }
  if (s.kind === 'gelo' && hasStatus(target, 'lentezza')) {
    s = { ...s, remaining: round1(s.remaining * RT.reazioni.geloLentoMult) }
    reazione(state, 'GeloLento', target.side)
  }
  if (s.kind === 'protego' || s.kind === 'disarmo') { if (!hasStatus(target, s.kind)) target.statuses.push({ kind: s.kind, remaining: 1 }) }
  else upsert(target, s)
  if (s.kind === 'gelo') { const en = sideOf(state, other(target.side)); en.lastGeloAt = state.t }
  emit(state, { kind: 'status', side: target.side, slot: target.slot, status: s.kind, value: s.remaining, targetSide: source?.side, targetSlot: source?.slot })
  if ((s.kind === 'silenzio' && hasStatus(target, 'disarmo')) || (s.kind === 'disarmo' && hasStatus(target, 'silenzio'))) {
    reazione(state, 'Impotente', target.side)
    upsert(target, { kind: 'gelo', remaining: RT.reazioni.impotenteGelo })
  }
  return true
}

export function reazione(state: RtState, name: string, targetSide: RtSideId, value?: number): void {
  state.reazioni[name] = (state.reazioni[name] ?? 0) + 1
  emit(state, { kind: 'reazione', name, targetSide, value })
}

export function tickUnitStatuses(state: RtState, dt: number): void {
  for (const side of state.sides) for (const u of side.units) {
    for (const s of u.statuses) if (s.kind !== 'protego' && s.kind !== 'disarmo') s.remaining = round1(s.remaining - dt)
    u.statuses = u.statuses.filter(s => s.kind === 'protego' || s.kind === 'disarmo' || s.remaining > 1e-9)
  }
}

export function applyVulnerabile(state: RtState, side: RtSideId, secondi: number): void {
  const s = sideOf(state, side)
  s.vulnerabile = Math.max(s.vulnerabile, secondi)
  emit(state, { kind: 'status', targetSide: side, status: 'vulnerabile', value: secondi })
}

/** Danno da status di squadra. La Fiamma rispetta lo Scudo, il Veleno lo ignora. */
function statusDamage(state: RtState, side: RtSideId, amount: number, name: string, ignoreShield: boolean): void {
  const s = sideOf(state, side)
  let rest = amount
  if (!ignoreShield && s.shield > 0) { const a = Math.min(s.shield, rest); s.shield -= a; rest -= a }
  s.hp = Math.max(0, s.hp - rest)
  emit(state, { kind: 'danno', targetSide: side, name, value: amount })
}

const onBeat = (t: number, every: number) => near(Math.round(t / every) * every, t)

export function tickTeamStatuses(state: RtState): void {
  for (const s of state.sides) {
    const attacker = sideOf(state, other(s.side))
    if (s.segni.fiamma > 0 && onBeat(state.t, RT.fiamma.every)) {
      statusDamage(state, s.side, s.segni.fiamma * RT.fiamma.perStack, 'Fiamma', false)
      if (s.fiammaFreeze <= 0 && !attacker.mods.fiammaNonDecade) s.segni.fiamma -= 1
    }
    const velenoEvery = s.conduzione > 0 ? RT.veleno.everyConduzione : RT.veleno.every
    if (s.segni.veleno > 0 && onBeat(state.t, velenoEvery)) {
      let dmg = s.segni.veleno * RT.veleno.perStack * (attacker.mods.velenoMult ?? 1)
      if (attacker.mods.cancrenaSotto !== undefined && s.hp < s.hpMax * attacker.mods.cancrenaSotto) dmg *= 2
      statusDamage(state, s.side, Math.round(dmg), 'Veleno', true)
    }
    s.vulnerabile = Math.max(0, round1(s.vulnerabile - RT.tick))
    s.conduzione = Math.max(0, round1(s.conduzione - RT.tick))
    s.fiammaFreeze = Math.max(0, round1(s.fiammaFreeze - RT.tick))
  }
}
