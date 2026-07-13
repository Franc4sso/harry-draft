import type { ActiveDuo, ActiveRelic, DraftedWizard, Duo, DuoProgress, DuoSignal, SignalCount, Wizard } from '@/types'
import { DUOS } from '@/data/duos'
import { livingOf } from '@/game/engine/roster'

const ROLE_OF: Partial<Record<DuoSignal, string>> = {
  attaccante: 'Attaccante', supporto: 'Supporto', controllo: 'Controllo',
}
const TAG_OF: Partial<Record<DuoSignal, string>> = {
  veleno: 'veleno', esecuzione: 'esecuzione', scudirigen: 'scudirigen', magieOscure: 'magieOscure',
}
// A relic lights a tag signal via keyword OR the matching grant.
const relicLightsTag = (sig: DuoSignal, r: ActiveRelic['relic']): boolean => {
  const kw = r.keywords ?? []
  switch (sig) {
    case 'veleno': return kw.includes('veleno')
    case 'esecuzione': return kw.includes('esecuzione') || !!r.grantsExecute
    case 'scudirigen': return kw.includes('scudo') || !!r.grantsShieldConvert
    case 'magieOscure': return kw.includes('magieOscure') || !!r.grantsDarkMagic
    default: return false
  }
}

export function signalActive(sig: DuoSignal, team: DraftedWizard[], relics: ActiveRelic[]): boolean {
  if (sig === 'taunt') return team.some(d => d.wizard.role === 'Tank')
  const role = ROLE_OF[sig]
  if (role) return team.filter(d => d.wizard.role === role).length >= 2
  const tag = TAG_OF[sig]!
  const comp = team.filter(d => (d.wizard.tags ?? []).includes(tag)).length >= 2
  return comp || relics.some(({ relic }) => relicLightsTag(sig, relic))
}

/** Quanto è vicino un singolo segnale: quanti maghi contribuenti ha la squadra (`have`) vs quanti
 *  ne servono (`need`), o se una reliquia lo accende da sola (`byRelic`). Alimenta il conteggio
 *  "1/2" / "✓ reliquia" delle gemme nel pannello Duo del run. Le soglie rispecchiano signalActive:
 *  taunt=1 Tank, ruolo=2 di quel ruolo, tag=2 maghi OPPURE 1 reliquia. */
export function signalCount(sig: DuoSignal, team: DraftedWizard[], relics: ActiveRelic[]): SignalCount {
  if (sig === 'taunt') {
    return { have: team.filter(d => d.wizard.role === 'Tank').length, need: 1, byRelic: false }
  }
  const role = ROLE_OF[sig]
  if (role) {
    return { have: team.filter(d => d.wizard.role === role).length, need: 2, byRelic: false }
  }
  // tag: una reliquia lo accende da sola → byRelic (have=need, il conteggio maghi non conta più).
  if (relics.some(({ relic }) => relicLightsTag(sig, relic))) {
    return { have: 2, need: 2, byRelic: true }
  }
  const tag = TAG_OF[sig]!
  return { have: team.filter(d => (d.wizard.tags ?? []).includes(tag)).length, need: 2, byRelic: false }
}

export function litSignals(team: DraftedWizard[], relics: ActiveRelic[]): Set<DuoSignal> {
  const set = new Set<DuoSignal>()
  for (const d of DUOS) for (const s of d.signals) if (!set.has(s) && signalActive(s, team, relics)) set.add(s)
  return set
}

export function detectDuos(team: DraftedWizard[], relics: ActiveRelic[]): ActiveDuo[] {
  const lit = litSignals(team, relics)
  return DUOS.filter(d => d.signals.every(s => lit.has(s))).map(duo => ({ duo }))
}

export function duoProgress(team: DraftedWizard[], relics: ActiveRelic[]): DuoProgress[] {
  const lit = litSignals(team, relics)
  return DUOS.map(duo => {
    const litPair = duo.signals.map(s => lit.has(s)) as [boolean, boolean]
    return { duo, lit: litPair, active: litPair.every(Boolean), missing: duo.signals.filter(s => !lit.has(s)) }
  })
}

const ROLE_SIGNAL: Record<string, DuoSignal> = {
  Tank: 'taunt', Attaccante: 'attaccante', Supporto: 'supporto', Controllo: 'controllo',
}
const TAG_SIGNALS: DuoSignal[] = ['veleno', 'esecuzione', 'scudirigen', 'magieOscure']

/** The Duo signals that appear in at least one shipped Duo. */
export const DUO_SIGNALS_IN_USE: ReadonlySet<DuoSignal> = new Set(DUOS.flatMap(d => d.signals))

/** A wizard's Duo signals that feed a SHIPPED Duo (role-signal if in use, + its Duo-family tags). */
export function wizardDuoSignals(wizard: Wizard): DuoSignal[] {
  const out: DuoSignal[] = []
  const roleSig = ROLE_SIGNAL[wizard.role]
  if (roleSig && DUO_SIGNALS_IN_USE.has(roleSig)) out.push(roleSig)
  const tags = wizard.tags ?? []
  for (const t of TAG_SIGNALS) if (tags.includes(t) && DUO_SIGNALS_IN_USE.has(t)) out.push(t)
  return out
}

/** The shipped Duos a given signal feeds (for the "→ alimenta: …" tooltip). */
export function duosForSignal(signal: DuoSignal): Duo[] {
  return DUOS.filter(d => d.signals.includes(signal))
}

export type DuoPreview = { completes: Duo[]; advances: Duo[] }

/** Diff of duoProgress with `candidate` added: which Duos it completes (inactive→active)
 *  and which it advances (two-away → one-away). Uses livingOf so a fallen ally never inflates it. */
export function previewDuos(team: DraftedWizard[], relics: ActiveRelic[], candidate: DraftedWizard): DuoPreview {
  const before = new Map(duoProgress(livingOf(team), relics).map(p => [p.duo.id, p]))
  const after = duoProgress(livingOf([...team, candidate]), relics)
  const completes: Duo[] = []
  const advances: Duo[] = []
  for (const a of after) {
    const b = before.get(a.duo.id)!
    if (a.active && !b.active) completes.push(a.duo)
    else if (!a.active && a.missing.length === 1 && b.missing.length >= 2) advances.push(a.duo)
  }
  return { completes, advances }
}
