import '@/components/battle/battleAnim.css'
import type { SceneEvent, SceneKind } from '@/lib/battleScene'

/**
 * The effects layer: one visible scene per `SceneKind`, so a crit, a dodge, an
 * absorbed hit and a skipped turn never look the same. Built to satisfy the
 * event→visual table in the Task 4 brief and match "La corsia del tempo"
 * (mockup v11): strike/kick/kickBig for impact, swerve for a dodge that keeps
 * going, fall/rise for KO/revive, numPop/numCrit/tickUp for numbers, wordPop
 * for the center word, flash/shock/trail for crit/kill punctuation, domeIn
 * for shields and purify.
 *
 * Pure rendering: no timers, no state. `frameKey` is only used as the React
 * `key` so a repeated event (same kind twice in a row) still restarts its
 * CSS animation — remounting is what makes that work, not a JS clock.
 *
 * Every number/word is plain text in the DOM; the CSS in battleAnim.css is
 * the only thing that moves it, and the reduced-motion block there floors
 * every relevant animation at opacity: 1 so nothing here can disappear when
 * motion is off.
 */

type Tone = 'white' | 'gold' | 'green' | 'red' | 'violet' | 'blocked'

interface NumberSpec {
  text: string
  size: 'normal' | 'big' | 'small'
  tone: Tone
  blocked?: boolean
  className: string
}

interface WordSpec {
  text: string
  className: string
}

interface SceneSpec {
  number?: NumberSpec
  word?: WordSpec
  /** Decorative-only layers: shockwave, trail, flash, dome, shiver — no text. */
  decor: Array<{ key: string; className: string }>
  /** Extra motion class applied to the actor/target box wrappers. */
  actorMotion?: string
  targetMotion?: string
}

function numberFor(event: SceneEvent, opts: { size?: NumberSpec['size']; tone?: Tone; sign?: '+' | '-' | ''; blocked?: boolean; anim?: string } = {}): NumberSpec | undefined {
  if (event.amount === undefined) return undefined
  const sign = opts.sign ?? ''
  const size = opts.size ?? 'normal'
  const tone = opts.tone ?? 'white'
  const anim = opts.anim ?? (size === 'big' ? 'fx-numCrit' : 'fx-numPop')
  return {
    text: `${sign}${event.amount}`,
    size,
    tone,
    blocked: opts.blocked,
    className: anim,
  }
}

function wordFor(event: SceneEvent, className = 'fx-wordPop'): WordSpec | undefined {
  if (!event.word) return undefined
  return { text: event.word, className }
}

/** The event→visual table. One branch per SceneKind so a reviewer can check
 *  every kind is accounted for (see task-4-report.md for the same table in
 *  prose). Kinds with nothing to show (`cooldown`, `relic`, `none`) fall
 *  through to the default `{ decor: [] }` and SceneFx returns null for them. */
function specFor(event: SceneEvent): SceneSpec {
  const kind: SceneKind = event.kind
  switch (kind) {
    case 'hit':
      return {
        number: numberFor(event, { tone: 'white' }),
        decor: [
          { key: 'trail', className: 'fx-trail' },
          { key: 'shock', className: 'fx-shock' },
        ],
        actorMotion: 'fx-strike',
        targetMotion: 'fx-kick',
      }

    case 'crit':
      return {
        number: numberFor(event, { size: 'big', tone: 'gold' }),
        word: wordFor(event),
        decor: [
          { key: 'flash', className: 'fx-flash' },
          { key: 'trail', className: 'fx-trail' },
          { key: 'shock', className: 'fx-shock' },
        ],
        actorMotion: 'fx-strike',
        targetMotion: 'fx-kickBig',
      }

    case 'shatter':
      // A shattered shield reads as a shattered shield first, an amplified
      // hit second — kept above `crit` in lib/battleScene.ts's precedence,
      // and it still shows the (bigger) number underneath the flash.
      return {
        number: numberFor(event, { size: 'big', tone: 'gold' }),
        word: wordFor(event),
        decor: [
          { key: 'flash', className: 'fx-flash' },
          { key: 'shock', className: 'fx-shock' },
        ],
        actorMotion: 'fx-strike',
        targetMotion: 'fx-kickBig',
      }

    case 'dodge':
      // No number — dodging is the absence of damage, showing 0 would read
      // as "hit for zero".
      return {
        word: wordFor(event),
        decor: [{ key: 'trail', className: 'fx-trail' }],
        targetMotion: 'fx-swerve',
      }

    case 'block':
      return {
        number: numberFor(event, { tone: 'blocked', blocked: true }),
        decor: [{ key: 'dome', className: 'fx-domeIn' }],
        targetMotion: 'fx-kick',
      }

    case 'pen':
      return {
        number: numberFor(event, { tone: 'violet' }),
        word: wordFor(event),
        decor: [{ key: 'trail', className: 'fx-trail' }],
        actorMotion: 'fx-strike',
        targetMotion: 'fx-kick',
      }

    case 'heal':
      return {
        number: numberFor(event, { tone: 'green', sign: '+' }),
        decor: [],
        targetMotion: 'fx-rise',
      }

    case 'kill':
      return {
        number: numberFor(event, { size: 'big', tone: 'gold' }),
        word: wordFor(event),
        decor: [
          { key: 'flash', className: 'fx-flash' },
          { key: 'shock', className: 'fx-shock' },
        ],
        actorMotion: 'fx-strike',
        targetMotion: 'fx-fall',
      }

    case 'revive':
      return {
        number: numberFor(event, { tone: 'green', sign: '+' }),
        word: wordFor(event),
        decor: [{ key: 'flash', className: 'fx-flash' }],
        targetMotion: 'fx-rise',
      }

    case 'skip':
      // No number — nothing happened, so nothing numeric to show.
      return {
        word: wordFor(event),
        decor: [{ key: 'shiver', className: 'fx-shiver' }],
        actorMotion: 'fx-shiver',
      }

    case 'dot':
      return {
        number: numberFor(event, { size: 'small', tone: 'green', sign: '-', anim: 'fx-tickUp' }),
        decor: [],
      }

    case 'regen':
      return {
        number: numberFor(event, { size: 'small', tone: 'green', sign: '+', anim: 'fx-tickUp' }),
        decor: [],
      }

    case 'fatigue':
      return {
        word: wordFor(event),
        decor: [
          { key: 'flash', className: 'fx-flash' },
          { key: 'shiver', className: 'fx-shiver' },
        ],
        actorMotion: 'fx-shiver',
      }

    case 'purify':
      return {
        word: wordFor(event),
        decor: [{ key: 'dome', className: 'fx-domeIn' }],
      }

    case 'recoil':
      // The number lands on the ACTOR, not the target — recoil hurts the
      // caster. specFor doesn't know actor/target boxes; SceneFx routes this
      // number onto the actor box via `onActor`.
      return {
        number: numberFor(event, { tone: 'red' }),
        word: wordFor(event),
        decor: [{ key: 'shock', className: 'fx-shock' }],
        actorMotion: 'fx-kick',
      }

    case 'duo-miasma':
    case 'duo-muro':
    case 'duo-untore':
      return {
        word: wordFor(event),
        decor: [
          { key: 'flash', className: 'fx-flash' },
          { key: 'trail', className: 'fx-trail' },
        ],
      }

    case 'cooldown':
    case 'relic':
    case 'none':
    default:
      return { decor: [] }
  }
}

