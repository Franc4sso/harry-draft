import type { Rng } from '@/game/engine/rng'
import type { RtBattleResult, RtFrame, RtOptions, RtSideId, RtUnitInput } from '@/types/rt'
import { RT, round1, round2 } from './constants'
import { applySuddenDeath } from './damage'
import { activeMulticast, effectiveCd } from './effects'
import { applyStaticContinuo } from './abilities'
import { castSpell, spellCdBonus } from './spells'
import { alive, createState, emit, unitByKey, type RtState } from './state'
import { isFrozen, tickTeamStatuses, tickUnitStatuses, timerMult } from './status'
import { fireInizio, fireOgniSecondi, fireSoglie, processQueue } from './triggers'

export function snapshotFrame(state: RtState): RtFrame {
  const units: RtFrame['units'] = {}
  for (const s of state.sides) for (const u of s.units) units[u.key] = { timer: u.timer, cd: round1(effectiveCd(state, u) - spellCdBonus(u)), statuses: u.statuses.map(x => ({ ...x })), ko: u.ko, multicast: activeMulticast(state, u) }
  const [L, R] = state.sides
  return {
    t: round1(state.t),
    hp: [L.hp, R.hp], hpMax: [L.hpMax, R.hpMax], shield: [L.shield, R.shield],
    segni: [{ ...L.segni }, { ...R.segni }], vulnerabile: [L.vulnerabile, R.vulnerabile],
    units, eventRange: [state.frameStart, state.events.length],
  }
}

function pushFrameIfEvents(state: RtState): void {
  if (state.events.length > state.frameStart) { state.frames.push(snapshotFrame(state)); state.frameStart = state.events.length }
}

function readyToCast(state: RtState): import('./state').RtUnit[] {
  const out = []
  for (const side of ['left', 'right'] as const) for (const u of alive(state, side)) if (!isFrozen(u) && u.timer + 1e-9 >= effectiveCd(state, u) - spellCdBonus(u)) out.push(u)
  return out
}

function runCasts(state: RtState): void {
  for (let guard = 0; guard < 8; guard++) {
    let any = false
    for (const u of readyToCast(state)) { castSpell(state, u); u.timer = 0; any = true }
    while (state.pendingInnesco.length) {
      const key = state.pendingInnesco.shift()!
      const u = unitByKey(state, key)
      if (u && !u.ko && !isFrozen(u)) { castSpell(state, u, { innesco: true }); any = true }
    }
    processQueue(state)
    if (!any) return
  }
}

const ended = (state: RtState) => state.sides[0].hp <= 0 || state.sides[1].hp <= 0

export function simulateRt(left: RtUnitInput[], right: RtUnitInput[], rng: Rng, opts: RtOptions = {}): RtBattleResult {
  const state = createState(left, right, rng, opts)
  emit(state, { kind: 'inizio' })
  applyStaticContinuo(state)
  fireInizio(state)
  runCasts(state)
  pushFrameIfEvents(state)
  while (!ended(state) && state.t + 1e-9 < state.maxSeconds) {
    state.t = round1(state.t + RT.tick); state.tick += 1
    tickUnitStatuses(state, RT.tick)
    tickTeamStatuses(state)
    // round2, non round1: a mezza velocità (Lentezza) il timer avanza di 0,05 e round1 lo cancellerebbe.
    for (const side of ['left', 'right'] as const) for (const u of alive(state, side)) if (!isFrozen(u)) u.timer = round2(u.timer + RT.tick * timerMult(u))
    runCasts(state)
    fireOgniSecondi(state)
    fireSoglie(state)
    applySuddenDeath(state)
    processQueue(state)
    pushFrameIfEvents(state)
  }
  const [L, R] = state.sides
  const timedOut = !ended(state)
  let winner: RtSideId
  if (L.hp <= 0 && R.hp <= 0) winner = 'left'
  else if (L.hp <= 0) winner = 'right'
  else if (R.hp <= 0) winner = 'left'
  else winner = L.hp / L.hpMax >= R.hp / R.hpMax ? 'left' : 'right'
  emit(state, { kind: 'fine', side: winner, value: round1(state.t) })
  state.frames.push(snapshotFrame(state))
  const wside = winner === 'left' ? L : R
  const mvp = [...wside.units].sort((a, b) => b.score - a.score || a.slot - b.slot)[0]
  return {
    winner, durata: round1(state.t), events: state.events, frames: state.frames,
    mvpId: mvp?.id ?? '', koLeft: L.units.filter(u => u.ko).map(u => u.id), koRight: R.units.filter(u => u.ko).map(u => u.id),
    hpFinal: [L.hp, R.hp], hpMax: [L.hpMax, R.hpMax], memoriaDelta: state.memoriaDelta, reazioni: state.reazioni, timedOut,
  }
}
