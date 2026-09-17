import type { RtSideId, Segno } from '@/types/rt'
import { RT } from './constants'
import { dealDamage } from './damage'
import { emit, noteCrescita, other, sideOf, type RtState, type RtUnit } from './state'
import { applyUnitStatus, applyVulnerabile, hasStatus, koUnit, reazione, statusOf } from './status'

const CAP: Record<Segno, number> = { fiamma: RT.fiamma.cap, veleno: Infinity, scossa: RT.scossa.cap }

export function applySegno(state: RtState, source: RtUnit | null, targetSide: RtSideId, segno: Segno, stacks: number, opts: { unitTarget?: RtUnit; reazioniFatte?: Set<string> } = {}): void {
  if (stacks <= 0) return
  const t = sideOf(state, targetSide)
  const hadVeleno = t.segni.veleno > 0, hadFiamma = t.segni.fiamma > 0, hadScossa = t.segni.scossa > 0
  t.segni[segno] = Math.min(CAP[segno], t.segni[segno] + stacks)
  emit(state, { kind: 'segno', side: source?.side, slot: source?.slot, targetSide, segno, stacks, value: t.segni[segno] })
  const ut = opts.unitTarget
  if (ut && !ut.ko && hasStatus(ut, 'gelo')) {
    if (segno === 'fiamma' && !opts.reazioniFatte?.has('Vapore')) {
      opts.reazioniFatte?.add('Vapore')
      ut.statuses = ut.statuses.filter(s => s.kind !== 'gelo')
      applyVulnerabile(state, targetSide, RT.reazioni.vaporeSecondi)
      reazione(state, 'Vapore', targetSide)
    } else if (segno === 'veleno' && !opts.reazioniFatte?.has('Necrosi')) {
      opts.reazioniFatte?.add('Necrosi')
      t.segni.veleno += RT.reazioni.necrosiVeleno
      const g = statusOf(ut, 'gelo'); if (g) g.remaining += RT.reazioni.necrosiGeloPlus
      reazione(state, 'Necrosi', targetSide, RT.reazioni.necrosiVeleno)
    }
  }
  const src = source ?? null
  if ((segno === 'fiamma' && hadVeleno) || (segno === 'veleno' && hadFiamma)) {
    const dmg = t.segni.veleno * RT.reazioni.miasmaPerStack
    reazione(state, 'Miasma', targetSide, dmg)
    dealDamage(state, src, targetSide, dmg, { name: 'Miasma' })
    if (src) noteCrescita(state, src, 'reazione:miasma')
  }
  if ((segno === 'fiamma' && hadScossa) || (segno === 'scossa' && hadFiamma)) {
    const dmg = (t.segni.fiamma + t.segni.scossa) * RT.reazioni.deflagrazionePerStack
    t.segni.fiamma = 0; t.segni.scossa = 0
    reazione(state, 'Deflagrazione', targetSide, dmg)
    dealDamage(state, src, targetSide, dmg, { name: 'Deflagrazione' })
    if (src) noteCrescita(state, src, 'reazione:deflagrazione')
  }
  if ((segno === 'veleno' && hadScossa) || (segno === 'scossa' && hadVeleno)) {
    const atk = sideOf(state, other(targetSide))
    t.conduzione = Math.max(t.conduzione, atk.mods.conduzioneSecondi ?? RT.reazioni.conduzioneSecondi)
    reazione(state, 'Conduzione', targetSide)
    if (src) noteCrescita(state, src, 'reazione:conduzione')
  }
}

export function applyGelo(state: RtState, source: RtUnit | null, target: RtUnit, secondi: number): boolean {
  const ok = applyUnitStatus(state, target, { kind: 'gelo', remaining: secondi }, source ?? undefined)
  if (!ok) return false
  const atk = sideOf(state, other(target.side)); const t = sideOf(state, target.side)
  if (atk.mods.esecuzioneAFreddo && !target.bossLeader && t.hp < t.hpMax * 0.5) {
    reazione(state, 'EsecuzioneAFreddo', target.side)
    koUnit(state, target, source ?? undefined)
  }
  return true
}
