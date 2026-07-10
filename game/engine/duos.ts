import type { ActiveDuo, ActiveRelic, DraftedWizard, DuoProgress, DuoSignal } from '@/types'
import { DUOS } from '@/data/duos'

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
