'use client'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Flame, Zap, Shield, Sword, Snowflake, Ban, Swords, ArrowUp, ArrowDown, Heart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect, StatusKind } from '@/types'
import { RarityFrame } from '@/components/ui/RarityFrame'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { HpBar } from './HpBar'
import type { FloatDescriptor, FloatTone } from './damageFloat'
import { cn } from '@/lib/theme'

const FLOAT_CLASS: Record<FloatTone, string> = {
  damage: 'text-rose-300',
  crit: 'text-amber-300 text-xl font-bold drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]',
  heal: 'text-emerald-300',
  dodge: 'text-white/60 text-[11px] uppercase tracking-wider',
}

/** Buff direction of a stat: buffed > base (up), < base (down), or equal (none). */
function buffState(buffed: number, base: number): 'up' | 'down' | 'none' {
  return buffed > base ? 'up' : buffed < base ? 'down' : 'none'
}
const BUFF_CLASS = {
  up: 'text-emerald-400',
  down: 'text-rose-400',
  none: 'text-white/70',
} as const

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
}
const STATUS_CLASS: Record<StatusKind, string> = {
  dot: 'text-orange-400',
  stun: 'text-yellow-300',
  freeze: 'text-cyan-300',
  shield: 'text-sky-300',
  buff: 'text-emerald-400',
  debuff: 'text-rose-400',
  silence: 'text-violet-300',
  disarm: 'text-amber-300',
  regen: 'text-emerald-300',
}

const STAT_LABEL: Record<string, string> = { hp: 'HP', atk: 'atk', def: 'def', spd: 'spd' }

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
    case 'dot':
      return `Veleno: -${e.amount ?? 0} HP/turno, ${turns}`
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
      return `Potenziamento ${stat} +${e.amount ?? 0}, ${turns}`
    case 'debuff':
      return `Indebolimento ${stat} -${e.amount ?? 0}, ${turns}`
    default:
      return turns
  }
}

/** The number to show beside a status icon: shield prefers absorbLeft, else remaining. */
function effectCount(e: ActiveEffect): number {
  if (e.kind === 'shield' && e.absorbLeft != null) return e.absorbLeft
  return e.remaining
}

/**
 * Battle bust: rarity frame + face-cropped portrait + house crest + HP, with an
 * acting (green) / targeted (red) aura, status icons, KO tombstone, and a
 * floating damage/heal number. Reduced-motion → static final state.
 */
export function UnitBust({
  unit, hp, acting, targeted, mirrored, float, floatKey, effects = [], cooldown = 0,
}: {
  unit: ReplayUnit
  hp: number
  acting?: boolean
  targeted?: boolean
  mirrored?: boolean
  float?: FloatDescriptor | null
  floatKey?: number | string
  /** Real active status effects on this unit for the current frame. */
  effects?: ActiveEffect[]
  /** Turns remaining on this unit's primary spell (0 = ready). */
  cooldown?: number
}) {
  const reduce = useReducedMotion()
  const dead = hp <= 0
  const aura = acting ? '0 0 22px rgba(124,252,155,0.55)' : targeted ? '0 0 22px rgba(255,107,107,0.6)' : undefined

  return (
    <motion.div
      data-testid="battle-unit"
      data-unit-key={unit.key}
      data-dead={dead || undefined}
      data-acting={acting || undefined}
      animate={reduce ? {} : {
        scale: acting ? 1.04 : 1,
        x: targeted ? (mirrored ? -4 : 4) : 0,
      }}
      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
      className={cn('relative w-28 sm:w-32', mirrored && 'text-right')}
      style={{ boxShadow: aura, borderRadius: 16, filter: dead ? 'grayscale(0.85)' : undefined }}
    >
      <RarityFrame tier={unit.tier}>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl">
          <PortraitImage id={unit.id} house={unit.house} alt={unit.name} variant="bust" />
          {dead && (
            <div className="absolute inset-0 grid place-items-center bg-black/45">
              <span className="rounded border border-rose-400/50 bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">
                Morto
              </span>
            </div>
          )}
        </div>
      </RarityFrame>

      <div className="mt-1 truncate text-center text-[11px] font-medium leading-tight">{unit.name}</div>
      <div className="mt-0.5"><HpBar hp={hp} maxHp={unit.maxHp} /></div>

      <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] tabular-nums">
        <Stat icon={Sword} stat="atk" value={unit.atk} base={unit.baseAtk} />
        <span className="text-white/25">·</span>
        <Stat icon={Shield} stat="def" value={unit.def} base={unit.baseDef} />
        <span className="text-white/25">·</span>
        <Stat icon={Zap} stat="spd" value={unit.spd} base={unit.baseSpd} />
      </div>

      <div data-role="cooldown" className="mt-0.5 truncate text-center text-[10px] leading-tight">
        <span className="text-white/55">{unit.spell.name}: </span>
        {cooldown > 0 ? (
          <span className="text-white/45 tabular-nums">{turnsLabel(cooldown)}</span>
        ) : (
          <span data-ready="true" className="text-emerald-400">pronto</span>
        )}
      </div>

      {unit.role === 'Tank' && (
        <div className={cn('absolute bottom-14 pointer-events-none', mirrored ? 'right-1' : 'left-1')}>
          <span
            title="Provocazione: i nemici attaccano questo bersaglio per primi"
            className="inline-flex items-center gap-0.5 rounded bg-black/55 px-0.5 text-[9px] font-semibold text-sky-300"
          >
            <Shield size={9} aria-hidden />
            Prov.
          </span>
        </div>
      )}

      {effects.length > 0 && (
        <div className={cn('absolute top-1 flex flex-wrap gap-0.5', mirrored ? 'left-1' : 'right-1')}>
          {effects.map((e, i) => {
            const Icon = STATUS_ICON[e.kind] ?? Flame
            return (
              <span
                key={`${e.kind}-${e.statusId ?? i}`}
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
}

/** One stat in the bust stat row, colored by its buff direction (green/red/white). */
function Stat({
  icon: Icon, stat, value, base,
}: {
  icon: typeof Sword
  stat: 'atk' | 'def' | 'spd'
  value: number
  base: number
}) {
  const buff = buffState(value, base)
  return (
    <span
      data-stat={stat}
      data-buff={buff}
      className={cn('inline-flex items-center gap-0.5', BUFF_CLASS[buff])}
    >
      <Icon size={10} aria-hidden />
      {value}
    </span>
  )
}
