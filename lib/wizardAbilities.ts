import { SIGNATURE_BY_ID } from '@/data/signatures'

/** L'abilita' personale del mago per la targa oro della carta — cioe' la sua Signature.
 *
 *  Onda 1.d (2026-07-27): il catalogo e' stato potato da 60 a 15 firme, quindi la maggior
 *  parte dei maghi NON ha piu' un'abilita' e questa funzione torna `undefined`. Prima
 *  esisteva un ripiego per-ruolo che riempiva la targa con il nome del ruolo: e' stato
 *  rimosso di proposito. Se ogni carta mostrasse comunque una targa, la rarita' della targa
 *  — cioe' tutto il valore della potatura — sarebbe distrutta. Il ruolo, del resto, e' gia'
 *  sul RoleBadge: ripeterlo nella targa era anche una duplicazione.
 *
 *  Chi consuma questa funzione deve gestire l'assenza saltando il blocco (vedi
 *  `WizardCardColumn`), non sostituendola con un placeholder. */
export function abilityFor(id: string): { name: string; blurb: string } | undefined {
  const sig = SIGNATURE_BY_ID[id]
  return sig ? { name: sig.name, blurb: sig.desc } : undefined
}
