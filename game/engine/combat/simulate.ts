import type {
  ActiveDuo, ActiveRelic, ActiveSynergy, BattleResult, BattleUnit, DraftedWizard, HookCtx, LogEntry, LogFlag, Side, StepSnapshot, UnitSnapshot,
} from '@/types'
import type { Rng } from '../rng'
import { BALANCE } from '@/data/constants'
import { STATUS_BY_ID } from '@/data/statuses'
import { applyBonuses, totalRegen } from '../synergy'
import { applyRelicBonuses, keywordDamageMult, registerRelicTriggers, totalRelicRegen } from '../relics'
import { teamExecute } from '../execute'
import { teamShieldConvert } from '../shieldConvert'
import { teamDarkMagic } from '../darkMagic'
import { teamAlwaysHit } from '../alwaysHit'
import { houseEffects } from '../houseEffects'
import { registerTraitTriggers } from '../traits'
import { registerSignatures } from '../signatures'
import { registerSynergyTriggers } from '../synergyTriggers'
import { createEventBus } from './eventBus'
import { canAct } from '../status'
import { EFFECT_HANDLERS } from './effects'
import { effectiveStats, resolveAction, tickStatuses } from './resolve'
import { selectSpell } from './selectSpell'
import { deadToRaise, mostWounded, selectTarget } from './targeting'
import { SPELL_BY_ID } from '@/data/spells'
import { applyTenaciaAura, cleanseOneControl } from './roleCounter'
import { stampDuoFields } from '../duoEffects/stamp'
import { maybeSpreadPoison } from '../duoEffects/spreadOnDeath'
import { maybeSpitPoison } from '../duoEffects/spitOnHeal'

export function toBattleUnits(
  team: DraftedWizard[], side: Side, synergies: ActiveSynergy[], relics: ActiveRelic[] = [], menacePct = 0, damageReduction = 0,
  ignoresTaunt = false,
): BattleUnit[] {
  const velenoUncapped = synergies.some(s => s.synergy.id === 'tossicita')
  const execute = teamExecute(team, relics, synergies)
  const shieldConvert = teamShieldConvert(team, relics, synergies)
  const darkMap = teamDarkMagic(team, relics, synergies)
  const alwaysHitIds = teamAlwaysHit(team, relics)
  const houseMap = houseEffects(team, synergies)
  return team.map(dw => {
    const synBuffed = applyBonuses(dw.stats, synergies)
    const relicBuffed = applyRelicBonuses(synBuffed, team, relics)
    const m = Math.max(0, 1 + menacePct)
    const buffed = menacePct === 0 ? relicBuffed : {
      hp: Math.round(relicBuffed.hp * m),
      atk: Math.round(relicBuffed.atk * m),
      def: Math.round(relicBuffed.def * m),
      spd: Math.round(relicBuffed.spd * m),
    }
    const startHp = dw.currentHp ?? buffed.hp
    const base: BattleUnit = {
      ...dw, side, buffedStats: buffed, maxHp: buffed.hp,
      hp: Math.min(buffed.hp, Math.max(0, startHp)),
      cooldowns: {}, statusEffects: [], alive: true, velenoUncapped, execute, shieldConvert, darkMagic: darkMap[dw.wizard.id], alwaysHit: alwaysHitIds.has(dw.wizard.id), ...houseMap[dw.wizard.id],
    }
    if (damageReduction > 0) {
      base.damageReduction = Math.max(base.damageReduction ?? 0, damageReduction)
    }
    if (ignoresTaunt) base.ignoresTaunt = true
    return base
  })
}

function totalHpPct(units: BattleUnit[]): number {
  const max = units.reduce((s, u) => s + u.maxHp, 0)
  const cur = units.reduce((s, u) => s + Math.max(0, u.hp), 0)
  return max === 0 ? 0 : cur / max
}

