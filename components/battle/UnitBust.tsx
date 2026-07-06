'use client'
import { memo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Flame, Zap, Shield, ShieldCheck, Sword, Snowflake, Ban, Swords, ArrowUp, ArrowDown, Heart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect, StatusKind } from '@/types'
import { STATUS_BY_ID } from '@/data/statuses'
import { RarityFrame } from '@/components/ui/RarityFrame'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { HpBar } from './HpBar'
import { StatBar } from './StatBar'
import type { FloatDescriptor, FloatTone } from './damageFloat'
import { cn } from '@/lib/theme'

const FLOAT_CLASS: Record<FloatTone, string> = {
  damage: 'text-rose-300',
  crit: 'text-amber-300 text-xl font-bold drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]',
  heal: 'text-emerald-300',
  dodge: 'text-white/60 text-[11px] uppercase tracking-wider',
}

/** StatusKind → icon + color for the status row. */
const STATUS_ICON: Record<StatusKind, LucideIcon> = {
  dot: Flame,
  stun: Zap,
  freeze: Snowflake,
  shield: Shield,
  buff: ArrowUp,
  debuff: ArrowDown,
  silence: Ban,
  disarm: Swords,
  regen: Heart,
  ward: ShieldCheck,
}
// Each control kind gets a clearly distinct hue (disarm was amber → collided with stun
// yellow and the crit/level gold; now fuchsia). Freeze/shield split cyan vs blue.
const STATUS_CLASS: Record<StatusKind, string> = {
  dot: 'text-orange-400',
  stun: 'text-yellow-300',
  freeze: 'text-cyan-300',
  shield: 'text-blue-400',
  buff: 'text-emerald-400',
  debuff: 'text-rose-400',
  silence: 'text-violet-400',
  disarm: 'text-fuchsia-400',
  regen: 'text-emerald-300',
  ward: 'text-indigo-300',
}

/** Control kinds get a full-bust overlay so a skipped/limited turn reads instantly. */
const CONTROL_OVERLAY: Record<string, { label: string; cls: string }> = {
  stun:    { label: 'Stordito',   cls: 'bg-yellow-300/25 ring-2 ring-yellow-300/60' },
  freeze:  { label: 'Congelato',  cls: 'bg-cyan-300/25 ring-2 ring-cyan-300/60' },
  silence: { label: 'Silenziato', cls: 'bg-violet-400/20 ring-2 ring-violet-400/55' },
  disarm:  { label: 'Disarmato',  cls: 'bg-fuchsia-400/20 ring-2 ring-fuchsia-400/55' },
}

const STAT_LABEL: Record<string, string> = { hp: 'HP', atk: 'atk', def: 'def', spd: 'spd' }
const ROLE_LABEL: Record<string, string> = { Tank: 'Prov.', Attaccante: 'Att.', Controllo: 'Contr.', Supporto: 'Sup.' }
const ROLE_ICON: Record<string, LucideIcon> = { Tank: Shield, Attaccante: Sword, Controllo: Zap, Supporto: Heart }

/** Italian "N turno/turni" with correct singular/plural. */
function turnsLabel(n: number): string {
  return n === 1 ? '1 turno' : `${n} turni`
}

/**
 * Full Italian description of one active effect, used as the native `title`
 * (hover/tap detail), e.g. `Veleno: -6 HP/turno, 2 turni`,
 * `Potenziamento atk +10, 2 turni`, `Stordito: 1 turno`.
 */
function describeEffect(e: ActiveEffect): string {
  const turns = turnsLabel(e.remaining)
  const stat = e.stat ? STAT_LABEL[e.stat] ?? e.stat : ''
  switch (e.kind) {
    case 'dot': {
      const doses = ` ×${e.stacks ?? 1}`
      return `Veleno${doses}: -${dotTickDamage(e)} HP/turno`
    }
    case 'regen':
      return `Rigenerazione: +${e.amount ?? 0} HP/turno, ${turns}`
    case 'stun':
      return `Stordito: ${turns}`
    case 'freeze':
      return `Congelato: ${turns}`
    case 'silence':
      return `Silenziato: ${turns}`
    case 'disarm':
      return `Disarmato: ${turns}`
    case 'shield':
      return e.absorbLeft != null
        ? `Scudo: assorbe ${e.absorbLeft}`
        : `Scudo: ${turns}`
    case 'buff':
      return `Potenziamento ${stat} ${magnitudeLabel(e)}, ${turns}`
    case 'debuff':
      return `Indebolimento ${stat} ${magnitudeLabel(e)}, ${turns}`
    case 'ward':
      return 'Protetto: annulla la prossima magia nemica'
    default:
      return turns
  }
}

