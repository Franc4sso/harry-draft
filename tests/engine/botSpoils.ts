import type { DraftedWizard, RunNode, RunState } from '@/types'
import { livingOf, tagsOf } from '@/game/engine/roster'
import { litSignals } from '@/game/engine/duos'
import { powerOf } from '@/game/engine/combat/teamGen'
import {
  applySpoilChoice, rollSpoils, spoilsRngForNode,
  type Spoil, type SpoilChoice, type SpoilMarchio, type MarchioTag,
} from '@/game/engine/spoils'

/**
 * POLICY DELLE SPOGLIE PER IL BOT DI BILANCIAMENTO (test-only, non è codice di gioco).
 *
 * Perché esiste: le Spoglie della Vittoria si applicano nel layer hook (`hooks/useRunB.ts`
 * → `chooseSpoil`), che gli harness NON attraversano — loro guidano `runEngine` a mano. Senza
 * questo modulo il bot esce da ogni battaglia normale senza scegliere nulla e l'harness
 * SOTTOSTIMA il potere del giocatore: è esattamente la trappola già documentata per gli
 * "scaling joker" (feature invisibile al bot ⇒ il gate smette di misurare il gioco reale).
 *
 * Il modulo vive in `tests/` perché è una POLICY di un giocatore simulato, non una regola del
 * gioco: nessuna schermata e nessun resolver deve dipenderne. È condiviso fra i due harness di
 * campagna (`campaignBalanceB`, `campaignBalanceRestricted`) così le due misure restano
 * confrontabili e non divergono nel tempo.
 *
 * ORDINE DI PREFERENZA (deterministico, nessun `Math.random`):
 *  1. il MARCHIO che COMPLETA un Duo (`completes` valorizzato) — è la carta della tesi: un Duo
 *     acceso è il più grande salto di potere disponibile in un singolo nodo;
 *  2. altrimenti il MARCHIO della FASCIA migliore rimasta, cioè quello che ACCENDE un segnale
 *     (secondo mago con quel tag: `signalCount` per i tag vuole `need: 2`). Un Marchio che
 *     SEMINA soltanto — nessun Duo chiuso, nessun segnale acceso — non è "fascia migliore": è
 *     una carta senza effetto misurabile in questa run, quindi NON batte le due carte concrete
 *     sotto (questa è l'unica lettura interpretativa della lista, resa esplicita apposta);
 *  3. se la squadra è sotto la soglia di vita, il RISTORO;
 *  4. altrimenti l'ALLENAMENTO;
 *  5. rete di sicurezza: se l'offerta contenesse solo Marchi-seme, se ne prende uno comunque
 *     (una carta gratis non si butta mai).
 *
 * SOGLIA DI VITA = 60% della vita massima della squadra (viva e non corrotta), in aggregato.
 * Motivazione: il Ristoro cura il 25% della vita MASSIMA di ciascuno e la cura eccedente è
 * persa; sopra il ~60-75% buona parte finirebbe in overheal, e soprattutto
 * `clearAreaAndAdvance` regala già una guarigione completa a ogni cambio d'area — quindi la
 * vita è una risorsa che conta solo DENTRO l'area, e solo quando è davvero bassa. Sotto il 60%
 * invece la cura viene assorbita quasi tutta ed è la prossima battaglia a essere in gioco, non
 * la build. La stessa filosofia del `pickNode` esistente, che devia in infermeria quando la
 * squadra è ferita invece di continuare a picchiare.
 *
 * SCELTA DEL BERSAGLIO (le carte `needsTarget`): il mago VIVO più forte (`powerOf`), a parità
 * il primo per `wizard.id` — un ordinamento totale, quindi riproducibile al bit.
 *  - Marchio: fra i vivi che NON hanno già quel tag (darlo a chi ce l'ha è un no-op lato
 *    motore). Quale mago lo riceva non cambia MAI la fascia della carta (i segnali-tag contano
 *    QUANTI maghi hanno il tag, non quali), quindi si sceglie il più forte perché gli effetti
 *    a parola chiave (veleno/esecuzione…) rendono di più sul picchiatore principale.
 *  - Allenamento: il più forte, perché il livello moltiplica statistiche già alte.
 */

/** Sotto questa frazione di vita di squadra il bot preferisce il Ristoro al potere. */
export const BOT_SPOILS_HURT_RATIO = 0.6

