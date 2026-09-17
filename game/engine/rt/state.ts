import type { Rng } from '@/game/engine/rng'
import type { CrescitaTrigger, RtEvent, RtFrame, RtOptions, RtSideId, RtSideMods, RtUnitInput, Segno, Trigger, UnitStatus } from '@/types/rt'
import { rtUnitKey } from '@/types/rt'
import { RT, cooldownFor, levelHpMult } from './constants'

export interface RtUnit extends RtUnitInput {
  key: string
  side: RtSideId
  timer: number
  cd: number
  statuses: UnitStatus[]
  ko: boolean
  /** Multicast extra: `battaglia` = permanente, altrimenti scade a `t` */
  multicastBonus: { n: number; until: number | 'battaglia' }[]
  dannoPctBonus: { pct: number; until: number | 'battaglia' }[]
  dannoFlatBonus: number
  cdPctBonus: number
  cdFlatBonus: number
  casts: number
  lastCastAt: number
  crescendo: number
  /** Ultimo istante in cui un alleato adiacente ha lanciato (per `entroSecondiDa`). */
  lastAdjacentCastAt: number
  /** Ultimo istante in cui QUESTA unità è stata congelata (per il Crescendo `lancioSenzaGelo`). */
  lastGeloAt: number
  score: number
  /** Contatori per `limit` (chiave = indice riga) e `ogniNLanci`. */
  limits: Record<string, number>
  immune: Set<'gelo' | 'silenzio' | 'ko'>
  copertoDa?: string
}

export interface RtSideState {
  side: RtSideId
  hp: number
  hpMax: number
  shield: number
  segni: Record<Segno, number>
  vulnerabile: number
  conduzione: number
  fiammaFreeze: number
  units: RtUnit[]
  mods: RtSideMods
  koFatti: number
  /** Soglia "HP nemica < X%" bonus accumulato (Carnefice). */
  sogliaBonus: number
  /** Ultimo istante in cui un Gelo è stato applicato al NEMICO (per `entroSecondiDa: gelo`). */
  lastGeloAt: number
  ultimoGeloAt: number
  soglieScattate: Set<string>
  durataStatusPct: Partial<Record<'gelo' | 'silenzio' | 'lentezza' | 'vulnerabile', number>>
}

export interface TriggerEvent { trigger: Trigger; side: RtSideId; unitKey?: string; bersaglioKey?: string }

export interface RtState {
  t: number
  tick: number
  sides: [RtSideState, RtSideState]
  rng: Rng
  events: RtEvent[]
  frames: RtFrame[]
  reazioni: Record<string, number>
  memoriaDelta: Record<string, number>
  kind: 'normal' | 'elite' | 'boss'
  maxSeconds: number
  depth: number
  frameStart: number
  queue: TriggerEvent[]
  pendingInnesco: string[]
}

export const other = (side: RtSideId): RtSideId => (side === 'left' ? 'right' : 'left')
export const sideOf = (state: RtState, side: RtSideId): RtSideState => state.sides[side === 'left' ? 0 : 1]

export function unitAt(state: RtState, side: RtSideId, slot: number): RtUnit | null {
  return sideOf(state, side).units.find(u => u.slot === slot) ?? null
}
export function alive(state: RtState, side: RtSideId): RtUnit[] {
  return sideOf(state, side).units.filter(u => !u.ko)
}
export function unitByKey(state: RtState, key: string): RtUnit | null {
  for (const s of state.sides) for (const u of s.units) if (u.key === key) return u
  return null
}
export function emit(state: RtState, ev: Omit<RtEvent, 't'>): void {
  state.events.push({ t: Math.round(state.t * 10) / 10, ...ev })
}

function makeUnit(input: RtUnitInput, side: RtSideId): RtUnit {
  return {
    ...input,
    key: rtUnitKey(side, input.id), side,
    timer: 0, cd: cooldownFor(input.stats.spd, input.level, input.spell.cdMod ?? 0),
    statuses: [], ko: false,
    multicastBonus: [], dannoPctBonus: [], dannoFlatBonus: 0, cdPctBonus: 0, cdFlatBonus: 0,
    casts: 0, lastCastAt: -Infinity, crescendo: 0, lastAdjacentCastAt: -Infinity, lastGeloAt: -Infinity,
    score: 0, limits: {}, immune: new Set(),
  }
}

function makeSide(inputs: RtUnitInput[], side: RtSideId, mods: RtSideMods): RtSideState {
  const seen = new Set<number>()
  for (const u of inputs) {
    if (!Number.isInteger(u.slot) || u.slot < 0 || u.slot > 5) throw new Error(`slot fuori griglia: ${u.id} → ${u.slot}`)
    if (seen.has(u.slot)) throw new Error(`slot duplicato: ${u.slot}`)
    seen.add(u.slot)
  }
  const units = [...inputs].sort((a, b) => a.slot - b.slot).map(u => makeUnit(u, side))
  const hpMax = Math.round(units.reduce((acc, u) => acc + u.stats.hp * levelHpMult(u.level), 0))
  const shield = Math.round(units.reduce((acc, u) => acc + u.stats.def * RT.scudoPerDef, 0) * (mods.scudoInizialeMult ?? 1))
  return {
    side, hp: hpMax, hpMax, shield,
    segni: { fiamma: 0, veleno: 0, scossa: 0 }, vulnerabile: 0, conduzione: 0, fiammaFreeze: 0,
    units, mods, koFatti: 0, sogliaBonus: 0, lastGeloAt: -Infinity, ultimoGeloAt: -Infinity, soglieScattate: new Set(),
    durataStatusPct: {},
  }
}

export function createState(left: RtUnitInput[], right: RtUnitInput[], rng: Rng, opts: RtOptions = {}): RtState {
  return {
    t: 0, tick: 0,
    sides: [makeSide(left, 'left', opts.leftMods ?? {}), makeSide(right, 'right', opts.rightMods ?? {})],
    rng, events: [], frames: [], reazioni: {}, memoriaDelta: {},
    kind: opts.kind ?? 'normal', maxSeconds: opts.maxSeconds ?? RT.maxSeconds,
    depth: 0, frameStart: 0, queue: [], pendingInnesco: [],
  }
}

/** Un evento di Crescita per l'unità: Memoria (delta per la run) o Crescendo (contatore di battaglia). */
export function noteCrescita(state: RtState, u: RtUnit, trigger: CrescitaTrigger): void {
  const c = u.spell.crescita
  if (!c || c.trigger !== trigger) return
  if (c.kind === 'memoria') state.memoriaDelta[u.key] = (state.memoriaDelta[u.key] ?? 0) + 1
  else u.crescendo += 1
}
