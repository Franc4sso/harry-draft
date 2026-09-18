import type { ActiveRelic, DraftedWizard } from '@/types'
import type { AbilityLine, RtSideMods } from '@/types/rt'
import { detectDuos, signalGrade } from '@/game/engine/duos'
import { trioGates } from '@/game/engine/trios'
import { relicMatchesCondition } from '@/game/engine/relics'
import { RELICS_RT } from '@/data/relicsRt'

function mergeMods(into: RtSideMods, add: Partial<RtSideMods>): void {
  for (const [k, v] of Object.entries(add) as [keyof RtSideMods, unknown][]) {
    if (v === undefined) continue
    switch (k) {
      case 'velenoMult': case 'scudoInizialeMult': case 'scudoProdottoMult': into[k] = (into[k] ?? 1) * (v as number); break
      case 'muroVivente': case 'curaEccessoToScudo': case 'dannoPct': case 'dannoSubitoPct': case 'curaPct': case 'contagioOnKo': case 'mietitore': into[k] = (into[k] ?? 0) + (v as number); break
      case 'cancrenaSotto': case 'conduzioneSecondi': into[k] = Math.max(into[k] ?? 0, v as number); break
      case 'magieOscure': { const cur = into.magieOscure ?? { bonus: 0, recoil: 0 }; const n = v as { bonus: number; recoil: number }; into.magieOscure = { bonus: cur.bonus + n.bonus, recoil: cur.recoil + n.recoil }; break }
      case 'sogliaBonusPerKo': { const cur = into.sogliaBonusPerKo; const n = v as { step: number; cap: number }; into.sogliaBonusPerKo = cur ? { step: Math.max(cur.step, n.step), cap: Math.max(cur.cap, n.cap) } : n; break }
      case 'segnoOnCast': { into.segnoOnCast = { ...(into.segnoOnCast ?? {}) }; for (const [s, n] of Object.entries(v as Record<string, number>)) (into.segnoOnCast as Record<string, number>)[s] = ((into.segnoOnCast as Record<string, number>)[s] ?? 0) + n; break }
      case 'lines': into.lines = [...(into.lines ?? []), ...(v as AbilityLine[])]; break
      default: (into as Record<string, unknown>)[k] = (into as Record<string, unknown>)[k] || v   // booleani: OR
    }
  }
}

const DUO_MODS: Record<string, Partial<RtSideMods>> = {
  'cancrena': { cancrenaSotto: 0.4 }, 'miasma': { contagioOnKo: 3 }, 'untore': { untore: true },
  'muro-vivente': { muroVivente: 0.5 }, 'esecuzione-a-freddo': { esecuzioneAFreddo: true }, 'mietitore': { mietitore: 6 },
}

export function sideModsFor(team: DraftedWizard[], relics: ActiveRelic[]): RtSideMods {
  const m: RtSideMods = {}
  const duos = detectDuos(team, relics)
  for (const d of duos) mergeMods(m, DUO_MODS[d.duo.id] ?? {})
  for (const { house, grade } of trioGates(team, duos)) {
    if (house === 'Grifondoro') mergeMods(m, grade === 1 ? { fiammaNonDecade: true, segnoOnCast: { fiamma: 1 } } : { fiammaNonDecade: true })
    if (house === 'Serpeverde') mergeMods(m, { segnoOnCast: { veleno: grade === 1 ? 2 : 1 } })
    if (house === 'Corvonero') mergeMods(m, { segnoOnCast: { scossa: grade === 1 ? 2 : 1 } })
    if (house === 'Tassorosso') mergeMods(m, { scudoInizialeMult: grade === 1 ? 2 : 1.5 })
  }
  if (signalGrade('veleno', team, relics) === 2) mergeMods(m, { velenoMult: 1.5, conduzioneSecondi: 8 })
  if (signalGrade('esecuzione', team, relics) === 2) mergeMods(m, { sogliaBonusPerKo: { step: 0.05, cap: 0.25 } })
  if (signalGrade('scudirigen', team, relics) === 2) mergeMods(m, { scudoProdottoMult: 1.5, curaEccessoToScudo: 0.35 })
  if (signalGrade('magieOscure', team, relics) === 2) mergeMods(m, { magieOscure: { bonus: 0.3, recoil: 0 } })
  for (const ar of relics) {
    const rt = RELICS_RT[ar.relic.id]
    if (!rt) continue
    if (rt.mods) mergeMods(m, rt.mods)
    if (rt.lines?.length && relicMatchesCondition(team, ar.relic.condition)) mergeMods(m, { lines: rt.lines })
  }
  return m
}
