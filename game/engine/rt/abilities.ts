import type { AbilityLine, Effect, RtSideId } from '@/types/rt'
import { checkCond } from './cond'
import { applyEffect } from './effects'
import { alive, emit, other, sideOf, type RtState, type RtUnit } from './state'
import { selectTargets } from './targeting'

export interface OwnedLine { line: AbilityLine; key: string; abilityId: string }

export function linesOf(u: RtUnit): OwnedLine[] {
  const out: OwnedLine[] = []
  const ab = u.ability
  if (ab) {
    ab.lines.forEach((line, i) => out.push({ line, key: `${u.key}#${i}`, abilityId: ab.id }))
    if (ab.lv4 && u.level === 4) out.push({ line: ab.lv4, key: `${u.key}#lv4`, abilityId: ab.id })
  }
  ;(u.extraLines ?? []).forEach((line, i) => out.push({ line, key: `${u.key}#x${i}`, abilityId: `extra:${u.id}` }))
  return out
}

export const paramFor = (line: AbilityLine, level: number): number | undefined => line.params?.[Math.min(level, 3) - 1]

export function withParam(effect: Effect, v: number | undefined): Effect {
  if (v === undefined) return effect
  switch (effect.kind) {
    case 'danno': return { ...effect, potenza: v }
    case 'dannoFlat': case 'cura': case 'scudo': case 'scudoIniziale': case 'multicast': return { ...effect, n: v }
    case 'dannoPct': case 'indebolito': case 'cdPct': case 'hpPct': case 'durataStatusPct': return { ...effect, pct: v }
    case 'segno': return { ...effect, stacks: v }
    case 'gelo': case 'silenzio': case 'lentezza': case 'sospeso': case 'vulnerabile': case 'carica': case 'cdFlat': return { ...effect, secondi: v }
    default: return effect
  }
}

function anchor(state: RtState, owner: RtUnit | null, side: RtSideId): RtUnit | null {
  return owner ?? alive(state, side)[0] ?? null
}

export function fireLine(state: RtState, owner: RtUnit | null, side: RtSideId, line: AbilityLine, key: string, abilityId: string, ctx: { bersaglio?: RtUnit }): boolean {
  const actor = anchor(state, owner, side)
  if (!actor) return false
  if (owner && owner.ko && line.trigger !== 'koSubito') return false
  const limits = (owner ?? actor).limits
  if (line.limit?.perBattle !== undefined && (limits[key] ?? 0) >= line.limit.perBattle) return false
  if (line.limit?.everySeconds !== undefined) { const last = limits[key + ':t']; if (last !== undefined && state.t - last < line.limit.everySeconds - 1e-9) return false }
  if (!checkCond(state, actor, line.cond, { bersaglio: ctx.bersaglio, lineKey: key })) return false
  const targets = selectTargets(state, actor, line.target, line.targetArg, { bersaglio: ctx.bersaglio })
  const isTeam = line.target === 'squadraPropria' || line.target === 'squadraNemica'
  if (!isTeam && targets.length === 0 && !['danno', 'cura', 'scudo', 'scudoIniziale', 'segno', 'vulnerabile', 'hpPct', 'rimuoviSegnoProprio', 'durataStatusPct', 'copre'].includes(line.effect.kind)) return false
  const effect = withParam(line.effect, paramFor(line, (owner ?? actor).level))
  applyEffect(state, owner ?? actor, side, targets, effect, { target: line.target, unitTarget: ctx.bersaglio, abilityId })
  limits[key] = (limits[key] ?? 0) + 1
  limits[key + ':t'] = state.t
  emit(state, { kind: 'trigger', side, slot: owner?.slot, abilityId, name: line.trigger })
  return true
}

const DYN = new Set<Effect['kind']>(['dannoPct', 'cdPct', 'cdFlat'])
const STATIC = new Set<Effect['kind']>(['hpPct', 'scudoIniziale', 'immune', 'copre', 'durataStatusPct'])

