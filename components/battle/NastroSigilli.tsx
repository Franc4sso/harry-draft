'use client'
import { useMemo } from 'react'
import * as Icons from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'
import type { Replay } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import { lastRealEntryAt } from '@/lib/initiative'
import { SPELL_TYPE_META } from '@/lib/glossary'
import { SPELL_BY_ID, SPELLS } from '@/data/spells'

// entry.action is the spell's display NAME (see LogEntry/simulate.ts), not its
// id — SPELL_BY_ID can't look it up directly. Names are unique across SPELLS
// (verified), so this read-only derivation is a safe local index; it doesn't
// touch data/spells.ts.
const SPELL_BY_NAME = Object.fromEntries(SPELLS.map(s => [s.name, s]))
import { cn } from '@/lib/cn'

/** One slot in the ribbon: a real past/current turn (carries its own LogEntry —
 *  ground truth for which spell TYPE actually fired) or a future turn (no entry
 *  yet, so the sigil is read from the caster's currently-equipped spell via
 *  SPELL_BY_ID — the best available prediction, same source BattleArena/cards
 *  use to show "what they'll cast"). */
interface RibbonSlot {
  key: string
  turn: number
  entry: LogEntry | null
}

/**
 * Scans the replay's own frames for the ordered sequence of real (non-system,
 * actor-bearing) turns — mirrors `initiativeAt`'s scan in lib/initiative.ts
 * exactly, so this ribbon can never disagree with what the engine actually
 * did. Kept local (not hoisted into initiative.ts) because it carries the
 * LogEntry per slot, which initiativeAt's existing contract (key-only) does
 * not — extending that return shape would ripple into InitiativeBar/BattleArena,
 * which the task forbids touching.
 */
function ribbonOrder(replay: Replay): RibbonSlot[] {
  const out: RibbonSlot[] = []
  for (const f of replay.frames) {
    const e = f.entry
    if (!e || e.type === 'system' || !e.actorSide) continue
    out.push({ key: unitKey(e.actorSide, e.actorId), turn: e.turn, entry: e })
  }
  return out
}

// 7, not 6: with a 3v3 (6 actors/round), a window of 6 future slots can land
// exactly one turn short of a unit's NEXT occurrence when the focus sits on
// that same unit's OWN turn (focus at round position p covers p+1..p+6, which
// excludes p+7 — that unit's next turn). 7 guarantees every unit reappears at
// least once within the visible window regardless of where in the round the
// focus currently sits, which is what makes "who will skip" reliably visible.
/** Passo costante di uno slot del nastro. Costante e non misurato: e' quello che
 *  rende la traslazione prevedibile (`nowOffset * SLOT_W`) e quindi lo scorrimento
 *  fluido invece che dipendente dalla larghezza del nome di chi lancia. */
const SLOT_W = 96

/** Larghezza del riquadro di fuoco: gli slot accanto al turno corrente lo
 *  SCAVALCANO invece di finirci sotto. Misurato a 1600x900 con la finestra
 *  precedente: 4 sigilli su 15 sparivano dietro il pannello. */
const FOCUS_W = 380

const FUTURE_COUNT = 3
const PAST_COUNT = 2

/**
 * "Il nastro dei sigilli" — the spell-order timeline across the middle of the
 * battle: past turns fading out on the left, the current turn held in the
 * focus panel, and the sequence of what's coming next fanning out to the
 * right. Visual source: the Vetrata mockup's `.tl`/`.node`/`.oct`/`.focus`
 * rules (octagon sigils, 36px future / 28px past-at-.2-opacity, the double-
 * ring focus panel) — values below are copied from that CSS, not eyeballed.
 */
