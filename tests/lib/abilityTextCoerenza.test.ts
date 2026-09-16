import { describe, it, expect } from 'vitest'
import { abilityText } from '@/lib/abilityText'
import { SIGNATURES, SIGNATURE_BY_ID } from '@/data/signatures'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 2026-09-16 — Il testo dell'abilità deve dire il VERO.
 *
 * Rilievo dell'utente: «le abilità dei personaggi, a volte non combaciano con i
 * loro attacchi, ad esempio Neville Paciock».
 *
 * `lib/abilityText.ts` tiene una tabella `LINES` scritta A MANO, parallela alle
 * Signature: i numeri mostrati al giocatore non sono derivati da `data/signatures.ts`,
 * sono ricopiati. Due verità che possono divergere alla prima modifica di bilanciamento
 * — e il giocatore leggerebbe un numero che il motore non applica.
 *
 * Questi test confrontano il testo mostrato con la firma reale, mago per mago.
 */
describe('abilityText ↔ signatures — nessuna divergenza', () => {
  it('ogni mago con una firma ha un testo, e il nome combacia', () => {
    const rotti: string[] = []
    for (const sig of SIGNATURES) {
      const t = abilityText(sig.id)
      if (!t) { rotti.push(`${sig.id}: nessun testo`); continue }
      if (t.name !== sig.name) rotti.push(`${sig.id}: nome "${t.name}" != "${sig.name}"`)
    }
    expect(rotti, rotti.join(' | ')).toEqual([])
  })

  it('nessun mago SENZA firma mostra un testo', () => {
    // La rarità della targa è il punto della potatura: un testo su un mago senza
    // firma sarebbe un segnaposto, che questo progetto ha rimosso di proposito.
    expect(abilityText('crabbe')).toBeUndefined()
    expect(SIGNATURE_BY_ID['crabbe']).toBeUndefined()
  })

  it('ogni numero mostrato esiste come costante di bilanciamento reale', () => {
    // I valori delle firme vivono in COSTANTI risolte dentro le closure `effects`
    // (adBuff('atk', T3_AD_ATK)), quindi `JSON.stringify(sig)` non li vede: il
    // primo tentativo di questo test falliva su tutti e 16 i maghi, compreso
    // Neville, di cui avevo verificato a mano che +18 = T3_AD_ATK è CORRETTO.
    // Era lo strumento a essere sbagliato, non il dato. Si confronta quindi con
    // le costanti dichiarate nel sorgente: un numero mostrato che non corrisponde
    // a nessuna costante è inventato o rimasto indietro dopo un ribilanciamento.
    // Due fonti, non una: alcune firme non portano un valore proprio ma APPLICANO
    // uno stato del catalogo, e il numero mostrato è quello dello stato (Luna
    // "+12 vita a ogni turno" = `tickHeal: 12` di `regen` in data/statuses.ts).
    // Cercando solo in signatures.ts, Luna risultava rotta mentre è corretta.
    const src = readFileSync(resolve(__dirname, '../../data/signatures.ts'), 'utf8')
      + readFileSync(resolve(__dirname, '../../data/statuses.ts'), 'utf8')
    const costanti = new Set<string>()
    for (const m of src.matchAll(/(?:^const\s+\w+\s*=\s*|tickHeal:\s*|tickDamage:\s*|absorb:\s*)([0-9.]+)/gm)) {
      const v = Number(m[1])
      costanti.add(String(v))
      if (v < 1) costanti.add(String(Math.round(v * 100))) // le frazioni si mostrano in %
    }
    const rotti: string[] = []
    for (const sig of SIGNATURES) {
      const t = abilityText(sig.id)
      if (!t) continue
      for (const line of t.lines) {
        const n = line.value.replace(/[^0-9]/g, '')
        if (!n) continue
        if (!costanti.has(String(Number(n)))) {
          rotti.push(`${sig.id}: mostra ${line.value} (${line.what}) — nessuna costante vale ${n}`)
        }
      }
    }
    expect(rotti, rotti.join(' | ')).toEqual([])
  })
})
