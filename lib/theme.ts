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
export function tierFrame(tier: Tier): { background: string; boxShadow: string; keyline: string } {
  switch (tier) {
    case 4: // COMUNE — pewter bevel, no glow.
      return {
        background: 'linear-gradient(145deg,#3a3f45 0%, #22262b 40%, #14171b 100%)',
        boxShadow: [
          '0 1px 0 rgba(255,255,255,.05)',
          'inset 0 1px 0 rgba(255,255,255,.10)',
          'inset 0 0 0 1px rgba(0,0,0,.5)',
          '0 10px 24px rgba(0,0,0,.45)',
        ].join(', '),
        keyline: 'rgba(154,163,173,.30)',
      }
    case 3: // RARO — brushed silver + crisp top edge + cool glow.
      return {
        background: [
          'linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 7%)',
          'linear-gradient(150deg,#b9cbdd 0%, #7f93a8 16%, #47596d 42%, #263241 70%, #141b25 100%)',
        ].join(', '),
        boxShadow: [
          'inset 0 1.5px 0 rgba(255,255,255,.42)',
          'inset 0 -1px 0 rgba(0,0,0,.4)',
          'inset 0 0 0 1px rgba(0,0,0,.45)',
          '0 0 0 1px rgba(77,166,255,.22)',
          '0 0 26px rgba(77,166,255,.20)',
          '0 12px 26px rgba(0,0,0,.5)',
        ].join(', '),
        keyline: 'rgba(77,166,255,.40)',
      }
    case 2: // EPICO — amethyst cornice + stronger glow.
      return {
        background: [
          'linear-gradient(180deg, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 7%)',
          'linear-gradient(150deg,#f0d9ff 0%, #c49bf5 18%, #9a54e6 42%, #6a2fb8 68%, #38156a 100%)',
        ].join(', '),
        boxShadow: [
          'inset 0 1.5px 0 rgba(255,255,255,.46)',
          'inset 0 -1px 0 rgba(30,10,50,.5)',
          'inset 0 0 0 1px rgba(30,10,54,.5)',
          '0 0 0 1px rgba(176,107,255,.5)',
          '0 0 40px rgba(176,107,255,.42)',
          '0 0 88px rgba(150,80,240,.22)',
          '0 14px 30px rgba(0,0,0,.55)',
        ].join(', '),
        keyline: 'rgba(176,107,255,.46)',
      }
    case 1: // LEGGENDARIO — radiant gilt + shimmer (shimmer rendered separately, see .t1 .shimmer).
      return {
        background: [
          'linear-gradient(180deg, rgba(255,255,255,.7) 0%, rgba(255,255,255,0) 6%)',
          'linear-gradient(150deg,#fff7d4 0%, #ffe27a 14%, #ffd34d 30%, #c8912a 56%, #8a5f18 82%, #4a3210 100%)',
        ].join(', '),
        boxShadow: [
          'inset 0 2px 0 rgba(255,255,255,.6)',
          'inset 0 -2px 1px rgba(70,44,8,.6)',
          'inset 0 0 0 1px rgba(120,80,20,.5)',
          '0 0 0 1px rgba(255,211,77,.55)',
          '0 0 46px rgba(255,196,64,.5)',
          '0 0 110px rgba(255,180,50,.28)',
          '0 16px 36px rgba(0,0,0,.62)',
        ].join(', '),
        keyline: 'rgba(255,211,77,.55)',
      }
    default: // Defensive fallback (e.g. loosely-typed test fixtures without a tier) — reads as common.
      return {
        background: 'linear-gradient(145deg,#3a3f45 0%, #22262b 40%, #14171b 100%)',
        boxShadow: [
          '0 1px 0 rgba(255,255,255,.05)',
          'inset 0 1px 0 rgba(255,255,255,.10)',
          'inset 0 0 0 1px rgba(0,0,0,.5)',
          '0 10px 24px rgba(0,0,0,.45)',
        ].join(', '),
        keyline: 'rgba(154,163,173,.30)',
      }
  }
}
