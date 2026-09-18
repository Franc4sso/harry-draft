export const RT = {
  tick: 0.1,
  suddenDeathAt: 30,
  suddenDeathEvery: 0.5,
  suddenDeathBase: 0.01,
  suddenDeathGrowthPerSec: 0.005,
  maxSeconds: 60,
  cdMin: 2,
  cdClampMin: 3,
  cdClampMax: 8,
  levelHpMult: [1, 1.2, 1.4, 1.6] as const,
  levelCastMult: [1, 1.35, 1.7, 2.1] as const,
  levelCdBonus: [0, 0, 0.5, 1.0] as const,
  scudoPerDef: 2,
  fiamma: { every: 0.5, perStack: 2, cap: 20 },
  veleno: { every: 1, everyConduzione: 0.5, perStack: 2 },
  scossa: { perStack: 1, cap: 20 },
  vulnerabilePct: 0.15,
  reazioni: { miasmaPerStack: 4, deflagrazionePerStack: 5, conduzioneSecondi: 4, frantumaMult: 2, frantumaScossa: 2, vaporeSecondi: 4, necrosiVeleno: 3, necrosiGeloPlus: 1, baluardoPct: 0.3, bastionePct: 0.5, geloLentoMult: 1.5, impotenteGelo: 2 },
  lentezzaTimerMult: 0.5,
  triggerDepthMax: 8,
  sospesoMult: 1.5,
  sospesoLentezza: 1,
  esecuzioneAFreddoCd: 4,
} as const

const EPS = 1e-9
export const near = (a: number, b: number) => Math.abs(a - b) < EPS
export const round1 = (x: number) => Math.round(x * 10) / 10
export const round2 = (x: number) => Math.round(x * 100) / 100

export function cooldownFor(spd: number, level: 1 | 2 | 3 | 4, cdMod = 0): number {
  const base = Math.min(RT.cdClampMax, Math.max(RT.cdClampMin, 9 - spd / 5))
  const bonus = RT.levelCdBonus[level - 1]!
  return Math.max(RT.cdMin, base - bonus + cdMod)
}
export const levelCastMult = (level: 1 | 2 | 3 | 4) => RT.levelCastMult[level - 1]!
export const levelHpMult = (level: 1 | 2 | 3 | 4) => RT.levelHpMult[level - 1]!
