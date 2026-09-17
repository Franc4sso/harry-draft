import type { RtSideId, Segno } from '@/types/rt'
import { levelCastMult, round1 } from './constants'
import { checkCond } from './cond'
import { addShield, dealDamage, heal } from './damage'
import { activeMulticast, applyEffect, dannoFlat, dannoMult } from './effects'
import { adjacent } from './grid'
import { applyGelo, applySegno } from './segni'
import { alive, emit, noteCrescita, other, sideOf, unitAt, type RtState, type RtUnit } from './state'
import { applyUnitStatus, applyVulnerabile, hasStatus, rianimaUnit } from './status'
import { selectTargets, unitTarget } from './targeting'

export function crescitaBonus(u: RtUnit): number {
  const c = u.spell.crescita
  if (!c) return 0
  const n = c.kind === 'memoria' ? (u.memoria?.[u.spell.id] ?? 0) : u.crescendo
  const raw = n * c.per
  return c.cap !== undefined ? Math.min(c.cap, raw) : raw
}
const SEGNI: readonly Segno[] = ['fiamma', 'veleno', 'scossa']
const bonusIf = (u: RtUnit, unit: string) => (u.spell.crescita?.unit === unit ? crescitaBonus(u) : 0)
/** Secondi tolti al cooldown dalla Crescita `cd`. Lo legge `simulate`. */
export const spellCdBonus = (u: RtUnit) => bonusIf(u, 'cd')

