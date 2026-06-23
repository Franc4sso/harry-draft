'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import { houseTheme, cn } from '@/lib/theme'
import { RoleIcon } from '@/components/cards/RoleIcon'
import { HpBar } from './HpBar'
import type { FloatDescriptor, FloatTone } from './damageFloat'

const FLOAT_CLASS: Record<FloatTone, string> = {
  damage: 'text-rose-300',
  crit: 'text-amber-300 text-xl font-bold drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]',
  heal: 'text-emerald-300',
  dodge: 'text-white/60 text-[11px] uppercase tracking-wider',
}

/**
 * Compact combatant tile shown in the battle stage. Pulses when acting, dims
 * to a tombstone state on KO, and floats damage/heal numbers on hits.
 */
export function BattleUnit({
  unit, hp, acting, targeted, mirrored, float, floatKey,
}: {
  unit: ReplayUnit
  hp: number
  acting?: boolean
  targeted?: boolean
  mirrored?: boolean
  float?: FloatDescriptor | null
  floatKey?: number | string
}) {
  const theme = houseTheme(unit.house)
  const dead = hp <= 0
  return (
    <motion.div
      data-testid="battle-unit"
      data-dead={dead || undefined}
      data-acting={acting || undefined}
      animate={{
        scale: acting ? 1.04 : 1,
        opacity: dead ? 0.35 : 1,
        x: targeted ? (mirrored ? -4 : 4) : 0,
      }}
      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
      className={cn(
        'relative rounded-xl px-3 py-2 border w-52 text-white overflow-hidden',
        acting ? 'border-white/70' : 'border-white/12',
      )}
      style={{
        background: theme.gradient,
        boxShadow: acting ? theme.ring : '0 6px 18px rgba(0,0,0,0.45)',
      }}
    >
      <div className={cn('flex items-center gap-2', mirrored && 'flex-row-reverse text-right')}>
        <RoleIcon role={unit.role} size={14} className="shrink-0 opacity-80" />
        <span className="text-sm font-medium leading-tight truncate flex-1">{unit.name}</span>
      </div>
      <div className="mt-1.5">
        <HpBar hp={hp} maxHp={unit.maxHp} />
      </div>
      {dead && (
        <div className="absolute inset-0 grid place-items-center bg-black/45 text-[10px] uppercase tracking-widest text-white/70">
          K.O.
        </div>
      )}

      <AnimatePresence>
        {float && (
          <motion.span
            key={floatKey}
            data-testid="damage-float"
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: -26, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'absolute left-1/2 -translate-x-1/2 top-0 pointer-events-none select-none font-display text-sm tabular-nums',
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
