'use client'
import type { DraftedWizard, ActiveRelic, Role } from '@/types'
import { DuoPanel } from '@/components/run/DuoPanel'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { Chip } from '@/components/ui/Chip'
import { houseTheme } from '@/lib/theme'
import { displayName } from '@/lib/displayName'
import { spellTypeChip } from '@/lib/glossary'

/** Role accent colours mirror the spell-type palette (Attaccante↔Attacco, etc.),
 *  so a role reads with the same colour language as the wizard's kit. */
const ROLE_COLOR: Record<Role, string> = {
  Attaccante: '#FF8A7A', Tank: '#7DB7FF', Supporto: '#7CFC9B', Controllo: '#C98BFF',
}

/** A wizard's health as read across the run (`currentHp` persists between battles;
 *  a fallen mage sits at 0). The fill shifts green → amber → red as HP drains so the
 *  player can read at a glance who needs the Infermeria. Shown in the map sidebar,
 *  where wounds carried out of a fight were previously invisible. */
function HpBar({ current, max }: { current: number; max: number }) {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, current / max))
  const dead = current <= 0
  const color = dead ? '#6b7280' : ratio > 0.5 ? '#7CFC9B' : ratio > 0.25 ? '#F0D98A' : '#FF6B6B'
  return (
    <div className="mt-1 flex items-center gap-1.5" title={`${Math.max(0, Math.round(current))} / ${max} PV`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-inset ring-white/5">
        <div className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${ratio * 100}%`, background: color, boxShadow: dead ? 'none' : `0 0 6px ${color}88` }} />
      </div>
      <span className="shrink-0 text-right text-[9.5px] font-semibold tabular-nums text-white/60">
        {dead ? 'K.O.' : `${Math.max(0, Math.round(current))}/${max}`}
      </span>
    </div>
  )
}

/**
 * A single member row in the vertical sidebar. Folds in what used to be the
 * separate LOADOUT box: role icon (tooltip) and equipped spell + type chip.
 * A plain, non-interactive row — no swap selector (a wizard's spell is fixed).
 */
function MemberRow({ m }: { m: DraftedWizard }) {
  const theme = houseTheme(m.wizard.house)
  const spell = m.spell
  const typeChip = spell?.type ? spellTypeChip(spell.type) : undefined
  const roleColor = m.wizard.role ? ROLE_COLOR[m.wizard.role] : '#ffffff80'

  return (
    <div
      data-house={m.wizard.house}
      className="rounded-xl border bg-black/30"
      style={{ borderColor: `${theme.color}55` }}
    >
      <div className="flex w-full items-center gap-2 p-1.5 text-left">
        <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
          <PortraitImage id={m.wizard.id} house={m.wizard.house} alt={m.wizard.name} variant="bust" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold leading-tight text-white/90">{displayName(m)}</span>
            {m.wizard.role && (
              <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-wide" style={{ color: roleColor }}>
                {m.wizard.role}
              </span>
            )}
          </span>
          <HpBar current={m.currentHp ?? m.maxHp} max={m.maxHp} />
        </span>
        <span className="shrink-0 text-[9px] font-bold text-[#F0D98A]">Lv.{m.level ?? 1}</span>
      </div>

      {spell && (
        <div className="border-t border-white/10 px-1.5 pb-1.5 pt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/70">{spell.name}</span>
            {typeChip && <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />}
          </div>
        </div>
      )}
    </div>
  )
}

/** Sidebar verticale (mappa/recruit/reliquia): squadra sempre visibile in alto — è lo stato
 *  che il giocatore legge di continuo — il pannello Combo Duo è l'unico contenuto sotto,
 *  senza struttura a tab. */
function VerticalBar({ team, relics }: {
  team: DraftedWizard[]
  relics: ActiveRelic[]
}) {
  return (
    <div
      data-testid="team-synergy-bar"
      className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
    >
      <div className="flex flex-col gap-2">
        {team.map((m) => <MemberRow key={m.wizard.id} m={m} />)}
      </div>
      <div className="border-t border-white/10 pt-2.5">
        <DuoPanel team={team} relics={relics} frameless />
      </div>
    </div>
  )
}

/**
 * The current team, kept in view across the run screens. Purely presentational —
 * reads the drafted team. `orientation` switches between the compact top strip
 * ('horizontal', default) and a left-hand sidebar ('vertical') used next to the
 * map tree, where members get larger portraits so they read better and the Combo
 * Duo panel sits below the roster. In vertical mode, each row also folds in the
 * role icon and equipped spell (formerly the separate LOADOUT box) — a plain
 * display, no swap selector (a wizard's spell is fixed).
 */
export function TeamSynergyBar({
  team, relics = [], orientation = 'horizontal',
}: {
  team: DraftedWizard[]
  /** Active relics — only used to compute the Duo panel (vertical orientation). Optional
   *  and defaults to none so existing (non-Duo-aware) call sites/tests are unaffected. */
  relics?: ActiveRelic[]
  orientation?: 'horizontal' | 'vertical'
}) {
  if (orientation === 'vertical') {
    return <VerticalBar team={team} relics={relics} />
  }

  return (
    <div
      data-testid="team-synergy-bar"
      className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
    >
      {/* Roster — compact portrait + name + level per member. */}
      <div className="flex flex-wrap items-center gap-2">
        {team.map((m) => {
          const theme = houseTheme(m.wizard.house)
          return (
            <div
              key={m.wizard.id}
              data-house={m.wizard.house}
              className="flex items-center gap-2 rounded-xl border bg-black/30 py-1 pl-1 pr-2"
              style={{ borderColor: `${theme.color}55` }}
            >
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                <PortraitImage id={m.wizard.id} house={m.wizard.house} alt={m.wizard.name} variant="bust" />
              </span>
              <span className="truncate text-xs font-semibold text-white/90">{displayName(m)}</span>
              <Chip label={`Lv. ${m.level ?? 1}`} color="#F0D98A" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