/** True if this effect's statMod is percentage-based. */
function isPct(e: ActiveEffect): boolean {
  return !!(e.statusId && STATUS_BY_ID[e.statusId]?.statMod?.pct)
}

/** Magnitude label for a stat debuff/buff pill: '-25%' or '+10'. */
function magnitudeLabel(e: ActiveEffect): string {
  const amt = e.amount ?? 0
  const sign = e.kind === 'debuff' ? '-' : '+'
  return isPct(e) ? `${sign}${amt}%` : `${sign}${amt}`
}

/** The number to show beside a status icon: shield prefers absorbLeft; an accumulating
 *  dot (veleno) shows its DOSE count (stacks), which is what grows — its `remaining` is
 *  frozen because veleno is permanent. Everything else shows turns remaining. */
function effectCount(e: ActiveEffect): number {
  if (e.kind === 'shield' && e.absorbLeft != null) return e.absorbLeft
  // A dot (veleno) shows its DOSE count, which starts at 1 and climbs — never `remaining`
  // (frozen at 2 because veleno is permanent). The old `stacks > 1` guard made the FIRST dose
  // fall through to remaining (showing "2"), so the pill never started at 1 and grew.
  if (e.kind === 'dot') return e.stacks ?? 1
  return e.remaining
}

/** Per-turn damage of a dot effect for the tooltip. Veleno's damage lives on the status DEF
 *  (tickDamage, scaled by stacks) — the effect instance carries no `amount`, so reading `e.amount`
 *  produced "-0 HP/turno". Mirrors the engine's flat term in tickStatuses (game/engine/status.ts). */
function dotTickDamage(e: ActiveEffect): number {
  const def = e.statusId ? STATUS_BY_ID[e.statusId] : undefined
  const base = def?.tickDamage ?? e.amount ?? 0
  return base * (e.stacks ?? 1)
}

type LiveStat = 'atk' | 'def' | 'spd'
type StatTriple = Record<LiveStat, number>

/** Mirrors the engine's effectiveStats `statModOf` (game/engine/status.ts) for display. */
function uiStatMod(e: ActiveEffect): { stat: LiveStat; delta: number; pct: boolean } | null {
  const ok = (s: string): s is LiveStat => s === 'atk' || s === 'def' || s === 'spd'
  if (e.statusId) {
    const def = STATUS_BY_ID[e.statusId]
    if (def?.statMod && ok(def.statMod.stat)) {
      const sign = def.kind === 'debuff' ? -1 : 1
      return { stat: def.statMod.stat, delta: sign * def.statMod.amount, pct: def.statMod.pct ?? false }
    }
    return null
  }
  if ((e.kind === 'buff' || e.kind === 'debuff') && e.stat && e.amount && ok(e.stat)) {
    return { stat: e.stat, delta: e.kind === 'buff' ? e.amount : -e.amount, pct: false }
  }
  return null
}

/** Effective atk/def/spd for the CURRENT frame — same math as the engine's effectiveStats
 *  (flat mods first, then pct, floor at 1), so the bars reflect live buffs/debuffs. */
function liveStats(base: StatTriple, effects: ActiveEffect[]): StatTriple {
  const s: StatTriple = { ...base }
  const mods = effects.map(uiStatMod).filter((m): m is { stat: LiveStat; delta: number; pct: boolean } => m !== null)
  for (const m of mods) if (!m.pct) s[m.stat] = Math.max(1, s[m.stat] + m.delta)
  for (const m of mods) if (m.pct) s[m.stat] = Math.max(1, Math.round(s[m.stat] * (1 + m.delta / 100)))
  return s
}

/**
 * Battle bust: rarity frame + face-cropped portrait + house crest + HP, with an
 * acting (green) / targeted (red) aura, status icons, KO tombstone, and a
 * floating damage/heal number. Reduced-motion → static final state.
 */