function continuoLines(state: RtState, side: RtSideId): { owner: RtUnit | null; ol: OwnedLine }[] {
  const out: { owner: RtUnit | null; ol: OwnedLine }[] = []
  for (const u of alive(state, side)) for (const ol of linesOf(u)) if (ol.line.trigger === 'continuo') out.push({ owner: u, ol })
  ;(sideOf(state, side).mods.lines ?? []).forEach((line, i) => { if (line.trigger === 'continuo') out.push({ owner: null, ol: { line, key: `${side}#m${i}`, abilityId: 'mods' } }) })
  return out
}

/** Memo per tick: `continuoMods` è letto per ogni unità a ogni tick (effectiveCd) e ricalcolarlo scansionando tutte le righe
 *  costa troppo nell'harness. La chiave include `state.tick` e il numero di eventi, così KO/adiacenza (che emettono eventi) invalidano. */
const memo = new WeakMap<RtState, Map<string, { dannoPct: number; cdPct: number; cdFlat: number }>>()
export function continuoMods(state: RtState, u: RtUnit): { dannoPct: number; cdPct: number; cdFlat: number } {
  let m = memo.get(state); if (!m) { m = new Map(); memo.set(state, m) }
  // Nella chiave anche i vivi per lato: un KO/Rianima cambia adiacenze e cond anche senza passare da emit (test, mutazioni dirette).
  const k = `${u.key}@${state.tick}:${state.events.length}:${alive(state, 'left').length}:${alive(state, 'right').length}`
  const hit = m.get(k); if (hit) return hit
  const acc = computeContinuoMods(state, u)
  if (m.size > 64) m.clear()
  m.set(k, acc)
  return acc
}
function computeContinuoMods(state: RtState, u: RtUnit): { dannoPct: number; cdPct: number; cdFlat: number } {
  const acc = { dannoPct: 0, cdPct: 0, cdFlat: 0 }
  for (const { owner, ol } of continuoLines(state, u.side)) {
    const e = ol.line.effect
    if (!DYN.has(e.kind) || ol.line.target === 'squadraNemica') continue
    const actor = anchor(state, owner, u.side)!
    if (!checkCond(state, actor, ol.line.cond, {})) continue
    const targets = ol.line.target === 'squadraPropria' ? alive(state, u.side) : selectTargets(state, actor, ol.line.target, ol.line.targetArg)
    if (!targets.includes(u)) continue
    const eff = withParam(e, paramFor(ol.line, actor.level))
    if (eff.kind === 'dannoPct') acc.dannoPct += eff.pct
    else if (eff.kind === 'cdPct') acc.cdPct += eff.pct
    else if (eff.kind === 'cdFlat') acc.cdFlat += eff.secondi
  }
  return acc
}

/** Somma delle righe Continuo `dannoPct` su `squadraNemica` del lato OPPOSTO a `side`: quanto in più subisce `side`. */
export function enemyDannoSubitoPct(state: RtState, side: RtSideId): number {
  let pct = 0
  for (const { owner, ol } of continuoLines(state, other(side))) {
    if (ol.line.target !== 'squadraNemica' || ol.line.effect.kind !== 'dannoPct') continue
    const actor = anchor(state, owner, other(side))!
    if (!checkCond(state, actor, ol.line.cond, {})) continue
    const eff = withParam(ol.line.effect, paramFor(ol.line, actor.level)) as Extract<Effect, { kind: 'dannoPct' }>
    pct += eff.pct
  }
  return pct
}

export function applyStaticContinuo(state: RtState): void {
  for (const side of ['left', 'right'] as const) for (const { owner, ol } of continuoLines(state, side)) {
    if (!STATIC.has(ol.line.effect.kind)) continue
    const key = ol.key + ':static'
    const limits = (owner ?? anchor(state, null, side))!.limits
    if (limits[key]) continue
    limits[key] = 1
    const actor = anchor(state, owner, side)!
    if (!checkCond(state, actor, ol.line.cond, {})) continue
    const targets = selectTargets(state, actor, ol.line.target, ol.line.targetArg)
    applyEffect(state, owner ?? actor, side, targets, withParam(ol.line.effect, paramFor(ol.line, actor.level)), { target: ol.line.target, abilityId: ol.abilityId })
  }
}