function isMarchio(s: Spoil): s is SpoilMarchio {
  return s.kind === 'marchio'
}

/** Ordine totale e stabile fra maghi: più forte prima, `wizard.id` come spareggio. */
function byPowerThenId(a: DraftedWizard, b: DraftedWizard): number {
  const d = powerOf(b) - powerOf(a)
  return d !== 0 ? d : a.wizard.id.localeCompare(b.wizard.id)
}

function strongestLiving(team: DraftedWizard[]): DraftedWizard | undefined {
  return [...livingOf(team)].sort(byPowerThenId)[0]
}

/** Il bersaglio di un Marchio: il vivo più forte che non ha ancora quel tag. */
function marchioTarget(team: DraftedWizard[], tag: MarchioTag): DraftedWizard | undefined {
  return [...livingOf(team)].filter(d => !tagsOf(d).includes(tag)).sort(byPowerThenId)[0]
}

/** Fascia della carta come la vede il bot: 0 completa un Duo, 1 accende un segnale, 2 semina.
 *  Non duplica la logica dei segnali: costruisce la squadra ipotetica e richiede a `litSignals`
 *  — la stessa funzione del motore — se il quadro cambia. */
function marchioTier(state: RunState, card: SpoilMarchio): 0 | 1 | 2 {
  if (card.completes) return 0
  const living = livingOf(state.team ?? [])
  const relics = state.relics ?? []
  const target = marchioTarget(living, card.tag)
  if (!target) return 2
  if (litSignals(living, relics).has(card.tag)) return 2
  const hypo = living.map(d => d === target
    ? { ...d, grantedTags: [...(d.grantedTags ?? []), card.tag] }
    : d)
  return litSignals(hypo, relics).has(card.tag) ? 1 : 2
}

/** Vita aggregata della squadra curabile (viva e non corrotta): 1 = piena, 0 = a terra.
 *  I corrotti sono esclusi perché il Ristoro non li cura (vedi `applySpoil`). */
function teamHpRatio(team: DraftedWizard[]): number {
  const healable = livingOf(team).filter(d => !d.corrotto)
  const max = healable.reduce((n, d) => n + d.maxHp, 0)
  if (max <= 0) return 1
  const cur = healable.reduce((n, d) => n + (d.currentHp ?? d.maxHp), 0)
  return cur / max
}

/** La scelta del bot su un'offerta già generata. `undefined` solo se l'offerta è vuota. */
export function botPickSpoil(state: RunState, offer: Spoil[]): SpoilChoice | undefined {
  const team = state.team ?? []
  const marchi = offer.filter(isMarchio)
  const marchioChoice = (card: SpoilMarchio): SpoilChoice => ({
    spoilId: card.id,
    wizardId: marchioTarget(team, card.tag)?.wizard.id,
  })

  const completer = marchi.find(m => marchioTier(state, m) === 0)
  if (completer) return marchioChoice(completer)

  const lighter = marchi.find(m => marchioTier(state, m) === 1)
  if (lighter) return marchioChoice(lighter)

  const ristoro = offer.find(s => s.kind === 'ristoro')
  if (ristoro && teamHpRatio(team) < BOT_SPOILS_HURT_RATIO) return { spoilId: ristoro.id }

  const allenamento = offer.find(s => s.kind === 'allenamento')
  if (allenamento) return { spoilId: allenamento.id, wizardId: strongestLiving(team)?.wizard.id }

  const seed = marchi[0]
  if (seed) return marchioChoice(seed)
  return offer[0] ? { spoilId: offer[0].id } : undefined
}

/**
 * Il gancio per gli harness: alla vittoria di una battaglia NORMALE genera l'offerta e applica
 * la scelta del bot. Rispecchia il percorso reale (`RunBRunner` genera con
 * `spoilsRngForNode(seed, node.id)` e `useRunB.chooseSpoil` rigenera e applica con
 * `applySpoilChoice`), incluso il filtro `node.type === 'battle'`: élite e boss non danno
 * Spoglie (§5 del piano). Non scrive nel `log` — è testo di racconto, non tocca il risultato.
 */
export function botApplySpoils(state: RunState, node: RunNode | undefined): RunState {
  if (!node || node.type !== 'battle') return state
  const offer = rollSpoils(state, spoilsRngForNode(state.seed, node.id))
  const choice = botPickSpoil(state, offer)
  return choice ? applySpoilChoice(state, offer, choice) : state
}
