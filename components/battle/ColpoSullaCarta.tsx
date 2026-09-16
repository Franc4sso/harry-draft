import type { SceneEvent } from '@/lib/battleScene'

/**
 * Il numero del colpo, sulla carta che lo subisce — non in una colonna laterale, non sopra
 * il bordo. Richiesta esplicita dell'utente: «il danno lo farei leggermente più piccolo e al
 * centro dell'immagine, non così sopra». Il mockup (https://claude.ai/artifact/Dk93L833VQCrhqUvzHwgo3,
 * `.blow`) usava 70/90px ANCORATI SOPRA il bordo della carta: qui scende a 56/72px e nasce al
 * CENTRO del ritratto — stesso trattamento (ombra incisa, targhetta con quadratino colorato),
 * posizione e taglia diverse.
 */

/** Larghezza di riferimento della cornice — la geometria fissa del piano
 *  (docs/superpowers/specs/2026-09-16-vetrata-e-incantesimi-design.md: carte 212×254 da
 *  x=135, passo 221, frame 1366×768). `box` arriva già in coordinate di questa cornice, quindi
 *  il vincolo orizzontale si fa contro questa stessa larghezza. Metà della targhetta più larga
 *  possibile (una parola lunga come "SFINIMENTO" in Cinzel 11px con padding) sta comoda in 80px:
 *  è il margine misurato sul mockup dove, su una carta di bordo (x=0), il numero usciva a
 *  sinistra della cornice senza vincolo. */
const FRAME_W = 1366
const HALF_CLAMP = 80

const KO_WORD = 'K.O.'

function contentFor(event: SceneEvent): { number: string | null; word: string | null; tone: 'hit' | 'crit' | 'heal' | 'block' | 'kill' | 'word' } {
  const amount = event.amount
  switch (event.kind) {
    case 'crit':
      return { number: amount !== undefined ? `${amount}` : null, word: null, tone: 'crit' }
    case 'heal':
    case 'regen':
      return { number: amount !== undefined ? `+${amount}` : null, word: null, tone: 'heal' }
    case 'block':
      return { number: amount !== undefined ? `${amount}` : null, word: null, tone: 'block' }
    case 'kill':
      return { number: null, word: event.word ?? KO_WORD, tone: 'kill' }
    case 'dodge':
    case 'skip':
      return { number: null, word: event.word ?? null, tone: 'word' }
    case 'hit':
      return { number: amount !== undefined ? `${amount}` : null, word: null, tone: 'hit' }
    default:
      // Altri kind (dot, fatigue, purify, duo-*, cooldown, relic, revive, recoil, pen,
      // shatter, none, ...) non hanno una resa numero/parola propria su ColpoSullaCarta:
      // qui rendono solo la targhetta se `word` è presente, nessun numero.
      return { number: null, word: event.word ?? null, tone: 'word' }
  }
}

const TONE_COLOR: Record<string, string> = {
  hit: '#f5f2ea',
  crit: '#d9b65f',
  heal: '#7cfc9b',
  block: '#8ec9ff',
  kill: '#f5f2ea',
  word: '#f5f2ea',
}

/** L'ombra incisa del mockup — carve, non contorno. Stessa sui numeri e sulle parole. */
const CARVED_SHADOW = '0 3px 0 rgba(112,16,16,.9)'

/**
 * Il colpo sulla carta colpita: il numero (o la parola, quando non c'è numero) nato al
 * centro del ritratto, con la targhetta dell'effetto sotto quando `event.word` la porta
 * insieme a un numero (es. un blocco che silenzia). Nessuna animazione porta l'informazione:
 * a `prefers-reduced-motion` spento o acceso il numero resta leggibile — qui il componente
 * non anima affatto (le transizioni vivono nel chiamante, che rimonta su `frameKey`), quindi
 * non c'è nulla da spegnere.
 */
export function ColpoSullaCarta({ event, frameKey, box }: {
  event: SceneEvent
  frameKey: number
  /** Il riquadro della carta colpita, in coordinate della cornice. */
  box?: { x: number; y: number; w: number; h: number } | null
}) {
  if (!box) return null
  const { number, word, tone } = contentFor(event)
  if (!number && !word) return null

  const centerX = box.x + box.w / 2
  const centerY = box.y + box.h / 2
  const left = Math.min(Math.max(centerX, HALF_CLAMP), FRAME_W - HALF_CLAMP)

  const color = TONE_COLOR[tone] ?? TONE_COLOR.hit
  const isCrit = tone === 'crit'
  const size = isCrit ? 72 : 56
  const showsWordOnly = !number && !!word

  return (
    <div
      key={frameKey}
      data-testid="colpo"
      aria-hidden
      className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 select-none"
      style={{ left, top: centerY }}
    >
      {number && (
        <span
          data-testid="colpo-numero"
          data-taglia={isCrit ? 'crit' : undefined}
          data-assorbito={tone === 'block' ? 'true' : undefined}
          className="font-display font-black leading-none"
          style={{
            fontSize: size,
            color,
            textShadow: CARVED_SHADOW,
            textDecoration: tone === 'block' ? 'line-through' : undefined,
            textDecorationThickness: tone === 'block' ? 3 : undefined,
          }}
        >
          {number}
        </span>
      )}
      {showsWordOnly && (
        <span
          className="font-display text-2xl font-black uppercase tracking-[0.08em] whitespace-nowrap"
          style={{ color, textShadow: CARVED_SHADOW }}
        >
          {word}
        </span>
      )}
      {!showsWordOnly && word && (
        <span
          data-testid="colpo-targhetta"
          className="flex items-center gap-1 whitespace-nowrap rounded-[4px] bg-black/70 px-1.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color }}
        >
          <span aria-hidden className="inline-block h-2 w-2 rounded-[2px]" style={{ background: color }} />
          {word}
        </span>
      )}
    </div>
  )
}