/** True when `specFor(event)` has at least one visible layer (number, word,
 *  decor, or a motion class on actor/target). Exported so tests can assert
 *  "this event actually renders something" through the real `specFor` logic
 *  instead of re-deriving their own copy of the `nothingToShow` condition,
 *  which would silently drift from the component over time. */
export function eventRendersSomething(event: SceneEvent): boolean {
  const spec = specFor(event)
  return !!(spec.number || spec.word || spec.decor.length > 0 || spec.actorMotion || spec.targetMotion)
}

const NUMBER_TONE_CLASS: Record<Tone, string> = {
  white: 'text-white',
  gold: 'text-amber-300',
  green: 'text-emerald-300',
  red: 'text-rose-400',
  violet: 'text-violet-300',
  blocked: 'text-sky-200',
}

const NUMBER_SIZE_CLASS: Record<NumberSpec['size'], string> = {
  small: 'text-sm',
  normal: 'text-2xl',
  big: 'text-4xl',
}

export function SceneFx({
  event, frameKey, actorBox, targetBox,
}: {
  event: SceneEvent
  /** Cambia a ogni frame: rimonta gli effetti così si riavviano. */
  frameKey: number
  actorBox?: DOMRect | null
  targetBox?: DOMRect | null
}) {
  const spec = specFor(event)
  if (!eventRendersSomething(event)) return null

  // recoil lands its number on the actor's own box; everything else lands on
  // the target's box (falling back to the actor's box when no target box was
  // given, e.g. self-targeted system events).
  const numberOnActor = event.kind === 'recoil'
  const numberBox = numberOnActor ? actorBox : (targetBox ?? actorBox)

  return (
    <div key={frameKey} data-testid="scene-fx" aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {spec.decor.map(d => (
        <span
          key={d.key}
          data-testid={`fx-decor-${d.key}`}
          className={`absolute inset-0 ${d.className}`}
        />
      ))}

      {spec.number && (
        <span
          data-testid="fx-number"
          data-size={spec.number.size}
          data-blocked={spec.number.blocked ? 'true' : undefined}
          className={[
            'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display font-bold',
            NUMBER_TONE_CLASS[spec.number.tone],
            NUMBER_SIZE_CLASS[spec.number.size],
            spec.number.blocked ? 'line-through decoration-2' : '',
            spec.number.className,
          ].filter(Boolean).join(' ')}
          style={numberBox ? {
            left: numberBox.left + numberBox.width / 2,
            top: numberBox.top,
            position: 'fixed',
          } : undefined}
        >
          {spec.number.text}
        </span>
      )}

      {spec.word && (
        <span
          data-testid="fx-word"
          className={[
            'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display text-xl font-bold uppercase tracking-[0.14em] text-white',
            spec.word.className,
          ].join(' ')}
        >
          {spec.word.text}
        </span>
      )}
    </div>
  )
}
