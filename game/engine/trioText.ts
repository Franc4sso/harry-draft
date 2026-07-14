import type { House } from '@/types'

/** UI copy per house Trio at a grade (0 = 3 members, 1 = 4+). Derived from trios.ts numbers. */
export function trioText(house: House, grade: 0 | 1): string {
  switch (house) {
    case 'Serpeverde': return `Opportunista: +${grade === 1 ? 45 : 30}% al primo colpo su un nemico intatto`
    case 'Corvonero':  return `Analisi: ogni colpo applica Vulnerabilità (−${grade === 1 ? 25 : 15}% difesa)`
    case 'Tassorosso': return 'Tenacia: gli status che infliggi durano +1 turno'
    case 'Grifondoro': return 'Slancio: cooldown delle tue spell −1'
  }
}
