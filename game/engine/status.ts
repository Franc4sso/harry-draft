import type { ActionGate, ActiveEffect, BattleUnit, LogEntry, Side, Stat, Stats } from '@/types'
import { STATUS_BY_ID } from '@/data/statuses'
import { MAX_STAT_STACKS } from '@/data/constants'

/** Shared cap on cumulative stat buff/debuff instances (per unit, per stat) — applies to
 *  both the statusId path (applyStatus, via StatusDef.maxStacks) and the inline-effect
 *  path (applyInlineEffect) so neither can stack permanent stat mods without limit.
 *  Defined in data/constants.ts (data/ can't import game/engine/, and data/statuses.ts
 *  needs the same constant for its StatusDef.maxStacks literals); re-exported here since
 *  this is where engine code has historically imported it from. */
export { MAX_STAT_STACKS }

/** statMod for an active effect: prefer its StatusDef, fall back to legacy inline fields. */
function statModOf(e: ActiveEffect): { stat: Stat; delta: number; pct: boolean } | null {
  if (e.statusId) {
    const def = STATUS_BY_ID[e.statusId]
    if (def?.statMod) {
      const sign = def.kind === 'debuff' ? -1 : 1
      // Prefer the per-instance amount (spell-mastery scaled) over the StatusDef base.
      // For unscaled applications applyStatus stores the base amount, so this is identical.
      const amount = e.amount ?? def.statMod.amount
      return { stat: def.statMod.stat, delta: sign * amount, pct: def.statMod.pct ?? false }
    }
    return null
  }
  if ((e.kind === 'buff' || e.kind === 'debuff') && e.stat && e.amount) {
    return { stat: e.stat, delta: e.kind === 'buff' ? e.amount : -e.amount, pct: false }
  }
  return null
}

/** Apply a unit's active status stat-mods to a base Stats block. Pure — used both by
 *  `effectiveStats` (live combat) and by the replay to derive per-frame effective stats
 *  (e.g. the InitiativeBar's speed order must reflect mid-combat spd buffs/debuffs, not the
 *  start-of-battle value). Flat mods first, then pct; each stat floored at 1. */
export function statsWithMods(base: Stats, effects: ActiveEffect[]): Stats {
  const s: Stats = { ...base }
  const mods = effects
    .map(statModOf)
    .filter((m): m is { stat: Stat; delta: number; pct: boolean } => m !== null)
  // deterministic: flat mods first, then pct; stable by nothing else needed (commutative sums)
  for (const m of mods.filter(m => !m.pct)) s[m.stat] = Math.max(1, s[m.stat] + m.delta)
  for (const m of mods.filter(m => m.pct)) s[m.stat] = Math.max(1, Math.round(s[m.stat] * (1 + m.delta / 100)))
  return s
}

export function effectiveStats(unit: BattleUnit): Stats {
  return statsWithMods(unit.buffedStats, unit.statusEffects)
}

export function applyStatus(
  unit: BattleUnit, statusId: string,
  opts: { duration?: number; sourceId?: string; maxStacks?: number; tickAmount?: number; magMult?: number } = {},
): void {
  const def = STATUS_BY_ID[statusId]
  if (!def) return
  const remaining = opts.duration ?? def.defaultDuration
  // Aumento Magia scaling: the caller's spell-mastery multiplier scales the applied
  // magnitude (statMod / DoT tick / shield absorb), which otherwise lives read-live in
  // the StatusDef. mm=1 (default) leaves every stored value byte-identical to before.
  const mm = opts.magMult ?? 1
  // The DoT per-tick override: an explicit per-spell tick (burn) or, absent that, the def's
  // flat tick scaled by mastery (veleno). Composes both: round(tickAmount * mm). Stored in
  // the effect's `amount` (the field DoTs read in tickStatuses).
  const scaledTick = opts.tickAmount != null
    ? Math.round(opts.tickAmount * mm)
    : (mm !== 1 && def.tickDamage != null ? Math.round(def.tickDamage * mm) : undefined)
  const existing = unit.statusEffects.filter(e => e.statusId === statusId)
  if (existing.length > 0) {
    if (def.stack === 'ignore') return
    if (def.stack === 'refresh') { existing[0]!.remaining = remaining; return }
    if (def.stack === 'extend') { existing[0]!.remaining += remaining; return }
    if (def.stack === 'accumulate') {
      const cur = existing[0]!
      const cap = opts.maxStacks ?? def.maxStacks ?? Infinity
      cur.stacks = Math.min(cap, (cur.stacks ?? 1) + 1)
      cur.remaining = remaining
      // A re-ignite may carry a higher per-tick amount (e.g. incendio then fiendfyre): keep the
      // strongest so the burn's damage never drops when refreshed by a weaker spell.
      if (scaledTick != null) cur.amount = Math.max(cur.amount ?? 0, scaledTick)
      return
    }
    if (def.stack === 'stack' && def.maxStacks != null && existing.length >= def.maxStacks) return
  }
  unit.statusEffects.push({
    kind: def.kind, statusId, remaining, stacks: 1, sourceId: opts.sourceId,
    // `amount` holds EITHER the DoT per-tick (burn's per-spell tick, or veleno scaled by
    // mastery) OR a stat buff/debuff magnitude — a status is one or the other, never both.
    stat: def.statMod?.stat,
    amount: scaledTick ?? (def.statMod ? Math.round(def.statMod.amount * mm) : undefined),
    absorbLeft: def.absorb != null ? Math.round(def.absorb * mm) : undefined,
  })
}

