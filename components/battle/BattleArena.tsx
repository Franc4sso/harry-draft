'use client'
import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogEntry, ActiveEffect, ActiveDuo } from '@/types'
import type { Replay, ReplayUnit } from '@/game/engine/combat/replay'
import { firstDuoFireFrames, unitKey } from '@/game/engine/combat/replay'
import { lastRealEntryAt } from '@/lib/initiative'
import { CartaCombat } from './CartaCombat'
import { NastroSigilli } from './NastroSigilli'
import { ColpoSullaCarta } from './ColpoSullaCarta'
import { ArenaBackdrop } from './ArenaBackdrop'
import { PixiArena } from './PixiArena'
import { Callout } from './Callout'
import { SigilloDuo } from './SigilloDuo'
import { LegendaBersagli } from './LegendaBersagli'
import { cn } from '@/lib/theme'
import { DUO_BY_ID } from '@/data/duos'
import { SPELL_BY_ID } from '@/data/spells'
import { STATUS_BY_ID } from '@/data/statuses'
import { sceneEventOf, type SceneKind } from '@/lib/battleScene'
import '@/components/battle/vetrata.css'

/** Big/ultimate enemy spells worth warning the player about a beat before they land. */
const BIG_SPELLS = new Set([
  'Avada Kedavra', 'Ardemonio', 'Sectumsempra', 'Bombarda', 'Reducto', 'Confringo', 'Crucio',
])

/** Which `fx-*` motion class (battleAnim.css) lands on the ACTOR's and the TARGET's own
 *  card for a given scene, so the card itself lunges/recoils/staggers — not just the
 *  floating number over it. Mirrors SceneFx's internal (unexported) `specFor` table for the
 *  cases the brief calls out by name: strike on the actor, kick/kickBig on the target,
 *  swerve for a dodge, shiver for a skipped turn, fall for a kill. */
/** Larghezza delle colonne laterali, in unita' della cornice 1366. Le carte
 *  occupano il centro; questo e' lo spazio che il piano tiene libero ai lati e
 *  che ora ospita le due legende. 150 e non 120: misurato a schermo, a 120 la
 *  legenda dei bersagli sbordava di 39px SOPRA la carta di bordo, illeggibile. */
const COL_W = 150