export const UnitBust = memo(function UnitBust({
  unit, hp, acting, targeted, mirrored, boss, compact, float, floatKey, effects = [], cooldown = 0, level,
}: {
  unit: ReplayUnit
  hp: number
  acting?: boolean
  targeted?: boolean
  mirrored?: boolean
  /** Ominous boss treatment (bigger bust + arcane aura), e.g. a lone final-boss enemy. */
  boss?: boolean
  /** Compact bust: smaller + hides stat bars / cooldown so full teams (5v5) fit without scroll. */
  compact?: boolean
  float?: FloatDescriptor | null
  floatKey?: number | string
  /** Real active status effects on this unit for the current frame. */
  effects?: ActiveEffect[]
  /** Turns remaining on this unit's primary spell (0 = ready). */
  cooldown?: number
  /** Displayed level. Players pass their own level; enemies pass a derived one.
   *  Falls back to the replay unit's own level (1 for enemies). */
  level?: number
}) {
  const shownLevel = level ?? unit.level ?? 1
  const reduce = useReducedMotion()
  const dead = hp <= 0
  const bossAura = boss ? '0 0 34px rgba(124,58,237,0.55), 0 0 12px rgba(124,58,237,0.4)' : undefined
  const aura = acting ? '0 0 22px rgba(124,252,155,0.55)' : targeted ? '0 0 22px rgba(255,107,107,0.6)' : bossAura
  const impact = targeted && !!float
  const isCrit = float?.tone === 'crit'
  // Live effective stats for THIS frame (reflect active buffs/debuffs) — so the bars
  // match the damage the unit actually deals/takes now.
  const live = liveStats({ atk: unit.atk, def: unit.def, spd: unit.spd }, effects)

  return (
    <motion.div
      data-testid="battle-unit"
      data-unit-key={unit.key}
      data-dead={dead || undefined}
      data-acting={acting || undefined}
      animate={reduce ? {} : {
        // Impact = squash & stretch (no positional shake). Otherwise: acting lift, targeted lean.
        scaleX: impact ? (isCrit ? [1, 1.15, 0.95, 1.03, 1] : [1, 1.1, 0.97, 1]) : (acting ? 1.04 : 1),
        scaleY: impact ? (isCrit ? [1, 0.85, 1.06, 0.98, 1] : [1, 0.9, 1.04, 1]) : (acting ? 1.04 : 1),
        x: impact ? 0 : (targeted ? (mirrored ? -4 : 4) : 0),
      }}
      transition={{
        type: 'spring', stiffness: 360, damping: 22,
        scaleX: impact ? { type: 'tween', duration: isCrit ? 0.44 : 0.32, ease: [0.22, 1, 0.36, 1] } : { type: 'spring', stiffness: 360, damping: 22 },
        scaleY: impact ? { type: 'tween', duration: isCrit ? 0.44 : 0.32, ease: [0.22, 1, 0.36, 1] } : { type: 'spring', stiffness: 360, damping: 22 },
        x: { type: 'spring', stiffness: 360, damping: 22 },
      }}
      className={cn('relative rounded-2xl border bg-[rgba(20,16,33,0.45)] backdrop-blur-sm',
        compact && !boss ? 'p-1' : 'p-1.5',
        boss ? 'w-32 sm:w-40 border-[#7c3aed]/40' : compact ? 'w-[4.75rem] sm:w-24 border-[#C9A24B]/15' : 'w-28 sm:w-32 border-[#C9A24B]/15',
        mirrored && 'text-right')}
      style={{ boxShadow: aura, filter: dead ? 'grayscale(0.9) brightness(0.72)' : 'none', transition: 'filter 0.55s ease' }}
    >
      <RarityFrame tier={unit.tier}>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl">
          <PortraitImage id={unit.id} house={unit.house} alt={unit.name} variant="bust" />
          {dead && (
            <motion.div
              className="absolute inset-0 grid place-items-center bg-black/45"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              <span className="rounded border border-rose-400/50 bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">
                Morto
              </span>
            </motion.div>
          )}
        </div>
      </RarityFrame>

      {targeted && !dead && (
        // Camera-focus reticle framing the CHOSEN target — a crisp "this is who's hit now"
        // read that the diffuse red aura alone can't give. Corner brackets, no positional shake.
        <div
          data-testid="target-reticle"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 aspect-[3/4] rounded-xl motion-safe:animate-pulse"
        >
          <span className="absolute left-1 top-1 h-3 w-3 rounded-tl-sm border-l-2 border-t-2 border-rose-400/90 drop-shadow-[0_0_4px_rgba(255,107,107,0.7)]" />
          <span className="absolute right-1 top-1 h-3 w-3 rounded-tr-sm border-r-2 border-t-2 border-rose-400/90 drop-shadow-[0_0_4px_rgba(255,107,107,0.7)]" />
          <span className="absolute bottom-1 left-1 h-3 w-3 rounded-bl-sm border-b-2 border-l-2 border-rose-400/90 drop-shadow-[0_0_4px_rgba(255,107,107,0.7)]" />
          <span className="absolute bottom-1 right-1 h-3 w-3 rounded-br-sm border-b-2 border-r-2 border-rose-400/90 drop-shadow-[0_0_4px_rgba(255,107,107,0.7)]" />
        </div>
      )}

      {(() => {
        if (dead) return null // a dead unit shows the "Morto" tombstone, not a control overlay
        const ctrl = effects.find(e => CONTROL_OVERLAY[e.kind])
        if (!ctrl) return null
        const o = CONTROL_OVERLAY[ctrl.kind]!
        return (
          <div
            data-control={ctrl.kind}
            className={cn('pointer-events-none absolute inset-x-0 top-0 z-10 grid place-items-center rounded-xl aspect-[3/4]', o.cls)}
          >
            <span className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              {o.label} ·{ctrl.remaining}t
            </span>
          </div>
        )
      })()}

      {impact && !reduce && (
        <motion.div
          key={`impact-${floatKey}`}
          data-impact={isCrit ? 'crit' : 'hit'}
          aria-hidden
          className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 rounded-xl aspect-[3/4]', isCrit ? 'bg-amber-300/40' : 'bg-rose-400/30')}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: isCrit ? 0.5 : 0.32, ease: 'easeOut' }}
        />
      )}

      <div className="mt-1 flex items-center justify-center gap-1 leading-tight">
        <span className={cn('truncate font-medium', compact ? 'text-[10px]' : 'text-xs')}>{unit.name}</span>
        <span
          data-role="level-badge"
          className="shrink-0 rounded border border-[#C9A24B]/45 bg-[#C9A24B]/25 px-1 text-[10px] font-bold tabular-nums text-[#F4DE9A]"
        >
          Lv. {shownLevel}
        </span>
      </div>
      <div className="mt-0.5"><HpBar hp={hp} maxHp={unit.maxHp} /></div>

      {!compact && (
        <div className="mt-1.5 flex flex-col gap-1">
          <StatBar label="ATT" value={live.atk} base={unit.baseAtk} color="bg-rose-400" icon={Sword} />
          <StatBar label="DIF" value={live.def} base={unit.baseDef} color="bg-sky-400" icon={Shield} />
          <StatBar label="VEL" value={live.spd} base={unit.baseSpd} color="bg-amber-400" icon={Zap} />
        </div>
      )}

      <div data-role="cooldown" className={cn('mt-0.5 truncate text-center leading-tight', compact ? 'text-[9px]' : 'text-[11px]')}>
        <span className="text-white/55">{unit.spell.name}: </span>
        {cooldown > 0 ? (
          <span className="text-white/45 tabular-nums">{turnsLabel(cooldown)}</span>
        ) : (
          <span data-ready="true" className="text-emerald-400">pronto</span>
        )}
      </div>

      <div data-role-badge className={cn('absolute top-1 z-10 pointer-events-none', mirrored ? 'right-1' : 'left-1')}>
        {(() => {
          const RoleIcon = ROLE_ICON[unit.role] ?? Shield
          return (
            <span
              title={unit.role === 'Tank' ? 'Provocazione: i nemici attaccano questo bersaglio per primi' : unit.role}
              className={cn('inline-flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-semibold backdrop-blur-sm',
                unit.role === 'Tank' ? 'text-sky-300' : 'text-white/80')}
            >
              <RoleIcon size={9} aria-hidden />
              {ROLE_LABEL[unit.role] ?? unit.role}
            </span>
          )
        })()}
      </div>

      {/* Only NON-stat statuses get a top pill (control/dot/shield/regen/ward). Stat
          buffs/debuffs are shown by the LIVE stat bars (green ▲ / red ▼) instead — pills
          for them just stacked up (e.g. "def+25 ×3") and cluttered the corner. */}
      {effects.some(e => e.kind !== 'buff' && e.kind !== 'debuff') && (
        <div className={cn('absolute top-1 flex flex-wrap gap-0.5', mirrored ? 'left-1' : 'right-1')}>
          {effects.filter(e => e.kind !== 'buff' && e.kind !== 'debuff').map((e, i) => {
            const Icon = STATUS_ICON[e.kind] ?? Flame
            return (
              <span
                key={`${e.kind}-${e.statusId ?? 'n'}-${i}`}
                data-status-kind={e.kind}
                title={describeEffect(e)}
                className={cn('inline-flex items-center gap-0.5 rounded bg-black/55 px-0.5 text-[9px] font-semibold tabular-nums', STATUS_CLASS[e.kind])}
              >
                <Icon size={11} aria-hidden />
                {effectCount(e)}
              </span>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {float && (
          <motion.span
            key={floatKey}
            data-testid="damage-float"
            initial={reduce ? false : { opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: reduce ? 0 : -26, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -40 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'absolute left-1/2 -translate-x-1/2 top-2 pointer-events-none select-none font-display text-sm tabular-nums',
              FLOAT_CLASS[float.tone],
            )}
          >
            {float.text}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

