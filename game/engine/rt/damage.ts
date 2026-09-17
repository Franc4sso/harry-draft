import type { RtSideId } from '@/types/rt'
import { enemyDannoSubitoPct } from './abilities'
import { RT, near, round1 } from './constants'
import { alive, emit, noteCrescita, other, sideOf, type RtState, type RtUnit } from './state'
import { applyUnitStatus, hasStatus, reazione } from './status'

/** `reazioniFatte`: reazioni 4-6 (Frantuma, Vapore, Necrosi) già risolte in QUESTO cast — una sola volta, sulla prima risoluzione. */
export interface DamageOpts { unitTarget?: RtUnit; diretto?: boolean; name?: string; magieOscure?: boolean; ignoreShield?: boolean; frantumaMult?: number; noReflect?: boolean; reazioniFatte?: Set<string> }
export interface DamageOut { total: number; toShield: number; toHp: number; frantuma: boolean }

export function dealDamage(state: RtState, attacker: RtUnit | null, targetSide: RtSideId, amount: number, opts: DamageOpts = {}): DamageOut {
  const t = sideOf(state, targetSide)
  const atkSide = sideOf(state, other(targetSide))
  let dmg = amount
  if (t.vulnerabile > 0) dmg *= 1 + RT.vulnerabilePct
  dmg *= 1 + (t.mods.dannoSubitoPct ?? 0) + enemyDannoSubitoPct(state, targetSide)
  let frantuma = false
  const ut = opts.unitTarget
  const scossaPreFrantuma = t.segni.scossa
  if (opts.diretto && ut && !ut.ko && hasStatus(ut, 'gelo') && !opts.reazioniFatte?.has('Frantuma')) {
    ut.statuses = ut.statuses.filter(s => s.kind !== 'gelo')
    dmg *= opts.frantumaMult ?? RT.reazioni.frantumaMult
    frantuma = true
    opts.reazioniFatte?.add('Frantuma')
    reazione(state, 'Frantuma', targetSide)
    if (attacker) noteCrescita(state, attacker, 'reazione:frantuma')
    t.segni.scossa = Math.min(RT.scossa.cap, t.segni.scossa + RT.reazioni.frantumaScossa)
  }
  if (opts.diretto && ut && !ut.ko && hasStatus(ut, 'sospeso')) {
    ut.statuses = ut.statuses.filter(s => s.kind !== 'sospeso')
    dmg *= RT.sospesoMult
    applyUnitStatus(state, ut, { kind: 'lentezza', remaining: RT.sospesoLentezza }, attacker ?? undefined)
    reazione(state, 'Caduta', targetSide)
  }
  if (opts.diretto && scossaPreFrantuma > 0) dmg += scossaPreFrantuma * RT.scossa.perStack
  dmg = Math.round(dmg)
  let toShield = 0
  if (!opts.ignoreShield && t.shield > 0) { toShield = Math.min(t.shield, dmg); t.shield -= toShield }
  const toHp = dmg - toShield
  t.hp = Math.max(0, t.hp - toHp)
  emit(state, { kind: 'danno', side: attacker?.side, slot: attacker?.slot, targetSide, targetSlot: ut?.slot, name: opts.name ?? (frantuma ? 'Frantuma' : undefined), value: dmg })
  if (attacker) attacker.score += dmg
  if (toShield > 0 && t.mods.muroVivente && !opts.noReflect && attacker) {
    const refl = Math.round(toShield * t.mods.muroVivente)
    if (refl > 0) dealDamage(state, null, attacker.side, refl, { name: 'MuroVivente', noReflect: true })
  }
  if (opts.magieOscure && attacker && atkSide.mods.magieOscure) {
    const recoil = Math.round(dmg * atkSide.mods.magieOscure.recoil)
    if (recoil > 0) dealDamage(state, null, attacker.side, recoil, { name: 'Contraccolpo', ignoreShield: !!attacker.corrotto, noReflect: true })
  }
  return { total: dmg, toShield, toHp, frantuma }
}

export function heal(state: RtState, side: RtSideId, amount: number, source?: RtUnit): number {
  const s = sideOf(state, side)
  let n = amount * (1 + (s.mods.curaPct ?? 0))
  if (s.shield > 0 && n > 0) { n *= 1 + RT.reazioni.baluardoPct; reazione(state, 'Baluardo', side) }
  n = Math.round(n)
  const room = s.hpMax - s.hp
  const applied = Math.min(room, n)
  s.hp += applied
  const excess = n - applied
  if (excess > 0 && s.mods.curaEccessoToScudo) s.shield += Math.round(excess * s.mods.curaEccessoToScudo)
  emit(state, { kind: 'cura', side: source?.side, slot: source?.slot, targetSide: side, value: n })
  if (source) source.score += n
  // `squadraCura` da OGNI cura (spell, riga d'abilità, riga di lato), non solo dal verbo `cura`.
  if (n > 0) {
    state.queue.push({ trigger: 'squadraCura', side })
    for (const ally of alive(state, side)) state.queue.push({ trigger: 'squadraCura', side, unitKey: ally.key })
  }
  return n
}

export function addShield(state: RtState, side: RtSideId, amount: number, source?: RtUnit): number {
  const s = sideOf(state, side)
  let n = amount * (s.mods.scudoProdottoMult ?? 1)
  if (s.units.some(u => !u.ko && hasStatus(u, 'protego'))) { n *= 1 + RT.reazioni.bastionePct; reazione(state, 'Bastione', side) }
  n = Math.round(n)
  s.shield += n
  emit(state, { kind: 'scudo', side: source?.side, slot: source?.slot, targetSide: side, value: n })
  if (source) source.score += n
  return n
}

export function applySuddenDeath(state: RtState): void {
  if (state.t + 1e-9 < RT.suddenDeathAt) return
  const since = round1(state.t - RT.suddenDeathAt)
  if (!near(Math.round(since / RT.suddenDeathEvery) * RT.suddenDeathEvery, since)) return
  const pct = RT.suddenDeathBase + RT.suddenDeathGrowthPerSec * since
  for (const s of state.sides) {
    const dmg = Math.round(s.hpMax * pct)
    s.hp = Math.max(0, s.hp - dmg)
    emit(state, { kind: 'maledizione', targetSide: s.side, value: dmg })
  }
}