function ColonnaCombo({ titolo, duos, firingId }: { titolo: string; duos: ActiveDuo[]; firingId: string | null }) {
  if (duos.length === 0) return <div />
  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-center text-[7px] font-extrabold uppercase leading-tight tracking-[.18em]" style={{ color: 'var(--vg-gold, #b8963f)' }}>
        {titolo}
      </h3>
      {duos.map(active => (
        <SigilloDuo key={active.duo.id} active={active} firing={active.duo.id === firingId} />
      ))}
    </div>
  )
}

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
 * La scena — mockup "La vetrata e gli incantesimi" (variante B, Vetrata:
 * https://claude.ai/artifact/PNqfY2yLXxHiY4ziu6QsUq). Dieci `CartaCombat` complete, in due
 * file da cinque, con il nastro dei sigilli al centro. REPLACES the previous "due
 * duellanti grandi + quattro miniature" staging (Task 3, "il palco"): il giocatore ha
 * visto quella versione a schermo e l'ha respinta — «in modalità teatro non si capisce
 * tanto cosa funziona, forse era meglio prima» — perché con CINQUE maghi per lato il
 * campo si perdeva. Questa composizione torna a tutte le carte, della stessa taglia,
 * sempre visibili.
 *
 * Misure dal mockup (frame 1366×768): carta 212×254, fila da x=135, passo 221, nemici a
 * y=46, alleati a y=510, nastro a y=316 alto 180. Convertite in PERCENTUALI del box di
 * questo componente (non pixel fissi): la cornice reale non è sempre 1366×768 (brief).
 */
export function BattleArena({
  replay, hp, entry, frameKey = 0, leftTitle = 'La tua squadra', rightTitle = 'Avversari', enemyLevel = 1, speed = 1, duos = [], enemyDuos = [], intensity = 0, portraitHeight = 118,
}: {
  replay: Replay
  hp: Record<string, number>
  entry: LogEntry | null
  frameKey?: number
  leftTitle?: string
  rightTitle?: string
  /** Level shown on every enemy card (menace was removed 2026-07-01). Players use their own. */
  enemyLevel?: number
  /** Replay playback speed — feeds the Pixi VFX layer's time budget. */
  speed?: number
  /** Duo attivi del giocatore in questa battaglia (player-only). */
  duos?: ActiveDuo[]
  /** I Duo del lato nemico. Vuoto se la squadra avversaria non ne accende. */
  enemyDuos?: ActiveDuo[]
  /** Crescendo: calore del combattimento 0..1, amplifica i layer cinematici. Vedi `lib/vfx/crescendo.ts`. */
  intensity?: number
  /** Unused by this composition (every card renders at the mockup's fixed 212×254, not a
   *  fed height) — kept for signature compatibility, BattleScreen still passes it. */
  portraitHeight?: number
}) {
  void portraitHeight

  // Una riga di sistema marchiata da un Duo non ha un vero "attore che agisce": MIASMA la attribuisce
  // al CADAVERE che contagia (giusto nel log, ma in arena accenderebbe l'aura "sta agendo" su un morto),
  // e le altre (KO del Mietitore, sputo dell'Untore) sono conseguenze passive, non azioni. Su questi
  // frame l'evidenziazione dell'attore resta spenta: parlano il ribbon e l'annuncio.
  const duoSystemFrame = !!entry?.duoId && entry.type === 'system'
  // A frame Stordito (type system, action 'Stordito') is a SKIPPED turn, not an action: the
  // engine emits it on the dedicated frame that covers every control gating 'action' (stun,
  // freeze, ...). The "sta agendo" ribbon must NOT light up here — it was misleading (the
  // skipped unit looked like it was acting).
  const skipFrame = entry?.type === 'system' && entry.action === 'Stordito'
  const actingKey = entry?.actorSide && !duoSystemFrame && !skipFrame ? unitKey(entry.actorSide, entry.actorId) : null
  const targetKey = entry?.targetSide && entry.targetId ? unitKey(entry.targetSide, entry.targetId) : null
  const frame = replay.frames[frameKey]
  const statusEffects = frame?.statusEffects ?? {}

  // The unit that's skipping THIS frame (stunned/frozen) — flashes "SALTA". Read from
  // its OWN statusEffects this frame (the log entry only carries the generic 'stun'
  // flag; the flash should say CONGELATO's kind too).
  const skipKey = skipFrame && entry?.actorSide ? unitKey(entry.actorSide, entry.actorId) : null
  const skipKind: 'stun' | 'freeze' | null = skipKey
    ? (statusEffects[skipKey]?.some((e: ActiveEffect) => e.kind === 'freeze') ? 'freeze' : 'stun')
    : null

  // The scene this frame must show, per lib/battleScene.ts: pure function of this frame and
  // the one before it (status gained/lost is a DIFF between the two). «Ogni evento del motore
  // deve avere una scena» — this feeds both ColpoSullaCarta and the actor/target motion
  // classes on the cards themselves.
  const prevFrame = replay.frames[frameKey - 1]
  const sceneEvent = useMemo(() => sceneEventOf(frame ?? replay.frames[0]!, prevFrame), [frame, prevFrame, replay.frames])
  const motion = MOTION_BY_KIND[sceneEvent.kind]

  // Chi porta il ribbon LANCIA/COLPITA e la cornice ruolo: l'attore/bersaglio di QUESTO
  // frame, o — sui frame di sistema (veleno che ticchetta, un Duo che scatta, uno
  // stordimento) che non hanno un vero attore/bersaglio proprio — quelli dell'ULTIMA azione
  // vera (stesso principio della corsia dei turni, che tiene evidenziato l'ultimo attore
  // reale finché non ne arriva uno nuovo). Il ruolo non si spegne mai a metà battaglia:
  // senza questo fallback ogni tick di stato spegnerebbe il ribbon, che è la maggioranza
  // dei frame di una battaglia lunga.
  const lastReal = useMemo(() => lastRealEntryAt(replay, frameKey), [replay, frameKey])
  // Il fallback vale per attore e bersaglio INDIPENDENTEMENTE: uno Stordito ha un attore
  // proprio (l'unità che salta) ma nessun bersaglio (il motore non ne emette uno per
  // questa azione — game/engine/combat/simulate.ts), quindi il ruolo attore mostra
  // l'unità che sta saltando mentre il bersaglio tiene quello dell'ultima azione vera.
  const stageActorSrc = entry?.actorSide ? entry : lastReal
  const stageTargetSrc = entry?.targetSide && entry.targetId ? entry : lastReal
  const stageActorKey = stageActorSrc?.actorSide ? unitKey(stageActorSrc.actorSide, stageActorSrc.actorId) : null
  const stageTargetKey = stageTargetSrc?.targetSide && stageTargetSrc.targetId ? unitKey(stageTargetSrc.targetSide, stageTargetSrc.targetId) : null

  // ColpoSullaCarta ha bisogno del riquadro (in coordinate della cornice 1366×768) della
  // carta colpita: lo misura dal DOM reale, stesso pattern che PixiArena usa per i suoi
  // ancoraggi VFX (`document.querySelector('[data-unit-key=...]')` + getBoundingClientRect),
  // riportato in coordinate-frame tramite il rect del box della scena stessa (frameRef).
  const frameRef = useRef<HTMLDivElement>(null)
  const [struckBox, setStruckBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useEffect(() => {
    const frameEl = frameRef.current
    const key = sceneEvent.targetKey ?? targetKey ?? stageTargetKey
    if (!frameEl || !key) { setStruckBox(null); return }
    const cardEl = frameEl.querySelector(`[data-testid="carta-combat"][data-unit-key="${CSS.escape(key)}"]`)
    if (!cardEl) { setStruckBox(null); return }
    const f = frameEl.getBoundingClientRect()
    const c = cardEl.getBoundingClientRect()
    if (f.width === 0 || f.height === 0) { setStruckBox(null); return }
    // ColpoSullaCarta's own geometry (FRAME_W/HALF_CLAMP) is expressed against the mockup's
    // 1366px-wide frame — scale the measured box into that same coordinate space so the
    // clamp holds regardless of the real rendered size.
    const scale = 1366 / f.width
    setStruckBox({
      x: (c.left - f.left) * scale,
      y: (c.top - f.top) * scale,
      w: c.width * scale,
      h: c.height * scale,
    })
  }, [frameKey, sceneEvent.targetKey, targetKey, stageTargetKey])

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

  // La motion (fx-strike/fx-kick/...) è ancorata all'attore/bersaglio DI QUESTO frame
  // (`sceneEvent`), non al fallback di ruolo: su un tick di veleno la carta resta al suo
  // posto ma non si lancia né arretra, l'animazione parte solo quando c'è un vero evento.
  const actorMotion = stageActorKey && stageActorKey === sceneEvent.actorKey ? motion?.actor : undefined
  const targetMotion = stageTargetKey && stageTargetKey === sceneEvent.targetKey ? motion?.target : undefined

  // `lib/battleStacks.ts`'s `familyOf` (pure, approved, out of scope for this task) resolves
  // an effect by `e.statusId ?? e.kind` and THROWS on anything it can't map to a catalogue
  // entry — a deliberate fail-fast from Task 1, contained app-wide by `app/error.tsx`. But
  // `game/engine/status.ts`'s `applyInlineEffect` (a REAL, live engine path — stat buffs/
  // debuffs from on-hit/Controllo spells, e.g. Bellatrix's weaken) pushes `ActiveEffect`s
  // with `kind:'buff'|'debuff'` and NO `statusId` at all: `familyOf` then gets handed the
  // literal string "buff"/"debuff" as if it were a catalogue id, which isn't in
  // `data/statuses.ts` (ids are `slow`, `weaken1`, …) — so it throws on genuinely ordinary
  // gameplay, not just a crafted fixture. Reproduced directly: a real 5v5 `simulateBattle`
  // with seed 42 already carries this exact effect on `left:ron` by frame 2 (Bellatrix's
  // weaken1, no `statusId`). Composing `CartaCombat` into the live scene is what newly
  // exposes this — `Duellante`/`Miniatura` (the composition this task replaces) never called
  // `pilloleDi`/`auraDi` at all. `battleStacks.ts`/`CartaCombat.tsx` are both frozen for this
  // task, so the fix lives here, at the boundary: drop only the effects `familyOf` cannot
  // resolve (mirroring its own resolvable-id rule) before they reach the card, instead of
  // letting one unmapped inline effect blank the whole scene. Effects WITH a valid id (the
  // vast majority — every statusId-bearing DoT/control/shield) still render exactly as
  // before; this narrows only the unmapped inline-buff/debuff case. Flagged in the task
  // report as a real gap for the next review, not silently absorbed.
  const safeEffects = (effs: ActiveEffect[]): ActiveEffect[] =>
    effs.filter(e => {
      const id = e.statusId ?? e.kind
      return id === 'burn' || id === 'veleno' || !!STATUS_BY_ID[id]
    })

  const renderRow = (units: ReplayUnit[]) =>
    units.map(u => {
      const dead = (hp[u.key] ?? 0) <= 0
      const ruolo: 'attore' | 'bersaglio' | null =
        u.key === stageActorKey ? 'attore' : u.key === stageTargetKey ? 'bersaglio' : null
      const cardMotion = ruolo === 'attore' ? actorMotion : ruolo === 'bersaglio' ? targetMotion : undefined
      const skipping = u.key === skipKey ? skipKind : null
      const spellDef = SPELL_BY_ID[u.spell.id]
      return (
        <div key={u.key} className="relative">
          {ruolo === 'attore' && <span className="tab-lancia">◆ LANCIA</span>}
          {ruolo === 'bersaglio' && <span className="tab-colpita">✖ COLPITA</span>}
          <CartaCombat
            // `key={cardMotion ? ... }` remounts the class so a repeated kind (two hits in a
            // row) restarts the CSS animation instead of no-opping on an unchanged className.
            key={cardMotion ? `${frameKey}-motion` : 'still'}
            unit={u}
            hp={Math.max(0, hp[u.key] ?? 0)}
            maxHp={u.maxHp}
            effects={safeEffects(statusEffects[u.key] ?? [])}
            spell={spellDef ? { name: spellDef.name, type: spellDef.type } : undefined}
            level={u.side === 'left' ? u.level : enemyLevel}
            ruolo={ruolo}
            stato={dead ? 'caduto' : 'vivo'}
            className={cardMotion}
          />
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
    })

  return (
    // `max-w-6xl` (1152px) teneva la scena a francobollo: su 1920 e su 2560 la
    // cornice restava identica, con vuoto intorno. Ora il tetto e' l'ALTEZZA
    // disponibile, non una costante: `calc(var(--arena-h) * 1366 / 768)` e' la
    // larghezza massima che la cornice puo' avere senza che la sua altezza (in
    // rapporto 1366:768) sfori lo spazio verticale. Cosi' su uno schermo alto la
    // scena cresce davvero, e su uno basso si restringe da sola invece di essere
    // tagliata — che era il difetto di partenza.
    <div
      data-testid="battle-arena"
      className="vetrata-world relative mx-auto w-full overflow-visible rounded-3xl"
      style={{ maxWidth: 'calc(var(--arena-h, 648px) * 1366 / 768)' }}
    >
      <ArenaBackdrop />
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

      {/* La cornice: 1366×768 nel mockup, tenuta in proporzione — non in pixel fissi —
          perché la cornice reale non è sempre quella (brief). Le due file di dieci carte e
          il nastro sono posizionati in percentuale DI QUESTO box. */}
      {/* `containerType: 'inline-size'` fa di questa cornice il RIFERIMENTO delle
          unita' `cqw` con cui la carta si misura (vetrata.css). Senza, la carta
          tornerebbe a misure fisse e la fila alleata uscirebbe di nuovo: la
          cornice e' in proporzione (1366/768 sotto `max-w-6xl`, quindi alta 648px
          reali) mentre la carta era disegnata 212x254 per una cornice da 768 —
          due file da 254 piu' il nastro non entrano in 648, e sforavano di 36px
          a OGNI risoluzione (misurato a 1366, 1920 e 2560). */}
      <div
        ref={frameRef}
        data-testid="stage"
        className="relative w-full"
        style={{ aspectRatio: '1366 / 768', containerType: 'inline-size' }}
      >
        <div data-testid="col-enemies" aria-label={rightTitle} className="absolute flex justify-center gap-[1.6%]" style={{ left: `${(COL_W / 1366) * 100}%`, right: `${(COL_W / 1366) * 100}%`, top: `${(46 / 768) * 100}%`, containerType: 'inline-size' }}>
          {renderRow(right)}
        </div>

        <div
          data-testid="nastro-wrap"
          className="absolute inset-x-0"
          style={{ top: `${(316 / 768) * 100}%`, height: `${(180 / 768) * 100}%` }}
        >
          {/* 2026-09-16 (Task 6): qui sopra il nastro c'era `stage-center`, che a z-20
              sovrapponeva il `center` (l'ActionPanel) al riquadro di fuoco. I due
              dicevano la stessa cosa — chi lancia, cosa, su chi — e a schermo si
              leggevano accavallati. Il fuoco del nastro e' la forma del mockup
              approvato, quindi resta lui. La prop `center` e' RIMOSSA del tutto
              invece che lasciata inerte: una prop che accetta un nodo e lo butta
              via in silenzio e' peggio di una prop assente — il test che la
              copriva sarebbe rimasto verde senza piu' coprire nulla. */}
          <NastroSigilli replay={replay} index={frameKey} className="h-full" />
        </div>

        <div data-testid="col-allies" aria-label={leftTitle} className="absolute flex justify-center gap-[1.6%]" style={{ left: `${(COL_W / 1366) * 100}%`, right: `${(COL_W / 1366) * 100}%`, top: `${(510 / 768) * 100}%`, containerType: 'inline-size' }}>
          {renderRow(left)}
        </div>

        {/* Le due legende vivono nelle COLONNE LATERALI, che il piano tiene libere
            per vincolo ("niente occupa le colonne laterali"): misurate 120px per
            lato, simmetriche. Stanno DENTRO lo stage, quindi seguono la cornice
            quando cresce invece di restare ancorate al viewport.

            A sinistra le combo: erano pill impilate una sotto l'altra — «vedere le
            combo una sotto l'altra in un elenco, sono veramente brutte» — e ora
            sono sigilli divisi nei due segnali che le generano, coi colori che il
            resto del gioco usa gia' per quei segnali.

            A destra il "chi attacca chi", che legge `TARGET_REASON_LABEL` (la
            stessa fonte di `explainTarget`) e accende la riga della ragione del
            turno corrente. */}
        {(duos.length > 0 || enemyDuos.length > 0) && (
          <div
            data-testid="col-combo"
            className="pointer-events-none absolute inset-y-0 z-20 flex flex-col justify-between py-[5%]"
            style={{ left: 0, width: `${(COL_W / 1366) * 100}%` }}
          >
            {/* Le combo NEMICHE in alto, accanto alla loro fila; le mie in basso,
                accanto alla mia. Prima non c'erano affatto — «non vedo le combo dei
                miei avversari, se li hanno» — perche' il motore non le assegnava mai
                al lato destro. Ora le ha, quindi vanno mostrate dalla parte giusta:
                metterle tutte insieme direbbe che sono mie. */}
            <ColonnaCombo titolo="Combo nemiche" duos={enemyDuos} firingId={firingId} />
            <ColonnaCombo titolo="Le tue combo" duos={duos} firingId={firingId} />
          </div>
        )}

        <LegendaBersagli
          attiva={entry?.reason ?? null}
          className="absolute top-[6%] z-20"
          style={{ right: 0, width: `${(COL_W / 1366) * 100}%` }}
        />

        <PixiArena entry={entry} frameKey={frameKey} speed={speed} intensity={intensity} />
        <ColpoSullaCarta event={sceneEvent} frameKey={frameKey} box={struckBox} />
      </div>

      <Callout entry={entry} frameKey={frameKey} appliedControl={appliedControl} duoName={duoName} />
    </div>
  )
}
