'use client'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { LogEntry, ActiveEffect, ActiveDuo } from '@/types'
import type { Replay, ReplayUnit } from '@/game/engine/combat/replay'
import { firstDuoFireFrames, unitKey } from '@/game/engine/combat/replay'
import { lastRealEntryAt } from '@/lib/initiative'
import { Duellante } from './Duellante'
import { Miniatura } from './Miniatura'
import { ArenaBackdrop } from './ArenaBackdrop'
import { PixiArena } from './PixiArena'
import { Callout } from './Callout'
import { DuoPills } from './DuoPills'
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
 * The stage — "La corsia del tempo" mockup v11: two large duellants centre stage (the
 * unit acting and the one it targets), the other four wizards reduced to side miniatures,
 * three per side, in the stable order of `replay.units`. This REPLACES the previous
 * "six combat cards in two facing rows" composition (Task 10, superseded): that layout
 * read as six identical cards and — per the user's verdict on the shipped result — "fa
 * totalmente schifo". The mockup's actual idea (portrait-scale focus on who's dueling
 * right now) never reached that implementation; this task is that missing piece.
 *
 * Percentages below are the mockup's absolute pixel geometry (1366×768 frame) converted
 * to proportions of this component's own box, so the layout holds at any rendered size —
 * the brief is explicit that the real frame is not always exactly 1366×768.
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
  /** Unused by the stage itself (the duellant portrait is fixed at mockup scale, not
   *  fed a height) — kept for signature compatibility, BattleScreen still passes it. */
  portraitHeight?: number
}) {
  // enemyLevel/portraitHeight are no longer read by the stage (the duellante portrait is
  // fixed at mockup scale, not fed a height, and menace/level badges aren't part of this
  // composition) — kept only for signature compatibility, since BattleScreen still passes
  // them and the brief requires BattleArena's public signature to stay unchanged.
  void enemyLevel; void portraitHeight

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

  // Chi va IN SCENA come duellante grande: l'attore/bersaglio di QUESTO frame, o — sui frame
  // di sistema (veleno che ticchetta, un Duo che scatta, uno stordimento) che non hanno un
  // vero attore/bersaglio proprio — quelli dell'ULTIMA azione vera (stesso principio della
  // corsia dei turni, che tiene evidenziato l'ultimo attore reale finché non ne arriva uno
  // nuovo). La scena non si svuota mai: senza questo fallback i due riquadri grandi
  // resterebbero vuoti a ogni tick di stato, che è la maggioranza dei frame di una battaglia
  // lunga.
  const lastReal = useMemo(() => lastRealEntryAt(replay, frameKey), [replay, frameKey])
  // Il fallback vale per attore e bersaglio INDIPENDENTEMENTE: uno Stordito ha un attore
  // proprio (l'unità che salta) ma nessun bersaglio (il motore non ne emette uno per
  // questa azione — game/engine/combat/simulate.ts), quindi il duellante attore mostra
  // l'unità che sta saltando mentre il bersaglio tiene quello dell'ultima azione vera:
  // niente slot vuoto, la scena non si svuota mai su NESSUNO dei due lati.
  const stageActorSrc = entry?.actorSide ? entry : lastReal
  const stageTargetSrc = entry?.targetSide && entry.targetId ? entry : lastReal
  const stageActorKey = stageActorSrc?.actorSide ? unitKey(stageActorSrc.actorSide, stageActorSrc.actorId) : null
  const stageTargetKey = stageTargetSrc?.targetSide && stageTargetSrc.targetId ? unitKey(stageTargetSrc.targetSide, stageTargetSrc.targetId) : null

  // SceneFx positions its number over the acting/target card by their live on-screen rect.
  // Same DOM-measurement pattern PixiArena already uses for its own VFX anchors
  // (`document.querySelector('[data-unit-key=...]')` + getBoundingClientRect) — re-measured
  // every frame since cards can move (dead units grey out/shrink motion, but not layout here).
  //
  // `data-unit-key` now appears TWICE in the DOM for a unit on stage: once on its big
  // `Duellante`, once on its dimmed side `Miniatura`. A first-match `querySelector` would
  // silently resolve to whichever rendered first — landing effects on the 84×104 miniature
  // instead of the 420×376 duellante. `boxOf` below always prefers the duellante and only
  // falls back to the generic selector when the unit isn't currently staged.
  const [boxes, setBoxes] = useState<{ actor: DOMRect | null; target: DOMRect | null }>({ actor: null, target: null })
  useEffect(() => {
    const boxOf = (key: string | null) => {
      if (!key) return null
      const el = document.querySelector(`[data-testid="duellante"][data-unit-key="${CSS.escape(key)}"]`)
        ?? document.querySelector(`[data-unit-key="${CSS.escape(key)}"]`)
      return el ? el.getBoundingClientRect() : null
    }
    setBoxes({
      actor: boxOf(sceneEvent.actorKey ?? actingKey ?? stageActorKey),
      target: boxOf(sceneEvent.targetKey ?? targetKey ?? stageTargetKey),
    })
  }, [frameKey, sceneEvent.actorKey, sceneEvent.targetKey, actingKey, targetKey, stageActorKey, stageTargetKey])

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

  const stageActor = replay.units.find(u => u.key === stageActorKey) ?? null
  const stageTarget = replay.units.find(u => u.key === stageTargetKey) ?? null

  // La motion (fx-strike/fx-kick/...) è ancorata all'attore/bersaglio DI QUESTO frame
  // (`sceneEvent`), non al fallback di sistema: su un tick di veleno il duellante resta
  // in scena ma non si lancia né arretra, l'animazione parte solo quando c'è un vero evento.
  const actorMotion = stageActorKey && stageActorKey === sceneEvent.actorKey ? motion?.actor : undefined
  const targetMotion = stageTargetKey && stageTargetKey === sceneEvent.targetKey ? motion?.target : undefined

  const renderMinis = (units: ReplayUnit[]) =>
    units.map(u => {
      const dead = (hp[u.key] ?? 0) <= 0
      const dimmed = u.key === stageActorKey || u.key === stageTargetKey
      return (
        <Miniatura
          key={u.key}
          unit={u}
          hp={Math.max(0, hp[u.key] ?? 0)}
          maxHp={u.maxHp}
          effects={statusEffects[u.key] ?? []}
          dimmed={dimmed}
          dead={dead}
        />
      )
    })

  const renderDuellante = (u: ReplayUnit | null, role: 'attore' | 'bersaglio') => {
    if (!u) return null
    const dead = (hp[u.key] ?? 0) <= 0
    const cardMotion = role === 'attore' ? actorMotion : targetMotion
    const skipping = u.key === skipKey ? skipKind : null
    return (
      <div
        key={`${u.key}-${role}`}
        data-testid={`stage-${role}`}
        className="relative"
        style={{
          position: 'absolute',
          left: role === 'attore' ? '4.9%' : '58.3%',
          top: '8.4%',
          width: '36.8%',
          height: '83.2%',
        }}
      >
        {/* `key={cardMotion ? ... }` remounts the class so a repeated kind (two hits in a
            row) restarts the CSS animation instead of no-opping on an unchanged className —
            same trick the previous two-row layout used. The motion class goes straight onto
            `Duellante`'s own root via `className` (merged there with `cn`), not a wrapper
            around it: `Duellante` is the element carrying `data-testid="duellante"` +
            `data-unit-key`, and SceneFx/PixiArena's box measurement + these tests' DOM
            queries all resolve to THAT element — a class on an outer wrapper wouldn't be a
            *descendant* match for `.querySelector('.fx-strike')` run against it.

            FIX ROUND 1 (review): `Duellante`'s own 420×376 mockup size now lives in its
            default `style` (see Duellante.tsx), not in a Tailwind class — so `h-full w-full`
            here alone would lose to that inline default (inline `style` always beats a
            class, regardless of stylesheet order). Passing `style={{height:'100%',
            width:'100%'}}` explicitly overrides it, deterministically: this stage slot needs
            the duellante to fill its percentage-sized container, not the fixed mockup size. */}
        <Duellante
          key={cardMotion ? `${frameKey}-motion` : 'still'}
          unit={u}
          hp={Math.max(0, hp[u.key] ?? 0)}
          maxHp={u.maxHp}
          role={role}
          effects={statusEffects[u.key] ?? []}
          dead={dead}
          className={cardMotion}
          style={{ height: '100%', width: '100%' }}
        />
        {role === 'bersaglio' && !!float && !dead && (
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
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[13px] bg-black/35"
          >
            <span className={cn('font-display text-[13px] font-extrabold uppercase tracking-wide -rotate-3 rounded px-2 py-1 text-black',
              skipping === 'freeze' ? 'bg-cyan-300' : 'bg-yellow-300')}>
              SALTA
            </span>
          </span>
        )}
      </div>
    )
  }

  return (
    <div data-testid="battle-arena" className="relative mx-auto grid w-full max-w-6xl grid-cols-[84px_1fr_84px] items-start gap-2 rounded-3xl px-2 py-1">
      {/* `grid` + `grid-cols-[84px_1fr_84px]`, NOT `flex` + `items-stretch`: a flex row's
          `items-stretch` forces the stage's height to match the row's cross-axis size —
          which defeats `aspect-ratio` on the stage entirely, since aspect-ratio only sizes
          an axis that's otherwise free. A CSS grid row instead sizes itself to its tallest
          item's OWN content height (the stage's aspect-ratio counts as that), and only then
          stretches the shorter siblings (the two mini columns) to match — which is exactly
          "the columns share the stage's height", the effect we actually want. */}
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

      {/* Colonna sinistra: le tre miniature nemiche — nel mockup a x18, sopra x112 dove
          inizia il palco, quindi FUORI dalla scena grande, sul suo stesso fianco. */}
      <div data-testid="col-enemies" aria-label={rightTitle} className="flex flex-col justify-between py-[3.5%]">
        {renderMinis(right)}
      </div>

      {/* Il palco: 1142×452 nel mockup. I due duellanti (attore a sinistra, bersaglio a
          destra — `#actor`/`#target`) sono posizionati in percentuale DI QUESTO box, non
          in pixel fissi, perché la cornice reale non è sempre 1366×768 (brief). Lo slot
          centrale (`center`) ospita l'etichetta incantesimo/ActionPanel, alla posizione
          del mockup (spell label: left 600, top 236, width 166 — coordinate assolute nel
          frame 1366×768). FIX ROUND 1 (review): top/width erano percentuali del FRAME
          (236/768=30.7%, 166/1366=12.2%) invece che del box `.stage` stesso (top 46,
          altezza 452 — left 112, larghezza 1142): il denominatore giusto è la dimensione
          dello stage, non quella del frame intero, perché questi due div sono posizionati
          `absolute` dentro lo stage, non dentro il frame. Ricalcolati: top =
          (236−46)/452 = 42.0%, width = 166/1142 = 14.5%. */}
      <div data-testid="stage" className="relative min-w-0 overflow-visible rounded-[15px] border border-[rgba(202,162,74,.3)]" style={{ aspectRatio: '1142 / 452' }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[15px]"
          style={{
            background: 'radial-gradient(74% 92% at 50% 16%, rgba(202,162,74,.14), transparent 64%), linear-gradient(180deg, #181433, #0b0917)',
          }}
        />

        {renderDuellante(stageActor, 'attore')}
        {renderDuellante(stageTarget, 'bersaglio')}

        <div
          data-testid="stage-center"
          className="pointer-events-none absolute z-10 -translate-x-1/2 text-center"
          style={{ left: '50%', top: '42.0%', width: '14.5%', minWidth: 140 }}
        >
          {center}
        </div>

        <PixiArena entry={entry} frameKey={frameKey} speed={speed} intensity={intensity} />
        {/* Il livello degli effetti: un numero/parola per OGNI evento del motore
            (sceneEventOf non ha mai `null`, solo `kind: 'none'` quando SceneFx non
            disegna nulla). `frameKey` come key rimonta l'intero layer a ogni
            fotogramma così un evento ripetuto (due colpi identici di fila)
            riparte da capo invece di restare fermo sull'animazione già finita. */}
        <SceneFx key={frameKey} event={sceneEvent} frameKey={frameKey} actorBox={boxes.actor} targetBox={boxes.target} />
      </div>

      {/* Colonna destra: le tre miniature alleate. */}
      <div data-testid="col-allies" aria-label={leftTitle} className="flex flex-col justify-between py-[3.5%]">
        {renderMinis(left)}
      </div>

      <Callout entry={entry} frameKey={frameKey} appliedControl={appliedControl} duoName={duoName} />
    </div>
  )
}
