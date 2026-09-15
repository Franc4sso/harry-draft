import type { House, Role, Tier } from '@/types'
import { HOUSES } from '@/data/houses'

export { cn } from './cn'

/** Glow "foil" oro condiviso per i maghi shiny. UN solo layer coeso (niente doppioni).
 *  Concatenato al boxShadow del frame card in Row e Column. */
export const SHINY_FOIL = ', 0 0 20px rgba(255,200,80,0.5), inset 0 0 0 2px rgba(255,210,90,0.75)'

export function houseTheme(house: House): { color: string; glow: string; gradient: string; ring: string } {
  const { color, glow } = HOUSES[house]
  return {
    color,
    glow,
    gradient: `linear-gradient(160deg, ${color} 0%, ${color}cc 45%, #0b0e14 100%)`,
    ring: `0 0 24px ${glow}66, 0 0 2px ${glow}aa`,
  }
}

export function roleIconName(role: Role): 'Swords' | 'Shield' | 'Heart' | 'Wand2' {
  switch (role) {
    case 'Attaccante': return 'Swords'
    case 'Tank': return 'Shield'
    case 'Supporto': return 'Heart'
    case 'Controllo': return 'Wand2'
  }
}

const TIER_LABELS: Record<Tier, string> = { 1: 'Leggendario', 2: 'Epico', 3: 'Raro', 4: 'Comune' }
const TIER_COLORS: Record<Tier, string> = { 1: '#ffd34d', 2: '#b06bff', 3: '#4da6ff', 4: '#9aa3ad' }

export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier]
}

export function tierColor(tier: Tier): string {
  return TIER_COLORS[tier]
}

/** Rarity FRAME per tier — ported from `.superpowers/design/rarity-borders.html` (.t1..t4).
 *  The frame is the card's outer identity: pewter bevel (t4) → brushed silver + cool glow (t3)
 *  → amethyst + stronger glow (t2) → radiant gilt + shimmer (t1, see .t1 .shimmer in the mockup).
 *  `background` goes on the outer frame div, `boxShadow` too, `keyline` tints the inner plate's
 *  1px border (the plate::after border-color in the mockup). */
export function tierFrame(tier: Tier): {
  background: string; boxShadow: string; keyline: string; pips: number
} {
  // CORNICI SOBRIE (2026-09-15). Le precedenti imitavano il metallo: gradienti a
  // sei stop, bordi smussati da 9px e, sulla leggendaria, SETTE ombre sovrapposte
  // con aloni da 46 e 110px. Tre carte affiancate producevano una nebbia luminosa
  // e la cornice vinceva sull'attenzione contro il ritratto.
  //
  // Regola nuova, indicata dall'utente («come per i numeri degli HP»): un colore
  // per rarità e un filo da 1px. Quello che cambia fra comune e leggendaria è la
  // TINTA, non la quantità di effetti. L'alone resta solo sulle due rarità alte,
  // e a 18px: basta a far staccare una leggendaria in mezzo alle altre.
  // Blur tenuto a 20px: e' il tetto che separa un'ombra di profondita' (utile,
  // stacca la carta dallo sfondo) da un alone (distrae, vedi commento sopra).
  const DEEP = '0 10px 20px rgba(0,0,0,.5)'
  switch (tier) {
    case 4: // COMUNE — peltro spento, nessun alone.
      return {
        background: 'rgba(154,163,173,.34)',
        boxShadow: DEEP,
        keyline: 'rgba(154,163,173,.26)',
        pips: 1,
      }
    case 3: // RARO — azzurro freddo, nessun alone.
      return {
        background: 'rgba(127,178,232,.44)',
        boxShadow: DEEP,
        keyline: 'rgba(127,178,232,.3)',
        pips: 2,
      }
    case 2: // EPICO — ametista, alone appena percepibile.
      return {
        background: 'rgba(185,140,255,.5)',
        boxShadow: `0 0 18px rgba(185,140,255,.16), ${DEEP}`,
        keyline: 'rgba(185,140,255,.34)',
        pips: 3,
      }
    case 1: // LEGGENDARIO — oro, stesso alone dell'epico.
      return {
        background: 'rgba(232,180,74,.58)',
        boxShadow: `0 0 18px rgba(232,180,74,.18), ${DEEP}`,
        keyline: 'rgba(232,180,74,.4)',
        pips: 4,
      }
    default: // Fixture di test senza tier: legge come comune.
      return {
        background: 'rgba(154,163,173,.34)',
        boxShadow: DEEP,
        keyline: 'rgba(154,163,173,.26)',
        pips: 1,
      }
  }
}
