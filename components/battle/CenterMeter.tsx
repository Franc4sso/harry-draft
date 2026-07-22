'use client'
import type { Side } from '@/types'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { livingCount, focusEnemy, venomOf, venomPerTurn, turnsToDie } from '@/lib/combatReadout'

/**
 * Striscia di sintesi sopra ActionPanel: racconta "chi vince la corsa".
 * - Economia (default): bilancia dei corpi vivi player vs nemici.
 * - Veleno: quando un nemico vivo è avvelenato, si aggancia al più avvelenato e
 *   mostra HP-che-scende vs veleno + stima "muore ~N turni".
 * Puro presentazionale: tutte le derivazioni vengono da lib/combatReadout.
 */
export function CenterMeter({ frame, units, playerSide }: {
  frame: ReplayFrame
  units: ReplayUnit[]
  playerSide: Side
}) {
  const enemySide: Side = playerSide === 'left' ? 'right' : 'left'
  const focus = focusEnemy(frame, units, playerSide)
  const focusVenom = focus ? venomOf(frame, focus) : 0

  const shell = 'w-full max-w-xl rounded-xl border border-[#C9A24B]/20 bg-[rgba(20,16,33,0.5)] px-3 py-1.5 text-xs backdrop-blur-sm'

  // MODALITÀ VELENO
  if (focus && focusVenom > 0) {
    const hp = frame.hp[focus.key] ?? 0
    const perTurn = venomPerTurn(focusVenom, focus.maxHp)
    const dies = turnsToDie(hp, perTurn)
    const hpPct = Math.max(0, Math.min(100, (hp / focus.maxHp) * 100))
    return (
      <div data-testid="center-meter" data-mode="venom" className={shell}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-emerald-300">☠ {focus.name}</span>
          <span className="tabular-nums text-white/70">veleno ×{focusVenom} · {perTurn}/turno</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-rose-400/80" style={{ width: `${hpPct}%` }} />
        </div>
        {dies !== null && (
          <div className="mt-0.5 text-center text-[10px] text-emerald-300/80">muore tra ~{dies} turni</div>
        )}
      </div>
    )
  }

  // MODALITÀ ECONOMIA
  const mine = livingCount(frame, units, playerSide)
  const theirs = livingCount(frame, units, enemySide)
  const advantage = mine > theirs ? 'player' : theirs > mine ? 'enemy' : 'even'
  return (
    <div data-testid="center-meter" data-mode="economy" data-advantage={advantage} className={shell}>
      <div className="flex items-center justify-center gap-3 tabular-nums">
        <span className={advantage === 'player' ? 'font-bold text-emerald-300' : 'text-white/70'}>
          Tu {'♥'.repeat(Math.max(0, mine))} {mine}
        </span>
        <span className="text-white/30">vs</span>
        <span className={advantage === 'enemy' ? 'font-bold text-rose-300' : 'text-white/70'}>
          {theirs} {'♥'.repeat(Math.max(0, theirs))} Nemici
        </span>
      </div>
    </div>
  )
}
