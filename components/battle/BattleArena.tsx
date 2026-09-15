'use client'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { LogEntry, ActiveEffect, ActiveDuo, DraftedWizard } from '@/types'
import type { Replay, ReplayUnit } from '@/game/engine/combat/replay'
import { firstDuoFireFrames, unitKey } from '@/game/engine/combat/replay'
import { WizardCard } from '@/components/cards/WizardCard'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { ArenaBackdrop } from './ArenaBackdrop'
import { PixiArena } from './PixiArena'
import { Callout } from './Callout'
import { DuoPills } from './DuoPills'
import { StatusPips } from './StatusPips'
import { SceneFx } from './SceneFx'
import { floatFor } from './damageFloat'
import { cn } from '@/lib/theme'
import { DUO_BY_ID } from '@/data/duos'
import { sceneEventOf, type SceneKind } from '@/lib/battleScene'

/** Big/ultimate enemy spells worth warning the player about a beat before they land. */
const BIG_SPELLS = new Set([
  'Avada Kedavra', 'Ardemonio', 'Sectumsempra', 'Bombarda', 'Reducto', 'Confringo', 'Crucio',
])

/** Which `fx-*` motion class (battleAnim.css) lands on the ACTOR's and the TARGET's own
 *  wrapper for a given scene, so the card itself lunges/recoils/staggers — not just the
 *  floating number over it. Mirrors SceneFx's internal (unexported) `specFor` table for the
 *  cases the brief calls out by name: strike on the actor, kick/kickBig on the target,
 *  swerve for a dodge, shiver for a skipped turn, fall for a kill. `SceneFx` itself only
 *  draws the numbers/words/decor layer — applying motion to the actual unit card is this
 *  composition layer's job. */
const MOTION_BY_KIND: Partial<Record<SceneKind, { actor?: string; target?: string }>> = {
  hit:     { actor: 'fx-strike', target: 'fx-kick' },
  crit:    { actor: 'fx-strike', target: 'fx-kickBig' },
  shatter: { actor: 'fx-strike', target: 'fx-kickBig' },
  pen:     { actor: 'fx-strike', target: 'fx-kick' },
  block:   { target: 'fx-kick' },
  dodge:   { target: 'fx-swerve' },
  kill:    { actor: 'fx-strike', target: 'fx-fall' },
  revive:  { target: 'fx-rise' },
  heal:    { target: 'fx-rise' },
  skip:    { actor: 'fx-shiver' },
  fatigue: { actor: 'fx-shiver' },
  recoil:  { actor: 'fx-kick' },
}

/**
 * Reconstructs the DraftedWizard-shaped object WizardCard needs from a lean
 * ReplayUnit. Lossless for everything the card actually shows: `wizard` and
 * `spell` come straight from the same data tables the real draft used
 * (WIZARD_BY_ID/SPELL_BY_ID keyed off the unit's own ids), stats come from
 * the unit's live-buffed atk/def/spd + its maxHp. The only thing NOT
 * recovered is `grantedTags` (runtime-only tags granted mid-run, e.g. Marchio) —
 * `tagsOf` falls back to the wizard's native tags, so the archetype badge can
 * miss a runtime tag; that's cosmetic (badge only), not a data field the
 * brief requires in battle.
 */
function toDrafted(u: ReplayUnit): DraftedWizard {
  const zeroRange: readonly [number, number] = [0, 0]
  const wizard = WIZARD_BY_ID[u.id] ?? {
    id: u.id, name: u.name, house: u.house, role: u.role, tier: u.tier, gender: 'm' as const,
    ranges: { hp: zeroRange, atk: zeroRange, def: zeroRange, spd: zeroRange }, spellPool: [],
  }
  const spell = SPELL_BY_ID[u.spell.id] ?? {
    id: u.spell.id, name: u.spell.name, type: 'Attacco' as const, cooldown: u.spell.cooldown,
    power: 1, hitChance: 100, desc: '',
  }
  return {
    wizard,
    stats: { hp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd },
    maxHp: u.maxHp,
    spell,
    level: u.level,
    corrotto: u.corrotto,
  }
}

/**
 * Staged battlefield — "campo contro campo": enemies as a row of combat
 * cards ABOVE the action row, the player's team as a mirrored row BELOW.
 * Both rows sit close together so all six cards stay inside the viewport
 * (task 10: the previous stacked-section layout pushed the enemy row off
 * screen at 1366×768). `data-unit-key` stays on the wrapping div (not on
 * WizardCard, which doesn't know about it) because PixiArena measures VFX
 * launch/landing points off that exact attribute.
 */