/** Apply a HOSTILE status from `actor` to `target`, extending its duration by the actor's
 *  Tassorosso Tenacia bonus (`statusDurationBonus`). Use this at every site where a unit
 *  inflicts a debuff/DoT/control on an enemy so the Trio bonus lands uniformly.
 *  SCOPE (per fase 2): oggi è routato SOLO dal `status` handler in effects.ts (gated
 *  `eff.target==='enemy'`). Il veleno propagato dai Duo (spreadOnDeath/spitOnHeal) usa ancora
 *  `applyStatus` raw → Tenacia NON lo allunga; ma il veleno è permanente (remaining congelato),
 *  quindi +1 sarebbe comunque muto. Se un futuro effetto hostile deve rispettare Tenacia,
 *  routarlo qui. NB: sul controllo dimezzato dal Supporto (Tenacia avversaria) il +1 si somma
 *  DOPO il dimezzamento (deterministico, offset parziale) — tenerne conto in un balance pass. */
export function applyHostileStatus(
  actor: BattleUnit, target: BattleUnit, statusId: string,
  opts: { duration?: number; sourceId?: string; maxStacks?: number; tickAmount?: number; magMult?: number } = {},
): void {
  const def = STATUS_BY_ID[statusId]
  if (!def) return
  const base = opts.duration ?? def.defaultDuration
  applyStatus(target, statusId, { ...opts, duration: base + (actor.statusDurationBonus ?? 0) })
}

export function applyInlineEffect(
  unit: BattleUnit,
  eff: { kind: ActiveEffect['kind']; stat?: Stat; amount?: number; duration?: number },
  opts: { sourceId?: string } = {},
): void {
  // Inline stat buffs/debuffs are permanent (see tickStatuses) and, like the statusId
  // 'stack' policy, must be bounded — otherwise on-hit/on-turn-start signature and
  // Controllo-spell effects stack forever. Cap cumulative instances of the same
  // (kind, stat) at MAX_STAT_STACKS; once at cap, further applications are no-ops.
  if ((eff.kind === 'buff' || eff.kind === 'debuff') && eff.stat) {
    const existing = unit.statusEffects.filter(e => !e.statusId && e.kind === eff.kind && e.stat === eff.stat)
    if (existing.length >= MAX_STAT_STACKS) return
  }
  unit.statusEffects.push({
    kind: eff.kind, stat: eff.stat, amount: eff.amount,
    remaining: eff.duration ?? 1, sourceId: opts.sourceId,
  })
}