export function NastroSigilli({ replay, index, className }: { replay: Replay; index: number; className?: string }) {
  const reduce = useReducedMotion()
  const byKey = useMemo(() => Object.fromEntries(replay.units.map(u => [u.key, u])), [replay])
  const order = useMemo(() => ribbonOrder(replay), [replay])

  const frame = replay.frames[Math.min(index, replay.frames.length - 1)]
  const statusEffects = frame?.statusEffects ?? {}

  // Focus never empties on a system frame (poison tick, Duo, stun announcement —
  // none of these carry their own actor): it sticks to the last REAL action, same
  // fix already used by InitiativeBar/BattleArena/TurnLane for this exact problem.
  const focusEntry = lastRealEntryAt(replay, index)
  const focusPos = focusEntry ? order.findIndex(s => s.entry === focusEntry) : -1

  // Past N + current + future FUTURE_COUNT, centered on the focused turn.
  const startPos = focusPos < 0 ? 0 : Math.max(0, focusPos - PAST_COUNT)
  const sequence = useMemo(() => {
    if (focusPos < 0) return []
    const past = order.slice(startPos, focusPos)
    const future = order.slice(focusPos + 1, focusPos + 1 + FUTURE_COUNT)
    return [...past, order[focusPos]!, ...future]
  }, [order, focusPos, startPos])

  const nowOffset = focusPos - startPos

  const focusUnit = focusEntry?.actorSide ? byKey[unitKey(focusEntry.actorSide, focusEntry.actorId)] : undefined
  const focusTarget = focusEntry?.targetSide && focusEntry?.targetId
    ? byKey[unitKey(focusEntry.targetSide, focusEntry.targetId)]
    : undefined
  const focusType = focusEntry && focusEntry.type !== 'system' ? focusEntry.type : null
  const focusMeta = focusType ? SPELL_TYPE_META[focusType] : null
  const FocusIcon = focusMeta ? (Icons[focusMeta.icon] as React.ComponentType<{ size?: number }>) : null
  // Deliberately NOT BattleLog's describeEntry: its `flags.includes('dot')`
  // branch narrates DoT-TICK frames (a poison/burn frame, type:'system', where
  // the subject is who's SUFFERING) — but a venom-applying Attacco's own CAST
  // (e.g. Serpensortia) carries that same 'dot' flag on its casting entry (see
  // game/engine/combat/effects.ts: `if (def?.kind === 'dot') ctx.flags.push('dot')`
  // runs for the caster's action, not just ticks). Reusing describeEntry here
  // produced a real mismatch during screenshot review — header said "Draco
  // lancia Serpensortia" while the detail line said "Ron subisce danni da
  // veleno" (borrowed the tick sentence for the cast). The focus's own detail
  // line is built directly from the entry instead, so it can't inherit that
  // ambiguity: it only ever describes THIS entry's actor→target cast.
  const focusDetail = useMemo(() => {
    if (!focusEntry) return ''
    const spell = focusEntry.type !== 'system' ? SPELL_BY_NAME[focusEntry.action] : undefined
    const pct = spell ? `${Math.round(spell.hitChance * 100)}%` : null
    const parts: string[] = []
    if (focusTarget) parts.push(`su ${focusTarget.name}`)
    else if (focusEntry.type === 'system') parts.push(focusEntry.action)
    if (pct) parts.push(pct)
    return parts.join(' · ')
  }, [focusEntry, focusTarget])

  const renderNode = (slot: RibbonSlot, isPast: boolean) => {
    const u = byKey[slot.key]
    if (!u) return null

    // Sigil type: ground truth (entry.type) for anything that already
    // happened; for a future turn (no entry yet) fall back to the caster's
    // currently-equipped spell, same source the rest of the battle UI uses
    // to preview "what they'll cast".
    const type = slot.entry && slot.entry.type !== 'system' ? slot.entry.type : SPELL_BY_ID[u.spell.id]?.type
    const meta = type ? SPELL_TYPE_META[type] : null
    const Icon = meta ? (Icons[meta.icon] as React.ComponentType<{ size?: number }>) : null
    const spellName = slot.entry?.action ?? u.spell.name

    const effects = statusEffects[slot.key] ?? []
    const willSkip = effects.some(e => (e.statusId ?? e.kind) === 'stun' || (e.statusId ?? e.kind) === 'freeze')
    const skipKind = effects.find(e => (e.statusId ?? e.kind) === 'stun')
      ? 'stun'
      : effects.find(e => (e.statusId ?? e.kind) === 'freeze')
        ? 'freeze'
        : null

    // 36px future / 28px past — from the mockup's .oct sizing.
    const size = isPast ? 28 : 36
    const ringColor = isPast ? 'rgba(226,214,186,.18)' : willSkip
      ? (skipKind === 'freeze' ? 'rgba(107,184,221,.5)' : 'rgba(217,189,106,.5)')
      : (meta ? `${meta.color}55` : 'rgba(226,214,186,.25)')

    return (
      <div
        key={`${slot.turn}-${slot.key}`}
        data-testid="sigillo"
        data-tipo={type ?? undefined}
        data-unit={slot.key}
        data-skip={willSkip ? 'true' : undefined}
        className="relative flex flex-col items-center gap-1"
        style={{ opacity: isPast ? 0.2 : 1, transition: reduce ? undefined : 'opacity .4s' }}
      >
        <div
          className="relative grid place-items-center"
          style={{
            width: size,
            height: size,
            border: `1.5px solid ${ringColor}`,
            background: 'linear-gradient(180deg,#191430,#0a0813)',
            clipPath: 'polygon(29% 0,71% 0,100% 29%,100% 71%,71% 100%,29% 100%,0 71%,0 29%)',
            transition: reduce ? undefined : 'all .42s cubic-bezier(.22,1,.36,1)',
          }}
        >
          {Icon && <Icon size={isPast ? 12 : 16} />}
          {willSkip && (
            <span
              data-testid="tacca-salta"
              data-kind={skipKind ?? 'stun'}
              title="salterà il turno"
              className="absolute -right-[5px] -top-[5px] grid h-[14px] w-[14px] place-items-center rounded-full text-[8px] font-black leading-none text-[#08060f]"
              style={{ background: skipKind === 'freeze' ? '#6bb8dd' : '#d9bd6a', border: '1px solid rgba(8,6,15,.7)' }}
            >
              {skipKind === 'freeze' ? '❄' : '✦'}
            </span>
          )}
        </div>
        <span
          className="max-w-[64px] truncate text-[8px] font-extrabold leading-none"
          style={{ color: isPast ? 'rgba(226,214,186,.24)' : 'rgba(255,255,255,.78)' }}
        >
          {u.name}
        </span>
        <span
          className="max-w-[64px] truncate text-[7.5px] font-semibold leading-none"
          style={{ color: willSkip ? (skipKind === 'freeze' ? '#6bb8dd' : '#d9bd6a') : 'rgba(226,214,186,.24)' }}
        >
          {willSkip ? 'salterà' : spellName}
        </span>
      </div>
    )
  }

  return (
    <div data-testid="nastro-sigilli" className={cn('relative', className)}>
      {/* .rail — 1px line fading at both ends, from the mockup */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(226,214,186,.24) 6%,rgba(226,214,186,.24) 94%,transparent)' }}
      />

      {/* Il nastro SCORRE. Prima erano due gruppi flex (passati a sinistra, futuri a
          destra) separati da uno spaziatore: a ogni turno la lista si ricomponeva
          di colpo, quindi non si vedeva nessun movimento — il rilievo dell'utente
          («non scorre, vorrei proprio vedere come scorre»).

          Ora e' UNA striscia sola di slot a passo COSTANTE (`SLOT_W`), traslata di
          `-(nowOffset * SLOT_W)` piu' meta' contenitore: cosi' lo slot del turno
          corrente cade sempre esattamente al centro, e quando l'indice avanza la
          striscia scivola di un passo invece di ricostruirsi. L'animazione sta
          sulla trasformazione, quindi e' il nastro a muoversi, non i nodi a
          saltare da una posizione all'altra.

          `top-1/2 -translate-y-1/2`: la riga sta sulla STESSA linea del binario e
          del riquadro di fuoco. Prima era in cima al contenitore e, siccome ogni
          nodo e' alto (ottagono + nome + incantesimo), il suo centro cadeva 54px
          sopra quello del riquadro — misurato dal vivo, ed e' lo sfasamento che
          si vede nello screenshot. */}
      <div className="absolute inset-x-0 top-1/2 h-0 -translate-y-1/2">
        <div
          data-testid="nastro-riga"
          className="absolute left-1/2 top-1/2 flex -translate-y-1/2 items-center"
          style={{
            // Il centro da raggiungere e' la META' dello slot di fuoco, che e' piu'
            // largo degli altri: sommo gli slot che lo precedono (tutti SLOT_W) e
            // mezza larghezza del riquadro.
            //
            // `left-1/2` (meta' del WRAPPER) e non `translateX(50%)`: quel 50% si
            // riferiva alla riga stessa, larga `max-content`, quindi il centro
            // cadeva altrove — misurato, lo slot di fuoco stava a 281..661 mentre
            // il pannello era a 603..983, 322px di scarto, e tre sigilli futuri
            // finivano sotto il pannello. Ora la riga parte dal centro del wrapper,
            // lo stesso riferimento che usa il riquadro di fuoco.
            transform: `translateX(-${nowOffset * SLOT_W + FOCUS_W / 2}px)`,
            transition: reduce ? undefined : 'transform .52s cubic-bezier(.22,1,.36,1)',
            width: 'max-content',
          }}
        >
          {sequence.map((slot, i) => (
            <div
              key={`${slot.turn}-${slot.key}`}
              className="flex shrink-0 justify-center"
              style={{
                // Lo slot del turno corrente E' il riquadro di fuoco: ne occupa la
                // larghezza e non disegna nodo, cosi' i vicini gli stanno ACCANTO
                // invece che sotto (misurato: 4 sigilli su 15 ci sparivano dietro).
                width: i === nowOffset ? FOCUS_W : SLOT_W,
              }}
            >
              {i === nowOffset ? null : renderNode(slot, i < nowOffset)}
            </div>
          ))}
        </div>
      </div>

      {/* .focus — 380x116, double gold ring, carved-gold 16px corners */}
      <div
        data-testid="nastro-focus"
        data-unit={focusUnit?.key}
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 380,
          maxWidth: '92vw',
          height: 116,
          border: '1px solid rgba(184,150,63,.45)',
          background: 'linear-gradient(135deg,rgba(28,22,48,.97),rgba(9,7,17,.97))',
          boxShadow: '0 0 0 4px rgba(6,5,11,.9), 0 0 0 5px rgba(184,150,63,.28)',
        }}
      >
        {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
          <span
            key={corner}
            aria-hidden
            className="absolute"
            style={{
              width: 16,
              height: 16,
              border: '2px solid #b8963f',
              left: corner.includes('l') ? -1 : undefined,
              right: corner.includes('r') ? -1 : undefined,
              top: corner.includes('t') ? -1 : undefined,
              bottom: corner.includes('b') ? -1 : undefined,
              borderRight: corner.includes('l') ? 0 : undefined,
              borderLeft: corner.includes('r') ? 0 : undefined,
              borderBottom: corner.includes('t') ? 0 : undefined,
              borderTop: corner.includes('b') ? 0 : undefined,
            }}
          />
        ))}
        <div className="flex h-full items-center gap-4 px-[18px] py-[15px]">
          <div
            className="grid flex-none place-items-center"
            style={{
              width: 62,
              height: 62,
              border: `2px solid ${focusMeta?.color ?? '#b8963f'}`,
              background: 'linear-gradient(180deg,#261c3c,#0c0916)',
              clipPath: 'polygon(29% 0,71% 0,100% 29%,100% 71%,71% 100%,29% 100%,0 71%,0 29%)',
            }}
          >
            {FocusIcon && <FocusIcon size={28} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[7.5px] font-extrabold uppercase leading-none tracking-[.2em]" style={{ color: '#b8963f' }}>
              {focusUnit ? `Ora · ${focusUnit.name} lancia` : '…'}
            </div>
            <div className="mt-1.5 truncate font-serif text-[22px] font-black leading-none" style={{ color: '#e8d49a' }}>
              {focusEntry?.action ?? ''}
            </div>
            <div className="mt-1 text-[9.5px] font-semibold leading-snug" style={{ color: 'rgba(242,238,228,.56)' }}>
              {focusDetail}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