export function simulateBattle(
  left: DraftedWizard[],
  right: DraftedWizard[],
  rng: Rng,
  opts: {
    leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[]; leftRelics?: ActiveRelic[]; rightRelics?: ActiveRelic[]
    rightMenace?: number; rightDamageReduction?: number; rightIgnoresTaunt?: boolean
    /** Player's active Duos (computed at resolve time from the living team + relics). Player-only — never set for enemy-vs-enemy sims. */
    leftDuos?: ActiveDuo[]
    /** Node kind (normal/elite/boss) — read by some Duo stamps for scaling. */
    kind?: 'normal' | 'elite' | 'boss'
  } = {},
): BattleResult {
  const leftSyn = opts.leftSyn ?? []
  const rightSyn = opts.rightSyn ?? []
  const leftRelics = opts.leftRelics ?? []
  const rightRelics = opts.rightRelics ?? []
  const L = toBattleUnits(left, 'left', leftSyn, leftRelics)
  const R = toBattleUnits(right, 'right', rightSyn, rightRelics, opts.rightMenace ?? 0, opts.rightDamageReduction ?? 0, opts.rightIgnoresTaunt ?? false)
  stampDuoFields(L, R, opts.leftDuos ?? [], opts.kind ?? 'normal')
  // MIASMA: computed once per battle — cheaper than re-scanning leftDuos at every death site.
  const miasma = (opts.leftDuos ?? []).some(d => d.duo.id === 'miasma')
  // UNTORE: computed once per battle — same reasoning as MIASMA above.
  const untore = (opts.leftDuos ?? []).some(d => d.duo.id === 'untore')
  const regen: Record<Side, number> = {
    left: totalRegen(leftSyn) + totalRelicRegen(left, leftRelics),
    right: totalRegen(rightSyn) + totalRelicRegen(right, rightRelics),
  }
  const log: LogEntry[] = []
  // Per-step engine snapshots, kept 1:1 with `log` via pushLog. Each captures a DEEP COPY
  // of every unit's hp/alive/cooldowns/statusEffects at the instant the entry was pushed,
  // because cooldowns and statusEffects are mutated in place during the sim.
  const snapshots: StepSnapshot[] = []
  // unitKey inlined as `${side}:${id}` to avoid a circular import (replay.ts imports
  // toBattleUnits from this module, so importing unitKey back would cycle).
  const captureSnapshot = (): StepSnapshot => {
    const snap: StepSnapshot = {}
    for (const u of [...L, ...R]) {
      snap[`${u.side}:${u.wizard.id}`] = {
        hp: Math.max(0, u.hp),
        alive: u.alive,
        cooldowns: { ...u.cooldowns },
        statusEffects: u.statusEffects.map(e => ({ ...e })),
      }
    }
    return snap
  }
  const pushLog = (entry: LogEntry) => { log.push(entry); snapshots.push(captureSnapshot()) }
  // Score keyed by "side:wizard.id" to avoid merging same-id wizards on opposite teams
  const score: Record<string, number> = {}
  const kills = { left: 0, right: 0 }
  let alliesLost = 0

  const sync = (u: BattleUnit) => { if (u.hp <= 0) { u.hp = 0; u.alive = false } }
  const sideUnits = (s: Side) => (s === 'left' ? L : R).filter(u => u.alive)

  // Relic triggers dispatch through the EventBus. Each side's relics fire only for that side.
  const bus = createEventBus()
  registerRelicTriggers(bus, left, leftRelics, 'left')
  registerRelicTriggers(bus, right, rightRelics, 'right')
  registerTraitTriggers(bus, [...L, ...R])
  registerSignatures(bus, [...L, ...R])
  registerSynergyTriggers(bus, L, leftSyn, 'left')
  registerSynergyTriggers(bus, R, rightSyn, 'right')

  // Poison scaling: each side's veleno multiplier from its own relics. Poison ON a unit
  // is scaled by the OPPOSING side's mult (the side that applied it).
  const leftVelenoMult = keywordDamageMult(left, leftRelics, leftSyn, 'veleno')
  const rightVelenoMult = keywordDamageMult(right, rightRelics, rightSyn, 'veleno')

  // Apply a collected reactive hook for `unit`. Guarded by collectReactive().length
  // so a zero-listener hook draws NO rng and emits NO log line — preserving every
  // existing battle's rng stream byte-for-byte.
  const fireReactive = (hook: 'onHeal' | 'onDeath' | 'onAllyDeath' | 'onHpThreshold' | 'onTurnStart' | 'onTurnEnd', unit: BattleUnit, t: number, hpPct?: number) => {
    const ctx: HookCtx = { turn: t, actor: unit, side: unit.side, flags: [], hpPct }
    const specs = bus.collectReactive(hook, ctx)
    if (specs.length === 0) return
    for (const eff of specs) {
      const flags: LogFlag[] = []
      const r = EFFECT_HANDLERS[eff.kind]({ rng, turn: t, actor: unit, target: unit, flags }, eff)
      // Mirror the onBattleStart block: log every reactive effect as a 'Reliquia'
      // system entry so buildReplay (which reconstructs HP from logged values) stays
      // in parity with live combat for any HP-changing effect.
      pushLog({
        turn: t, actorId: unit.wizard.id, actorSide: unit.side, action: 'Reliquia',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'system', value: r.value, flags,
      })
    }
  }
  // onHpThreshold fires once per downward crossing per unit; key `${side}:${id}:${threshold}`.
  // Thresholds from both sides' relics are collected. When none exist this stays empty → no rng, no log.
  const registeredThresholds = [...leftRelics, ...rightRelics].flatMap(({ relic }) =>
    (relic.triggers ?? [])
      .filter(t => t.hook === 'onHpThreshold' && typeof t.threshold === 'number')
      .map(t => t.threshold!),
  )
  const firedThresholds = new Set<string>()
  const checkThreshold = (unit: BattleUnit, t: number) => {
    if (registeredThresholds.length === 0 || unit.maxHp <= 0) return
    const pct = Math.max(0, unit.hp) / unit.maxHp
    for (const trig of registeredThresholds) {
      const key = `${unit.side}:${unit.wizard.id}:${trig}`
      if (pct < trig && !firedThresholds.has(key)) {
        firedThresholds.add(key)
        fireReactive('onHpThreshold', unit, t, pct)
      }
    }
  }

  // onBattleStart: apply collected specs to every left unit.
  // Old order was relic→effect→unit (effect-outer, unit-inner). collectReactive gives us
  // the flat spec list in relic→trigger→effect order; apply each spec across all units
  // to preserve the exact rng draw sequence.
  {
    const ctx0 = (u: BattleUnit): HookCtx => ({ turn: 0, actor: u, side: 'left', flags: [] })
    const specs = bus.collectReactive('onBattleStart', ctx0(L[0] ?? ({} as BattleUnit)))
    for (const eff of specs) {
      for (const unit of L) {
        const flags: LogFlag[] = []
        const r = EFFECT_HANDLERS[eff.kind]({ rng, turn: 0, actor: unit, target: unit, flags }, eff)
        pushLog({
          turn: 0, actorId: unit.wizard.id, actorSide: unit.side, action: 'Reliquia',
          targetId: unit.wizard.id, targetSide: unit.side, type: 'system', value: r.value, flags,
        })
      }
    }
  }
  // onBattleStart: apply collected specs to every right unit.
  // Guarded by specsR.length so an empty enemy-relic set draws no rng and logs nothing.
  {
    const ctxR = (u: BattleUnit): HookCtx => ({ turn: 0, actor: u, side: 'right', flags: [] })
    const specsR = bus.collectReactive('onBattleStart', ctxR(R[0] ?? ({} as BattleUnit)))
    for (const eff of specsR) {
      for (const unit of R) {
        const flags: LogFlag[] = []
        const r = EFFECT_HANDLERS[eff.kind]({ rng, turn: 0, actor: unit, target: unit, flags }, eff)
        pushLog({
          turn: 0, actorId: unit.wizard.id, actorSide: unit.side, action: 'Reliquia',
          targetId: unit.wizard.id, targetSide: unit.side, type: 'system', value: r.value, flags,
        })
      }
    }
  }

  let turn = 0
  while (turn < BALANCE.combat.turnCap && sideUnits('left').length && sideUnits('right').length) {
    turn++
    applyTenaciaAura(L, R) // Supporto Tenacia: refresh controlResist for both sides
    const order = [...L, ...R].filter(u => u.alive).sort((a, b) =>
      effectiveStats(b).spd - effectiveStats(a).spd ||
      a.wizard.id.localeCompare(b.wizard.id) ||
      a.side.localeCompare(b.side),
    )
    for (const actor of order) {
      if (!actor.alive) continue
      // onTurnStart: top of each unit's turn (both sides), before it acts (fires even if
      // stunned). Gated by collectReactive().length so zero-listener = no rng/no log.
      fireReactive('onTurnStart', actor, turn)
      if (!canAct(actor)) {
        // Do NOT manually decrement here — tickStatuses at end-of-turn handles all status decrements uniformly.
        pushLog({ turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'Stordito', type: 'system', flags: ['stun'] })
        fireReactive('onTurnEnd', actor, turn)
        continue
      }
      // Supporto Purificazione: a Supporto that can act cleanses one hard-control from an
      // ally each turn (free — does not consume its spell). Part of Supporto beats Controllo.
      if (actor.wizard.role === 'Supporto') {
        const allyPool = (actor.side === 'left' ? L : R).filter(a => a.alive)
        const cleansed = cleanseOneControl(allyPool)
        if (cleansed) pushLog({ turn, actorId: actor.wizard.id, actorSide: actor.side,
          action: 'Purificazione', targetId: cleansed.wizard.id, targetSide: cleansed.side,
          type: 'system', flags: [] })
      }
      let spell = selectSpell(actor)
      if (!spell) {
        // Spell recharging: the unit waits (no action). Cooldown still ticks at end-of-turn.
        pushLog({ turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'Ricarica', type: 'system', flags: ['wait'] })
        fireReactive('onTurnEnd', actor, turn)
        continue
      }
      const allies = actor.side === 'left' ? L : R
      const enemies = actor.side === 'left' ? R : L
      // Revive spell: raise a fallen ally. With no one to raise it fizzles into a basic
      // attack so the caster's turn isn't wasted (and its cooldown is NOT spent).
      let fallen: BattleUnit | undefined
      if (spell.revive != null) {
        fallen = deadToRaise(allies)
        if (!fallen) spell = SPELL_BY_ID['base_attack']!
      }
      const healIntent = spell.type === 'Cura' && spell.revive == null
      const target = selectTarget(actor, allies, enemies, spell)
      if (!target && !fallen) { fireReactive('onTurnEnd', actor, turn); continue }
      const realTarget = fallen
        ? fallen
        : healIntent
          ? (mostWounded(allies.filter(a => a.alive)) ?? actor)
          : (spell.type === 'Difesa' ? actor : target!)
      const entry = resolveAction(rng, turn, actor, realTarget, spell, allies, bus)
      pushLog(entry)
      // onHit: after an actor's spell CONNECTS against an ENEMY target. A dodged or
      // Protego-negated attack did not land, so its on-hit riders (poison/stun/weaken
      // added by traits/signatures) must NOT fire — "dodged but still poisoned" makes no
      // sense, and mirrors how a spell's own rider is skipped on a dodge (resolve.ts).
      const connected = !entry.flags.includes('dodge') && !entry.flags.includes('block')
      if (realTarget.side !== actor.side && connected) {
        const hitCtx: HookCtx = { turn, actor, target: realTarget, side: actor.side, flags: [] }
        for (const eff of bus.collectReactive('onHit', hitCtx)) {
          EFFECT_HANDLERS[eff.kind]({ rng, turn, actor, target: realTarget, flags: hitCtx.flags }, eff)
        }
      }
      // onHeal: after a heal resolves on any target.
      if (entry.flags.includes('heal')) {
        fireReactive('onHeal', realTarget, turn)
        // UNTORE: any heal landing on a player ally spits 1 veleno dose onto a random living
        // enemy (deterministic single rng.pick; no-op if none left). Credited to the healer
        // (the acting caster), not the healed unit — mirrors how score credits `actor`.
        if (untore && realTarget.side === 'left') {
          maybeSpitPoison(R, rng, `${actor.side}:${actor.wizard.id}`)
        }
      }
      if (entry.value) {
        const scoreKey = `${actor.side}:${actor.wizard.id}`
        score[scoreKey] = (score[scoreKey] ?? 0) + entry.value
      }
      sync(realTarget)
      if (!realTarget.alive && entry.flags.includes('heal') === false) {
        pushLog({
          turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'KO',
          targetId: realTarget.wizard.id, targetSide: realTarget.side, type: 'system', flags: ['kill'],
        })
      }
      // onDeath / onAllyDeath: after sync, when any unit just died.
      if (!realTarget.alive) {
        // A kill: the victim is always an enemy of its killer here → credit the opposite side.
        // Assumption: this holds only because no spell/trait/signature self-damages or
        // self-applies a DoT (friendly fire is structurally impossible, per effects.ts guards).
        // If a self-damaging/self-poisoning effect is ever added, this would mis-credit the
        // enemy and must be revisited.
        kills[realTarget.side === 'left' ? 'right' : 'left']++
        if (realTarget.side === 'left') alliesLost++
        fireReactive('onDeath', realTarget, turn)
        const allyPool = realTarget.side === 'left' ? L : R
        for (const ally of allyPool) {
          if (ally.alive && ally !== realTarget) fireReactive('onAllyDeath', ally, turn)
        }
        // MIASMA: after the death is fully resolved, jump the dead enemy's veleno stacks
        // to one random living enemy (deterministic single rng.pick; no-op if none left).
        if (miasma && realTarget.side === 'right') maybeSpreadPoison(realTarget, R, rng)
      }
      // Recoil can kill the ACTOR via its own dark spell — sync + KO-log + onDeath for the actor too.
      sync(actor)
      if (!actor.alive) {
        pushLog({
          turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'KO',
          targetId: actor.wizard.id, targetSide: actor.side, type: 'system', flags: ['kill'],
        })
        if (actor.side === 'left') alliesLost++
        fireReactive('onDeath', actor, turn)
        const allyPool = actor.side === 'left' ? L : R
        for (const ally of allyPool) {
          if (ally.alive && ally !== actor) fireReactive('onAllyDeath', ally, turn)
        }
        // MIASMA: recoil self-kill can drop an enemy caster too.
        if (miasma && actor.side === 'right') maybeSpreadPoison(actor, R, rng)
      }
      // onHpThreshold: HP of the target changed this action.
      checkThreshold(realTarget, turn)
      // onHpThreshold: recoil may have dropped the actor below a threshold this action.
      checkThreshold(actor, turn)
      // onTurnEnd: after an actor finishes acting.
      fireReactive('onTurnEnd', actor, turn)
    }
    // end-of-turn: dot/cooldown tick + regen
    for (const u of [...L, ...R]) {
      if (!u.alive) continue
      const dots = tickStatuses(turn, u, { velenoMult: u.side === 'left' ? rightVelenoMult : leftVelenoMult })
      for (const d of dots) {
        pushLog(d)
        // Credit the poisoner: a DoT tick attributed cross-side (caster != victim) counts toward
        // the caster's MVP score, so a veleno/burn build is scored for the damage it deals.
        if (d.flags.includes('dot') && (d.value ?? 0) > 0 && d.actorSide !== d.targetSide) {
          const dk = `${d.actorSide}:${d.actorId}`
          score[dk] = (score[dk] ?? 0) + (d.value ?? 0)
        }
      }
      sync(u)
      // onDeath / onAllyDeath when a dot tick kills any unit.
      if (!u.alive) {
        // DoT kill: poison/burn on `u` was applied by u's enemy → credit the opposite side.
        // Assumption: relies on the same self-damage/self-DoT impossibility noted above
        // (effects.ts guards against friendly fire) — revisit if that ever changes.
        kills[u.side === 'left' ? 'right' : 'left']++
        if (u.side === 'left') alliesLost++
        fireReactive('onDeath', u, turn)
        const allyPool = u.side === 'left' ? L : R
        for (const ally of allyPool) {
          if (ally.alive && ally !== u) fireReactive('onAllyDeath', ally, turn)
        }
        // MIASMA: a DoT-tick death (often veleno itself) also spreads — this operates on the
        // already-resolved death and does not recurse into any further deaths it might cause.
        if (miasma && u.side === 'right') maybeSpreadPoison(u, R, rng)
      }
      if (u.alive && regen[u.side] > 0) {
        const before = u.hp
        u.hp = Math.min(u.maxHp, u.hp + regen[u.side])
        const healed = u.hp - before
        // Overflow → shield: when the regen tick exceeds the HP cap and the unit has
        // shieldConvert (from egida-tassorosso / Bastione), convert excess to a refresh shield.
        const overflow = (before + regen[u.side]) - u.maxHp
        if (overflow > 0 && u.shieldConvert) {
          const amount = Math.round(overflow * u.shieldConvert.rate)
          if (amount > 0) {
            const dur = STATUS_BY_ID['shield']!.defaultDuration
            u.statusEffects = u.statusEffects.filter(e => !(e.statusId === 'shield' && e.sourceId === 'overflow'))
            u.statusEffects.push({ kind: 'shield', statusId: 'shield', remaining: dur, stacks: 1, sourceId: 'overflow', absorbLeft: amount })
          }
        }
        // Log the actual healed amount (0 when already at full HP) so buildReplay —
        // which reconstructs HP from log deltas — reflects regen and stays in sync.
        if (healed > 0) {
          pushLog({
            turn, actorId: u.wizard.id, actorSide: u.side, action: 'Rigenera',
            targetId: u.wizard.id, targetSide: u.side, type: 'Cura', value: healed, flags: ['heal'],
          })
        }
      }
      // Anti-stall fatigue: escalating TRUE damage past fatigueStart, ignoring
      // def/shields/regen so defensive stalemates always converge before turnCap.
      if (u.alive && turn > BALANCE.combat.fatigueStart) {
        const dmg = Math.round(u.maxHp * BALANCE.combat.fatiguePctStep * (turn - BALANCE.combat.fatigueStart))
        if (dmg > 0) {
          u.hp = Math.max(0, u.hp - dmg)
          pushLog({
            turn, actorId: u.wizard.id, actorSide: u.side, action: 'Fatica',
            targetId: u.wizard.id, targetSide: u.side, type: 'system', value: dmg, flags: ['dot'],
          })
          sync(u)
          if (!u.alive) {
            fireReactive('onDeath', u, turn)
            if (u.side === 'left') alliesLost++
            const allyPool = u.side === 'left' ? L : R
            for (const ally of allyPool) {
              if (ally.alive && ally !== u) fireReactive('onAllyDeath', ally, turn)
            }
            // MIASMA: fatigue (anti-stall) kills also spread.
            if (miasma && u.side === 'right') maybeSpreadPoison(u, R, rng)
          }
        }
      }
      // onHpThreshold after dot + regen settle this unit's HP for the turn.
      if (u.alive) checkThreshold(u, turn)
    }
  }

  const leftAlive = sideUnits('left').length
  const rightAlive = sideUnits('right').length
  let winner: Side
  if (leftAlive && !rightAlive) winner = 'left'
  else if (rightAlive && !leftAlive) winner = 'right'
  else winner = totalHpPct(L) >= totalHpPct(R) ? 'left' : 'right'
  const timedOut = leftAlive > 0 && rightAlive > 0 // both sides survived to turnCap

  const snapshot: UnitSnapshot[] = [...L, ...R].map(u => ({
    id: u.wizard.id, side: u.side, hp: Math.max(0, u.hp), maxHp: u.maxHp, alive: u.alive,
  }))
  const mvpScoreKey = Object.entries(score).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
  // Strip "side:" prefix to get plain wizard.id
  const mvpId = mvpScoreKey
    ? mvpScoreKey.split(':').slice(1).join(':')
    : (winner === 'left' ? L[0]!.wizard.id : R[0]!.wizard.id)

  return { winner, turns: turn, log, mvpId, finalSnapshot: snapshot, snapshots, timedOut, kills, alliesLost }
}
