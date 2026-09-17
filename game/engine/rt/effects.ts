import type { Effect, RtSideId, Target } from '@/types/rt'
import { RT, levelCastMult, round1 } from './constants'
import { addShield, dealDamage, heal } from './damage'
import { applyGelo, applySegno } from './segni'
import { emit, other, sideOf, type RtState, type RtUnit } from './state'
import { applyUnitStatus, applyVulnerabile, hasStatus, koUnit, rianimaUnit, statusOf } from './status'
import { continuoMods } from './abilities'

export interface EffectCtx { target: Target; unitTarget?: RtUnit; abilityId?: string }

const HOSTILE = new Set<Effect['kind']>(['danno', 'segno', 'gelo', 'silenzio', 'lentezza', 'indebolito', 'disarmo', 'sospeso', 'vulnerabile', 'ko'])

export function dannoMult(state: RtState, u: RtUnit): number {
  const side = sideOf(state, u.side)
  const cm = continuoMods(state, u)
  const bonus = u.dannoPctBonus.filter(b => b.until === 'battaglia' || b.until > state.t + 1e-9).reduce((a, b) => a + b.pct, 0)
  const ind = statusOf(u, 'indebolito')?.pct ?? 0
  return (1 + bonus + cm.dannoPct + (side.mods.dannoPct ?? 0) + (u.permanenti?.dannoPct ?? 0)) * (1 - ind)
}
export function dannoFlat(state: RtState, u: RtUnit): number { return u.dannoFlatBonus + (u.permanenti?.dannoFlat ?? 0) }
export function effectiveCd(state: RtState, u: RtUnit): number {
  const cm = continuoMods(state, u)
  return Math.max(RT.cdMin, round1((u.cd + u.cdFlatBonus + cm.cdFlat) * (1 + u.cdPctBonus + cm.cdPct)))
}
export function activeMulticast(state: RtState, u: RtUnit): number {
  u.multicastBonus = u.multicastBonus.filter(b => b.until === 'battaglia' || b.until > state.t + 1e-9)
  return 1 + u.multicastBonus.reduce((a, b) => a + b.n, 0)
}

function sideFor(effect: Effect, actorSide: RtSideId, target: Target): RtSideId {
  if (target === 'squadraPropria') return actorSide
  if (target === 'squadraNemica') return other(actorSide)
  return HOSTILE.has(effect.kind) ? other(actorSide) : actorSide
}

export function applyEffect(state: RtState, actor: RtUnit | null, actorSide: RtSideId, targets: RtUnit[], effect: Effect, ctx: EffectCtx): void {
  const side = sideFor(effect, actorSide, ctx.target)
  const s = sideOf(state, side)
  const own = sideOf(state, actorSide)
  const ut = ctx.unitTarget ?? targets[0]
  switch (effect.kind) {
    case 'danno': {
      if (!actor) return
      const base = actor.stats.atk * effect.potenza * levelCastMult(actor.level) * dannoMult(state, actor) + dannoFlat(state, actor)
      dealDamage(state, actor, side, Math.round(base), { diretto: true, unitTarget: side === other(actorSide) ? ut : undefined, name: ctx.abilityId })
      return
    }
    case 'cura': heal(state, side, effect.n, actor ?? undefined); return
    case 'scudo': addShield(state, side, effect.n, actor ?? undefined); return
    case 'scudoIniziale': s.shield += effect.n; emit(state, { kind: 'scudo', side: actor?.side, slot: actor?.slot, targetSide: side, value: effect.n, name: 'iniziale' }); return
    case 'hpPct': { const add = Math.round(s.hpMax * effect.pct); s.hpMax += add; s.hp += add; return }
    case 'segno': applySegno(state, actor, side, effect.segno, effect.stacks, { unitTarget: side === other(actorSide) ? ut : undefined }); return
    case 'rimuoviSegnoProprio': own.segni[effect.segno] = 0; return
    case 'vulnerabile': applyVulnerabile(state, side, effect.secondi * (1 + (own.durataStatusPct.vulnerabile ?? 0))); return
    case 'gelo': for (const t of targets) applyGelo(state, actor, t, round1(effect.secondi * (1 + (own.durataStatusPct.gelo ?? 0)))); return
    case 'silenzio': case 'lentezza': for (const t of targets) applyUnitStatus(state, t, { kind: effect.kind, remaining: round1(effect.secondi * (1 + (own.durataStatusPct[effect.kind] ?? 0))) }, actor ?? undefined); return
    case 'sospeso': for (const t of targets) applyUnitStatus(state, t, { kind: 'sospeso', remaining: effect.secondi }, actor ?? undefined); return
    case 'indebolito': for (const t of targets) applyUnitStatus(state, t, { kind: 'indebolito', remaining: effect.secondi, pct: effect.pct }, actor ?? undefined); return
    case 'disarmo': for (const t of targets) applyUnitStatus(state, t, { kind: 'disarmo', remaining: 1 }, actor ?? undefined); return
    case 'ko': for (const t of targets) if (t.side !== actorSide) koUnit(state, t, actor ?? undefined); return
    case 'protego': for (const t of targets) if (t.side === actorSide) applyUnitStatus(state, t, { kind: 'protego', remaining: 1 }); return
    case 'purifica': for (const t of targets) if (t.side === actorSide) { const i = t.statuses.findIndex(x => x.kind !== 'protego'); if (i >= 0) { t.statuses.splice(i, 1); emit(state, { kind: 'status', side: t.side, slot: t.slot, name: 'purifica', value: 0 }) } } return
    case 'rianima': for (const t of targets) if (t.side === actorSide) rianimaUnit(state, t, actor ?? undefined); return
    case 'carica': for (const t of targets) if (t.side === actorSide && !t.ko) { t.timer = round1(t.timer + effect.secondi); emit(state, { kind: 'carica', side: actor?.side, slot: actor?.slot, targetSide: t.side, targetSlot: t.slot, value: effect.secondi }) } return
    case 'innesco': for (const t of targets) if (t.side === actorSide && !t.ko) { state.pendingInnesco.push(t.key); emit(state, { kind: 'innesco', side: actor?.side, slot: actor?.slot, targetSide: t.side, targetSlot: t.slot }) } return
    case 'multicast': for (const t of targets) t.multicastBonus.push({ n: effect.n, until: effect.durata === 'battaglia' ? 'battaglia' : round1(state.t + (effect.durata ?? 0)) }); return
    case 'dannoPct': {
      if (ctx.target === 'squadraNemica') throw new Error('dannoPct su squadraNemica: usare una riga Continuo (enemyDannoSubitoPct)')
      for (const t of targets) t.dannoPctBonus.push({ pct: effect.pct, until: effect.durata === 'battaglia' ? 'battaglia' : round1(state.t + (effect.durata ?? 0)) })
      return
    }
    case 'dannoFlat': for (const t of targets) t.dannoFlatBonus += effect.n; return
    case 'cdPct': for (const t of targets) t.cdPctBonus += effect.pct; return
    case 'cdFlat': for (const t of targets) t.cdFlatBonus += effect.secondi; return
    case 'immune': for (const t of targets) t.immune.add(effect.a); return
    case 'copre': { if (!actor) return; const w = own.units.find(u => u.id === effect.wizardId); if (w) w.copertoDa = actor.key; return }
    case 'durataStatusPct': own.durataStatusPct[effect.status] = (own.durataStatusPct[effect.status] ?? 0) + effect.pct; return
    default: { const _never: never = effect; throw new Error('effetto sconosciuto: ' + JSON.stringify(_never)) }
  }
}