export function BattleArena({
  replay, hp, entry, frameKey = 0, leftTitle = 'La tua squadra', rightTitle = 'Avversari', center, enemyLevel = 1, speed = 1, duos = [], intensity = 0, portraitHeight = 118,
}: {
  replay: Replay
  hp: Record<string, number>
  entry: LogEntry | null
  frameKey?: number
  leftTitle?: string
  rightTitle?: string
  center?: React.ReactNode
  /** Level shown on every enemy card (menace was removed 2026-07-01). Players use their own. */
  enemyLevel?: number
  /** Replay playback speed — feeds the Pixi VFX layer's time budget. */
  speed?: number
  /** Duo attivi del giocatore in questa battaglia (player-only). */
  duos?: ActiveDuo[]
  /** Crescendo: calore del combattimento 0..1, amplifica i layer cinematici. Vedi `lib/vfx/crescendo.ts`. */
  intensity?: number
  /** Portrait height fed to every WizardCard (px). Lets BattleScreen shrink the
   *  whole arena adaptively so all six cards stay inside 768px. */
  portraitHeight?: number
}) {
  // Una riga di sistema marchiata da un Duo non ha un vero "attore che agisce": MIASMA la attribuisce
  // al CADAVERE che contagia (giusto nel log, ma in arena accenderebbe l'aura "sta agendo" su un morto),
  // e le altre (KO del Mietitore, sputo dell'Untore) sono conseguenze passive, non azioni. Su questi
  // frame l'evidenziazione dell'attore resta spenta: parlano la pill che lampeggia e l'annuncio.
  const duoSystemFrame = !!entry?.duoId && entry.type === 'system'
  // A frame Stordito (type system, action 'Stordito') is a SKIPPED turn, not an action: the
  // engine emits it on the dedicated frame that covers every control gating 'action' (stun,
  // freeze, ...). The "sta agendo" aura must NOT light up here — it was misleading (the
  // skipped unit looked like it was acting).
  const skipFrame = entry?.type === 'system' && entry.action === 'Stordito'
  const actingKey = entry?.actorSide && !duoSystemFrame && !skipFrame ? unitKey(entry.actorSide, entry.actorId) : null
  const targetKey = entry?.targetSide && entry.targetId ? unitKey(entry.targetSide, entry.targetId) : null
  const float = floatFor(entry)
  const frame = replay.frames[frameKey]
  const statusEffects = frame?.statusEffects ?? {}

  // The unit that's skipping THIS frame (stunned/frozen) — flashes "SALTA". Read from
  // its OWN statusEffects this frame (the log entry only carries the generic 'stun'
  // flag; the flash should say CONGELATO's kind too). Ported from UnitBust, which
  // BattleArena no longer renders.
  const skipKey = skipFrame && entry?.actorSide ? unitKey(entry.actorSide, entry.actorId) : null
  const skipKind: 'stun' | 'freeze' | null = skipKey
    ? (statusEffects[skipKey]?.some((e: ActiveEffect) => e.kind === 'freeze') ? 'freeze' : 'stun')
    : null

  // The scene this frame must show, per lib/battleScene.ts: pure function of this frame and
  // the one before it (status gained/lost is a DIFF between the two). «Ogni evento del motore
  // deve avere una scena» — this is what makes that true on screen, feeding both the SceneFx
  // decor/number/word layer below and the actor/target motion classes on the cards themselves.
  const prevFrame = replay.frames[frameKey - 1]
  const sceneEvent = useMemo(() => sceneEventOf(frame ?? replay.frames[0]!, prevFrame), [frame, prevFrame, replay.frames])
  const motion = MOTION_BY_KIND[sceneEvent.kind]

  // SceneFx positions its number over the acting/target card by their live on-screen rect.
  // Same DOM-measurement pattern PixiArena already uses for its own VFX anchors
  // (`document.querySelector('[data-unit-key=...]')` + getBoundingClientRect) — re-measured
  // every frame since cards can move (dead units grey out/shrink motion, but not layout here).
  const [boxes, setBoxes] = useState<{ actor: DOMRect | null; target: DOMRect | null }>({ actor: null, target: null })
  useEffect(() => {
    const boxOf = (key: string | null) => {
      if (!key) return null
      const el = document.querySelector(`[data-unit-key="${CSS.escape(key)}"]`)
      return el ? el.getBoundingClientRect() : null
    }
    setBoxes({
      actor: boxOf(sceneEvent.actorKey ?? actingKey),
      target: boxOf(sceneEvent.targetKey ?? targetKey),
    })
  }, [frameKey, sceneEvent.actorKey, sceneEvent.targetKey, actingKey, targetKey])

  // Boss telegraph: peek at the NEXT frame — if an enemy is about to unleash a big/ultimate
  // spell, warn the player one beat before it lands.
  const telegraph = useMemo(() => {
    const next = replay.frames[frameKey + 1]?.entry
    if (next && next.actorSide === 'right' && BIG_SPELLS.has(next.action)) {
      const caster = replay.units.find(u => u.id === next.actorId && u.side === 'right')
      return { name: caster?.name ?? 'Il nemico', spell: next.action }
    }
    return null
  }, [replay.frames, replay.units, frameKey])

  // A control status (stun/freeze/silence/disarm) carries no flag of its own, so detect
  // one freshly applied to the target THIS frame by diffing against the previous frame —
  // this is what lets the Callout announce SILENZIATO / DISARMATO / STORDITO / CONGELATO.
  const appliedControl = useMemo(() => {
    if (!targetKey) return null
    const CONTROLS = new Set(['stun', 'freeze', 'silence', 'disarm'])
    const prev = replay.frames[frameKey - 1]?.statusEffects?.[targetKey] ?? []
    const prevKeys = new Set(prev.map((e: ActiveEffect) => e.statusId ?? e.kind))
    const fresh = (statusEffects[targetKey] ?? []).find((e: ActiveEffect) => CONTROLS.has(e.kind) && !prevKeys.has(e.statusId ?? e.kind))
    return fresh?.kind ?? null
  }, [replay.frames, frameKey, targetKey, statusEffects])

  // Primo scatto di ogni Duo in QUESTA battaglia: l'indice del primo frame che lo marchia. La stessa
  // funzione pura la usa `useBattleReplay` per allungare SOLO quel frame — annuncio e ritmo devono
  // concordare, quindi la mappa è una sola (game/engine/combat/replay.ts).
  const firstFireAt = useMemo(() => firstDuoFireFrames(replay.frames), [replay.frames])

  const firingId = entry?.duoId ?? null
  // L'annuncio grosso col nome SOLO al primo scatto; dopo, la pill lampeggia e basta.
  const duoName = firingId && firstFireAt.get(firingId) === frameKey
    ? (DUO_BY_ID[firingId]?.name ?? null)
    : null

  const left = useMemo(() => replay.units.filter(u => u.side === 'left'), [replay.units])
  const right = useMemo(() => replay.units.filter(u => u.side === 'right'), [replay.units])

  const anyAction = !!actingKey
  const renderSide = (units: ReplayUnit[], mirrored: boolean) =>
    units.map(u => {
      const involved = u.key === actingKey || u.key === targetKey
      const acting = u.key === actingKey
      const targeted = u.key === targetKey
      const dead = (hp[u.key] ?? 0) <= 0
      const drafted = toDrafted(u)
      const skipping = u.key === skipKey ? skipKind : null
      // The motion this frame's scene puts on THIS card, if any: strike when it's the
      // actor, kick/kickBig/swerve/fall when it's the target. `key={frameKey}` on the
      // wrapper (below) remounts the class so a repeated kind (e.g. two hits in a row)
      // restarts the CSS animation instead of no-opping on an unchanged className.
      const cardMotion = u.key === sceneEvent.actorKey ? motion?.actor
        : u.key === sceneEvent.targetKey ? motion?.target
          : undefined
      return (
        <div
          key={u.key}
          data-unit-key={u.key}
          data-testid="battle-unit"
          className="relative w-[31%] max-w-[300px] shrink-0 transition-opacity duration-200"
          style={{ opacity: anyAction && !involved ? 0.45 : 1 }}
        >
          {/* Il lato si legge dal COLORE della cornice: senza, le sei carte sono
              identiche e in mezzo a uno scontro bisogna ricordare quale fila è
              quale. Rosso i nemici, verde i tuoi — gli stessi colori che il gioco
              usa già per i danni inflitti e subiti. Sovrascrive il filo di rarità
              solo qui, in battaglia, dove sapere chi è chi conta più del tier. */}
          <div key={cardMotion ? `${frameKey}-motion` : 'still'} className={cardMotion}>
            <WizardCard
              drafted={drafted}
              density="combat"
              currentHp={Math.max(0, hp[u.key] ?? 0)}
              portraitHeight={portraitHeight}
              style={{
                background: mirrored ? 'rgba(240,114,114,.55)' : 'rgba(124,220,125,.45)',
                // `p-px` della carta rende la cornice un filo da 1px: al 42% di alpha
                // la tinta di lato era invisibile e si perdeva il tier senza guadagnare
                // nulla. 2px pieni bastano a leggere il lato da lontano.
                padding: 2,
              }}
              className={cn(
                dead && 'grayscale opacity-60',
                acting && 'ring-2 ring-[#7cfc9b] shadow-[0_0_22px_rgba(124,252,155,0.55)]',
                targeted && !acting && 'ring-2 ring-rose-400 shadow-[0_0_22px_rgba(255,107,107,0.6)]',
              )}
            />
          </div>
          <StatusPips effects={statusEffects[u.key] ?? []} />
          {targeted && !!float && !dead && (
            <span
              data-testid="damage-float"
              className={cn(
                'pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 select-none font-display text-sm font-bold tabular-nums drop-shadow',
                float.tone === 'crit' ? 'text-amber-300 text-lg' : float.tone === 'heal' ? 'text-emerald-300'
                  : float.tone === 'dot' ? 'text-green-300' : float.tone === 'dodge' ? 'text-white/70 text-[11px] uppercase tracking-wider' : 'text-rose-300',
              )}
            >
              {float.text}
            </span>
          )}
          {dead && (
            <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">
              Morto
            </span>
          )}
          {skipping && (
            <span
              data-skipping={skipping}
              className={cn(
                'pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[15px] bg-black/35',
              )}
            >
              <span className={cn('font-display text-[13px] font-extrabold uppercase tracking-wide -rotate-3 rounded px-2 py-1 text-black',
                skipping === 'freeze' ? 'bg-cyan-300' : 'bg-yellow-300')}>
                SALTA
              </span>
            </span>
          )}
        </div>
      )
    })

  return (
    <div data-testid="battle-arena" className="relative mx-auto flex w-full max-w-5xl flex-col items-stretch gap-1 rounded-3xl px-2 py-1">
      <ArenaBackdrop />
      <DuoPills duos={duos} firingId={firingId} />
      {telegraph && (
        <div
          key={`tg-${frameKey}`}
          data-testid="boss-telegraph"
          className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-500/50 bg-black/85 px-4 py-1.5 text-xs font-semibold text-rose-200 motion-safe:animate-pulse sm:text-sm"
          style={{ boxShadow: '0 0 26px rgba(224,90,74,.45)' }}
        >
          ⚠ {telegraph.name} sta caricando {telegraph.spell}…
        </div>
      )}
      {/* Campo contro campo: nemici sopra, squadra sotto, affacciate — la riga
          dell'azione in corso sta fra le due file. I titoli di riga (prima due
          <h3> "Avversari"/"La tua squadra") sono stati tolti: ridondanti con la
          disposizione stessa (nemici sempre sopra) e con l'intestazione della
          schermata, e nel budget fisso di 768px ogni riga di testo pesa. */}
      <section aria-label={rightTitle} className="flex w-full flex-col items-center">
        {/* La larghezza fissa sta sul WRAPPER di ogni unità (vedi renderSide), non
            sulla carta: senza, ognuna si dimensionava sul proprio contenuto — un nome
            lungo la allargava — e le due file non erano allineate (misurato: da 210 a
            290px nella stessa fila). Metterla sulla CARTA invece che sul wrapper la
            stringe e ne manda a capo il contenuto, facendola crescere in ALTEZZA:
            provato, l'arena passava da 1063px e tre unità uscivano dallo schermo. */}
        <div data-testid="row-enemies" className="flex flex-nowrap justify-center gap-2">{renderSide(right, true)}</div>
      </section>

      <div className="flex w-full items-center justify-center self-center">
        {center ?? <span className="font-display text-2xl text-white/30 select-none">VS</span>}
      </div>

      <section aria-label={leftTitle} className="flex w-full flex-col items-center">
        <div data-testid="row-player" className="flex flex-nowrap justify-center gap-2">{renderSide(left, false)}</div>
      </section>

      <PixiArena entry={entry} frameKey={frameKey} speed={speed} intensity={intensity} />
      <Callout entry={entry} frameKey={frameKey} appliedControl={appliedControl} duoName={duoName} />
      {/* Il livello degli effetti: un numero/parola per OGNI evento del motore
          (sceneEventOf non ha mai `null`, solo `kind: 'none'` quando SceneFx non
          disegna nulla). `frameKey` come key rimonta l'intero layer a ogni
          fotogramma così un evento ripetuto (due colpi identici di fila)
          riparte da capo invece di restare fermo sull'animazione già finita. */}
      <SceneFx key={frameKey} event={sceneEvent} frameKey={frameKey} actorBox={boxes.actor} targetBox={boxes.target} />
    </div>
  )
}
