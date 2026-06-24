'use client'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Flame, Zap, Shield, Sword } from 'lucide-react'
import type { ReplayUnit } from '@/game/engine/combat/replay'
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

const STATUS_ICON = { dot: Flame, stun: Zap, shield: Shield } as const
const STATUS_CLASS = {
  dot: 'text-orange-400',
  stun: 'text-yellow-300',
  shield: 'text-sky-300',
} as const

/**
 * Battle bust: rarity frame + face-cropped portrait + house crest + HP, with an
 * acting (green) / targeted (red) aura, status icons, KO tombstone, and a
 * floating damage/heal number. Reduced-motion → static final state.
 */
export function UnitBust({
  unit, hp, acting, targeted, mirrored, float, floatKey, statuses = [],
}: {
  unit: ReplayUnit
  hp: number
  acting?: boolean
  targeted?: boolean
  mirrored?: boolean
  float?: FloatDescriptor | null
  floatKey?: number | string
  statuses?: Array<'dot' | 'stun' | 'shield'>
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

      {statuses.length > 0 && (
        <div className={cn('absolute top-1 flex gap-1', mirrored ? 'left-1' : 'right-1')}>
          {statuses.map((s, i) => {
            const Icon = STATUS_ICON[s]
            return <Icon key={`${s}-${i}`} data-status={s} size={13} className={STATUS_CLASS[s]} />
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
