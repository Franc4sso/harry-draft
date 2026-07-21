import { describe, it, expect } from 'vitest'
import { trioGateLoss } from '@/game/engine/trios'
import type { DraftedWizard } from '@/types'

// Casata esplicita: il gate Trio richiede >=3 maghi STESSA casa + >=1 Duo attivo.
const dw = (id: string, role: string, house: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role, house, tags }, level: 1 } as unknown as DraftedWizard)

describe('trioGateLoss', () => {
  it('segnala la casa il cui Trio cade quando si rimuove un mago della casa', () => {
    // 3 Serpeverde + Duo Cancrena attivo (veleno+esecuzione su 2 di loro) → Trio Serpeverde attivo.
    const s1 = dw('s1', 'Attaccante', 'Serpeverde', ['veleno', 'esecuzione'])
    const s2 = dw('s2', 'Tank', 'Serpeverde', ['veleno', 'esecuzione'])
    const s3 = dw('s3', 'Controllo', 'Serpeverde')
    const current = [s1, s2, s3]
    // Rimpiazzo s3 (Serpeverde) con un Grifondoro → scendo a 2 Serpeverde → Trio cade.
    const next = [s1, s2, dw('g', 'Controllo', 'Grifondoro')]
    expect(trioGateLoss(current, next, [])).toContain('Serpeverde')
  })

  it('nessun Trio perso se la casa resta a >=3 e il Duo regge', () => {
    const s1 = dw('s1', 'Attaccante', 'Serpeverde', ['veleno', 'esecuzione'])
    const s2 = dw('s2', 'Tank', 'Serpeverde', ['veleno', 'esecuzione'])
    const s3 = dw('s3', 'Controllo', 'Serpeverde')
    const s4 = dw('s4', 'Supporto', 'Serpeverde')
    const current = [s1, s2, s3, s4]
    const next = [s1, s2, s3] // ancora 3 Serpeverde + Duo → Trio regge
    expect(trioGateLoss(current, next, [])).toHaveLength(0)
  })

  it('il Trio cade anche se a rompersi è il Duo (gate richiede >=1 Duo attivo)', () => {
    // Il segnale tag si accende con >=2 maghi taggati (game/engine/duos.ts signalActive).
    // current: SOLO 2 Serpeverde taggati (s1,s2) + 1 senza tag (s3) → Cancrena attivo via s1/s2,
    // Trio attivo via 3 Serpeverde. next: rimpiazzo uno dei DUE taggati (s2) con un Serpeverde
    // SENZA tag → casa resta a 3 ma i taggati scendono a 1 → Cancrena si spegne → Trio cade.
    const s1 = dw('s1', 'Attaccante', 'Serpeverde', ['veleno', 'esecuzione'])
    const s2 = dw('s2', 'Tank', 'Serpeverde', ['veleno', 'esecuzione'])
    const s3 = dw('s3', 'Controllo', 'Serpeverde')
    const current = [s1, s2, s3]
    const next = [s1, dw('s5', 'Tank', 'Serpeverde'), s3]
    expect(trioGateLoss(current, next, [])).toContain('Serpeverde')
  })
})
