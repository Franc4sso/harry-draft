import { describe, it, expect } from 'vitest'
import { trioText } from '@/game/engine/trioText'

describe('trioText', () => {
  it('Serpeverde: grado 0 = +30%, grado 1 = +45%', () => {
    expect(trioText('Serpeverde', 0)).toBe('Opportunista: +30% al primo colpo su un nemico intatto')
    expect(trioText('Serpeverde', 1)).toBe('Opportunista: +45% al primo colpo su un nemico intatto')
  })

  it('Corvonero: grado 0 = −15% difesa, grado 1 = −25% difesa', () => {
    expect(trioText('Corvonero', 0)).toBe('Analisi: ogni colpo applica Vulnerabilità (−15% difesa)')
    expect(trioText('Corvonero', 1)).toBe('Analisi: ogni colpo applica Vulnerabilità (−25% difesa)')
  })

  it('Tassorosso: testo fisso, non varia col grado', () => {
    expect(trioText('Tassorosso', 0)).toBe('Tenacia: gli status che infliggi durano +1 turno')
    expect(trioText('Tassorosso', 1)).toBe('Tenacia: gli status che infliggi durano +1 turno')
  })

  it('Grifondoro: testo fisso, non varia col grado', () => {
    expect(trioText('Grifondoro', 0)).toBe('Slancio: cooldown delle tue spell −1')
    expect(trioText('Grifondoro', 1)).toBe('Slancio: cooldown delle tue spell −1')
  })
})