export function tickStatuses(turn: number, unit: BattleUnit, opts: { velenoMult?: number } = {}): LogEntry[] {
  const logs: LogEntry[] = []
  for (const e of unit.statusEffects) {
    const def = e.statusId ? STATUS_BY_ID[e.statusId] : undefined
    // For DoTs, a per-instance `amount` (burn's per-spell tick, or veleno scaled by mastery)
    // overrides the def's flat tickDamage; other statuses fall back to the def value.
    const baseTick = e.kind === 'dot' ? (e.amount ?? def?.tickDamage) : def?.tickDamage
    const tickHeal = def?.tickHeal
    if (baseTick != null) {
      const stacks = e.stacks ?? 1
      const isVeleno = def?.keywords?.includes('veleno') ?? false
      const flat = baseTick * stacks * (isVeleno ? (opts.velenoMult ?? 1) : 1)
      const pctStacks = def?.tickStackCapForPct != null ? Math.min(stacks, def.tickStackCapForPct) : stacks
      const pct = def?.tickPctMaxHp ? pctStacks * def.tickPctMaxHp * unit.maxHp : 0
      // CANCRENA (Duo Combos): veleno-only amp on low-HP poisoned units. `poisonAmp` is only
      // ever stamped on ENEMY (right) units by stampDuoFields — never on player units — so this
      // read-only check can't cause friendly fire even though it lives in the shared tick path.
      const cancrena = isVeleno && unit.poisonAmp != null && unit.hp / unit.maxHp < unit.poisonAmp.threshold
      const total = Math.round((flat + pct) * (cancrena ? unit.poisonAmp!.mult : 1))
      unit.hp -= total
      // Attribute the tick to the CASTER (sourceId "side:id") so poison/burn damage credits the
      // poisoner — not the victim — for MVP and the log. Fall back to the bearer if source-less.
      const ci = e.sourceId?.indexOf(':') ?? -1
      const srcSide = ci > 0 ? (e.sourceId!.slice(0, ci) as Side) : unit.side
      const srcId = ci > 0 ? e.sourceId!.slice(ci + 1) : unit.wizard.id
      logs.push({ turn, actorId: srcId, actorSide: srcSide, action: def?.name ?? 'Veleno',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'Controllo', value: total,
        flags: cancrena ? ['dot', 'duo'] : ['dot'],
        // Traccia: solo quando l'amplificazione si è applicata sul serio (non basta che il
        // Duo sia attivo — il nemico deve essere sotto soglia).
        ...(cancrena ? { duoId: 'cancrena' } : {}) })
    }
    if (tickHeal && unit.hp > 0 && !unit.corrotto) {
      // Corrotto (P5): mai curato — gate speculare a simulate.ts team-regen.
      // Never regen-heal a dead unit. Gate on LIVE hp, not `unit.alive`: within this same tick
      // pass a preceding DoT (veleno/burn) may have already dropped hp <= 0, but `unit.alive` is
      // only synced by the caller AFTER tickStatuses returns — so a stale-`alive` check let a unit
      // that just took lethal poison heal itself back above 0 in the same tick and keep fighting
      // ("dead mage still attacks"). Reading hp directly makes the death land this tick.
      const before = unit.hp
      unit.hp = Math.min(unit.maxHp, before + tickHeal)
      const overflow = (before + tickHeal) - unit.maxHp   // > 0 only when the tick exceeds the cap
      if (overflow > 0 && unit.shieldConvert) {
        const amount = Math.round(overflow * unit.shieldConvert.rate)
        if (amount > 0) {
          // Refresh, not accumulate: replace any prior conversion shield (shield status is stack:'refresh').
          const dur = STATUS_BY_ID['shield']!.defaultDuration
          unit.statusEffects = unit.statusEffects.filter(e => !(e.statusId === 'shield' && e.sourceId === 'overflow'))
          unit.statusEffects.push({ kind: 'shield', statusId: 'shield', remaining: dur, stacks: 1, sourceId: 'overflow', absorbLeft: amount })
        }
      }
      logs.push({ turn, actorId: unit.wizard.id, actorSide: unit.side, action: def?.name ?? 'Rigenerazione',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'Cura', value: tickHeal, flags: ['heal'] })
    }
    // Stat buffs/debuffs are permanent (last the whole battle): never decrement their
    // remaining counter. Statuses flagged `permanent` (veleno) also never decrement — they
    // tick every turn until the target dies or combat ends. All other kinds (control, dot,
    // regen, shield, ward) keep their normal timed expiry below.
    if (e.kind !== 'buff' && e.kind !== 'debuff' && !def?.permanent) e.remaining -= 1
  }
  unit.statusEffects = unit.statusEffects.filter(e => e.remaining > 0)
  for (const id of Object.keys(unit.cooldowns)) {
    unit.cooldowns[id] = Math.max(0, (unit.cooldowns[id] ?? 0) - 1)
  }
  return logs
}

function preventsOf(e: ActiveEffect): ActionGate[] {
  if (e.statusId) return STATUS_BY_ID[e.statusId]?.prevents ?? []
  return e.kind === 'stun' ? ['action'] : []
}

function gated(unit: BattleUnit, gate: ActionGate): boolean {
  return unit.statusEffects.some(e => preventsOf(e).includes(gate))
}

export function canAct(unit: BattleUnit): boolean { return !gated(unit, 'action') }
export function canCastSpell(unit: BattleUnit): boolean { return canAct(unit) && !gated(unit, 'spell') }
export function canAttack(unit: BattleUnit): boolean { return canAct(unit) && !gated(unit, 'attack') }

export function absorbDamage(unit: BattleUnit, dmg: number): number {
  let remaining = dmg
  // Drain soonest-expiring shield first; tiebreak on sourceId for deterministic ordering.
  const shields = unit.statusEffects
    .filter(e => e.statusId === 'shield' && (e.absorbLeft ?? 0) > 0)
    .sort((a, b) => a.remaining - b.remaining || (a.sourceId ?? '').localeCompare(b.sourceId ?? ''))
  for (const s of shields) {
    if (remaining <= 0) break
    const left = s.absorbLeft ?? 0
    const used = Math.min(left, remaining)
    s.absorbLeft = left - used
    remaining -= used
  }
  return remaining
}

/** Consume one Protego charge on `unit`. Returns true if a charge was spent
 *  (and the ward removed when it hits 0). */
export function consumeWard(unit: BattleUnit): boolean {
  const ward = unit.statusEffects.find(e => e.statusId === 'protego' && (e.absorbLeft ?? 0) > 0)
  if (!ward) return false
  ward.absorbLeft = (ward.absorbLeft ?? 0) - 1
  if ((ward.absorbLeft ?? 0) <= 0) {
    unit.statusEffects = unit.statusEffects.filter(e => e !== ward)
  }
  return true
}