export function castSpell(state: RtState, u: RtUnit, opts: { innesco?: boolean } = {}): boolean {
  if (u.ko) return false
  const side = u.side, en: RtSideId = other(side)
  const own = sideOf(state, side)
  const sp = u.spell
  const d = u.statuses.findIndex(s => s.kind === 'disarmo')
  if (d >= 0) {
    u.statuses.splice(d, 1)
    emit(state, { kind: 'cast', side, slot: u.slot, name: 'Disarmato', value: 0 })
    return false
  }
  // Crescendo `lancioSenzaGelo`: un Gelo subìto dopo l'ultimo cast azzera il contatore PRIMA di questo cast.
  // L'incremento (per `lancio` e `lancioSenzaGelo`) avviene in fondo: il primo cast parte da 0 ("per ogni cast precedente").
  const c = sp.crescita
  if (c?.kind === 'crescendo' && c.trigger === 'lancioSenzaGelo' && u.lastGeloAt > u.lastCastAt) u.crescendo = 0
  u.casts += 1
  u.lastCastAt = state.t
  const multicast = (sp.multicast ?? 1) + (activeMulticast(state, u) - 1) + Math.floor(bonusIf(u, 'colpi'))
  emit(state, { kind: 'cast', side, slot: u.slot, name: sp.name, value: multicast })
  const ut = unitTarget(state, side, u.slot, { ignoraCopertura: own.mods.ignoraCopertura }) ?? undefined
  const comboOk = sp.combo ? checkCond(state, u, sp.combo.cond, { bersaglio: ut }) : false
  // Spec §4.2: le reazioni 4-6 (Frantuma, Vapore, Necrosi) scattano UNA volta per cast, sulla prima risoluzione — non per colpo di Multicast.
  const reazioniFatte = new Set<string>()
  for (let i = 0; i < multicast; i++) {
    // Ordine fisso: `Object.entries` dipenderebbe dall'ordine di inserimento del chiamante.
    if (own.mods.segnoOnCast) for (const k of SEGNI) { const n = own.mods.segnoOnCast[k]; if (n) applySegno(state, u, en, k, n, { unitTarget: ut, reazioniFatte }) }
    switch (sp.verb) {
      case 'danno': {
        let amount = u.stats.atk * (sp.potenza ?? 0) * levelCastMult(u.level) * dannoMult(state, u) * (1 + bonusIf(u, 'pct'))
        const oscura = !!sp.keywords?.includes('magieOscure')
        if (oscura && own.mods.magieOscure) amount *= 1 + own.mods.magieOscure.bonus
        amount = Math.round(amount) + dannoFlat(state, u) + Math.round(bonusIf(u, 'danno'))
        dealDamage(state, u, en, amount, { diretto: true, unitTarget: ut, name: sp.name, magieOscure: oscura, frantumaMult: sp.frantumaMult, reazioniFatte })
        break
      }
      // `squadraCura` e Untore vivono in `heal()`: scattano da OGNI cura, non solo da questo verbo.
      case 'cura': heal(state, side, (sp.cura ?? 0) + bonusIf(u, 'cura'), u); break
      case 'scudo': addShield(state, side, (sp.scudo ?? 0) + bonusIf(u, 'scudo'), u); break
      case 'carica': if (sp.carica) applyEffect(state, u, side, selectTargets(state, u, sp.carica.target), { kind: 'carica', secondi: sp.carica.secondi + bonusIf(u, 'secondi') }, { target: sp.carica.target }); break
      case 'protego': {
        const cand = adjacent(u.slot).map(s => unitAt(state, side, s)).filter((x): x is RtUnit => !!x && !x.ko && !hasStatus(x, 'protego'))
        applyUnitStatus(state, cand[0] ?? u, { kind: 'protego', remaining: 1 })
        break
      }
      case 'rianima': {
        const ko = own.units.filter(x => x.ko).sort((a, b) => a.slot - b.slot)[0]
        if (ko) rianimaUnit(state, ko, u); else heal(state, side, 20, u)
        break
      }
      case 'buff': if (sp.buff) {
        const k = 'buff:' + sp.id
        if ((u.limits[k] ?? 0) < sp.buff.max) { u.limits[k] = (u.limits[k] ?? 0) + 1; for (const t of alive(state, side)) t.dannoPctBonus.push({ pct: sp.buff.dannoPct, until: 'battaglia' }) }
        break
      }
      case 'status': break
    }
    if (sp.segno) applySegno(state, u, en, sp.segno.kind, sp.segno.stacks + Math.round(bonusIf(u, 'segno')), { unitTarget: ut, reazioniFatte })
    if (sp.gelo && ut) applyGelo(state, u, ut, round1((sp.gelo + bonusIf(u, 'secondi')) * (1 + (own.durataStatusPct.gelo ?? 0))))
    if (sp.unitStatus && ut) {
      const us = sp.unitStatus
      if (us.kind === 'disarmo') applyUnitStatus(state, ut, { kind: 'disarmo', remaining: 1 }, u)
      else {
        // Solo Silenzio e Lentezza scalano con `durataStatusPct` (Indebolito e Sospeso non hanno una voce).
        const pct = (us.kind === 'silenzio' || us.kind === 'lentezza') ? (own.durataStatusPct[us.kind] ?? 0) : 0
        applyUnitStatus(state, ut, { kind: us.kind, remaining: round1((us.secondi ?? 0) * (1 + pct)), pct: us.pct }, u)
      }
    }
    if (sp.teamStatus) applyVulnerabile(state, en, sp.teamStatus.secondi + bonusIf(u, 'secondi'))
  }
  if (sp.combo && comboOk) {
    const tgt = sp.combo.target ?? 'opposto'
    const targets = tgt === 'opposto' && ut ? [ut] : selectTargets(state, u, tgt, undefined, { bersaglio: ut })
    applyEffect(state, u, side, targets, sp.combo.effect, { target: tgt, unitTarget: ut, abilityId: `combo:${sp.id}` })
  }
  noteCrescita(state, u, 'lancio')
  if (c?.kind === 'crescendo' && c.trigger === 'lancioSenzaGelo') u.crescendo += 1   // `lancio` lo incrementa già noteCrescita
  state.queue.push({ trigger: 'lancio', side, unitKey: u.key })
  for (const s of adjacent(u.slot)) { const n = unitAt(state, side, s); if (n && !n.ko) { n.lastAdjacentCastAt = state.t; state.queue.push({ trigger: 'adiacenteLancia', side, unitKey: n.key, bersaglioKey: u.key }) } }
  void opts
  return true
}
