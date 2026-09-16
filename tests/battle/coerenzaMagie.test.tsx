import { describe, it, expect } from 'vitest'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

/**
 * 2026-09-16 — L'incantesimo mostrato è quello che il mago lancia davvero.
 *
 * Rilievo dell'utente: «le abilità dei personaggi, a volte non combaciano con i
 * loro attacchi, ad esempio Neville Paciock». La carta di battaglia mostra
 * `u.spell.name` (BattleArena: `SPELL_BY_ID[u.spell.id]`), mentre le azioni del
 * log portano `entry.action`. Se le due divergono, il giocatore legge un
 * incantesimo e ne vede partire un altro.
 *
 * Non basta provare UN mago: "a volte" vuol dire che il caso va cercato su tutto
 * il cast, non sull'esempio citato — Neville, verificato per primo, è coerente.
 */
/** Righe che NON sono un lancio del mago e che quindi non possono smentire la
 *  carta: i tick di stato (veleno/bruciatura, che portano `flags:['dot']` pur
 *  avendo `type` non-system — l'ambiguità già nota di `dot`) e il colpo base,
 *  che è il ripiego quando l'incantesimo è in ricarica o il mago è silenziato. */
const NON_LANCI = new Set(['Colpo base', 'Colpo Base', 'Attacco', 'Veleno', 'Bruciatura'])

describe('la magia scritta sulla carta è quella che parte', () => {
  it('per ogni mago, ogni azione non-di-sistema è il suo incantesimo', () => {
    const rotti: string[] = []
    const ids = WIZARDS.map(w => w.id)
    // A coppie contro un avversario fisso: copre tutto il cast senza una
    // combinatoria inutile.
    for (let i = 0; i < ids.length; i += 5) {
      const gruppo = ids.slice(i, i + 5)
      if (gruppo.length === 0) continue
      const rng = createRng(`L-${i}`)
      const l = gruppo.map(id => draftWizard(rng, WIZARDS.find(w => w.id === id)!))
      const r2 = createRng(`R-${i}`)
      const r = ids.slice(0, 5).map(id => draftWizard(r2, WIZARDS.find(w => w.id === id)!))
      const res = simulateBattle(l, r, createRng(`S-${i}`), {})
      const replay = buildReplay(res, l, r, { leftSyn: [], rightSyn: [], leftRelics: [], rightRelics: [] })

      for (const u of replay.units) {
        const mostrato = SPELL_BY_ID[u.spell.id]?.name
        if (!mostrato) { rotti.push(`${u.id}: spell.id "${u.spell.id}" non esiste nel catalogo`); continue }
        for (const f of replay.frames) {
          const e = f.entry
          if (!e || e.type === 'system') continue
          if (e.actorId !== u.id || e.actorSide !== u.side) continue
          if (e.action === mostrato) continue
          if (NON_LANCI.has(e.action)) continue
          if (e.flags?.includes('dot')) continue
          rotti.push(`${u.id}: la carta dice "${mostrato}" ma ha lanciato "${e.action}"`)
        }
      }
    }
    expect([...new Set(rotti)], [...new Set(rotti)].join(' | ')).toEqual([])
  })
})

describe('il nastro mostra LANCI, non tick di stato', () => {
  it('nessuno slot del nastro è un tick di veleno/bruciatura', async () => {
    // IL DIFETTO VERO dietro «le abilità a volte non combaciano con i loro
    // attacchi»: `ribbonOrder` scartava solo `type === 'system'`, ma un tick di
    // veleno/bruciatura ha `type` NON-system (misurato: 'Controllo') e
    // `flags: ['dot']`. Entrava quindi nel nastro come se fosse un lancio, e
    // Bellatrix compariva con "Bruciatura" al posto del suo Crucio — l'utente
    // vedeva un incantesimo che quel mago non ha.
    const { buildReplay } = await import('@/game/engine/combat/replay')
    const rng = createRng('L-0')
    const ids = WIZARDS.map(w => w.id).slice(0, 5)
    const l = ids.map(id => draftWizard(rng, WIZARDS.find(w => w.id === id)!))
    const r2 = createRng('R-0')
    const r = ids.map(id => draftWizard(r2, WIZARDS.find(w => w.id === id)!))
    const res = simulateBattle(l, r, createRng('S-0'), {})
    const replay = buildReplay(res, l, r, { leftSyn: [], rightSyn: [], leftRelics: [], rightRelics: [] })

    const { NastroSigilli } = await import('@/components/battle/NastroSigilli')
    const { render, screen } = await import('@testing-library/react')
    const rotti: string[] = []
    // Finestra 6..14 invece di 1..30: i tick incriminati cadono ai frame 8, 9 e 10
    // (misurato — la falsificazione li nomina), e trenta render montati in serie
    // portavano il test oltre i 5s sotto il carico della suite completa. Restare
    // stretti tiene il test veloce SENZA perdere il caso che difende: rimuovendo
    // il filtro torna rosso nominando Bellatrix.
    for (let i = 6; i < Math.min(replay.frames.length, 15); i++) {
      const view = render(<NastroSigilli replay={replay} index={i} />)
      for (const s of screen.queryAllByTestId('sigillo')) {
        const txt = s.textContent ?? ''
        if (/Veleno|Bruciatura/.test(txt)) rotti.push(`frame ${i}: slot mostra "${txt}"`)
      }
      view.unmount()
    }
    expect([...new Set(rotti)].slice(0, 5), [...new Set(rotti)].slice(0, 5).join(' | ')).toEqual([])
  })
})
