import type { EffectSpec, HookCtx, Signature, Stat, TraitTrigger } from '@/types'

// ─── Budget constants (single tuning surface; see spec §3) ───────────────────
// Tier 1 (legends)
const T1_DMG = 0.30          // dumbledore flat OD
const T1_EXEC = 0.50         // voldemort OD vs sub-threshold
const T1_EXEC_HP = 0.40
const T1_FURY = 0.70         // harry OD scaling
const T1_STUN = 0.40         // dumbledore onHit stun chance
const T1_FEAR = 0.35         // voldemort onHit weaken3 chance
const T1_WOUND_HP = 0.50     // harry regen-when-wounded gate
// Tier 2
const T2_DMG = 0.30
const T2_EXEC = 0.45
const T2_EXEC_HP = 0.35
const T2_ID = 0.30           // mcgonagall soak
const T2_PROC = 0.40
const T2_BURN = 0.55
const T2_EXPOSE = 0.35
const T2_WOUND_ATK = 25
const T2_WOUND_HP = 0.50
// Tier 3
const T3_DMG = 0.18
const T3_EXEC = 0.20
const T3_EXEC_HP = 0.50
const T3_ID = 0.16
const T3_PROC = 0.30
const T3_FREEZE = 0.25
const T3_BURN = 0.40
const T3_COMBO = 0.35
const T3_HEAL = 0.20
const T3_SPD = 10
const T3_AD_ATK = 18
const T3_SHIELD = 30
const T3_WOUND_HP = 0.40
// Tier 4
const T4_DMG = 0.10
const T4_EXEC = 0.20
const T4_ID = 0.10
const T4_PROC = 0.18
const T4_BUFF = 5
const T4_AD_ATK = 6
const T4_SHIELD = 18
const T4_WOUND_SPD = 6
const T4_WOUND_HP = 0.35

// ─── Trigger builders ────────────────────────────────────────────────────────
const od = (pct: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v * (1 + pct),
})
const odExecute = (pct: number, hpFrac: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
  apply: (v, ctx) => {
    const t = ctx.target
    return t && t.maxHp > 0 && t.hp / t.maxHp < hpFrac ? v * (1 + pct) : v
  },
})
const odFury = (maxBonus: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
  apply: (v, ctx) => {
    const a = ctx.actor
    const missing = a.maxHp > 0 ? 1 - a.hp / a.maxHp : 0
    return v * (1 + missing * maxBonus)
  },
})
const odIfFaster = (pct: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
  apply: (v, ctx) => (ctx.target && ctx.actor.buffedStats.spd > ctx.target.buffedStats.spd ? v * (1 + pct) : v),
})
const idReduce = (pct: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyIncomingDamage', owner: 'target', apply: (v) => v * (1 - pct),
})
const healMod = (pct: number): TraitTrigger => ({
  // owner 'actor' → boosts heals the owner CASTS (heal handler emits modifyHealing with actor=healer).
  kind: 'modifier', hook: 'modifyHealing', owner: 'actor', apply: (v) => v * (1 + pct),
})
const hitStatus = (statusId: string, chance: number, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onHit', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'enemy', statusId, chance, duration }],
})
const hitStatuses = (list: Array<{ statusId: string; chance: number; duration?: number }>): TraitTrigger => ({
  kind: 'reactive', hook: 'onHit', owner: 'actor',
  effects: (): EffectSpec[] => list.map(s => ({ kind: 'applyStatus', target: 'enemy', statusId: s.statusId, chance: s.chance, duration: s.duration })),
})
const hitSelfStatus = (statusId: string, chance: number, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onHit', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', statusId, chance, duration }],
})
const tsSelfStatus = (statusId: string, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', statusId, duration }],
})
const tsSelfBuff = (stat: Stat, amount: number, duration: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat, amount, duration } }],
})
const tsWoundedSelfStatus = (statusId: string, hpFrac: number, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (ctx: HookCtx): EffectSpec[] => {
    const a = ctx.actor
    return a.maxHp > 0 && a.hp / a.maxHp < hpFrac ? [{ kind: 'applyStatus', target: 'self', statusId, duration }] : []
  },
})
const tsWoundedSelfBuff = (stat: Stat, amount: number, duration: number, hpFrac: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (ctx: HookCtx): EffectSpec[] => {
    const a = ctx.actor
    return a.maxHp > 0 && a.hp / a.maxHp < hpFrac ? [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat, amount, duration } }] : []
  },
})
const adBuff = (stat: Stat, amount: number, duration: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onAllyDeath', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat, amount, duration } }],
})
const healShield = (amount: number, duration: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onHeal', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'shield', amount, duration }],
})

const sig = (id: string, name: string, desc: string, ...triggers: TraitTrigger[]): Signature => ({ id, name, desc, triggers })

// ─── Catalog (60) ─────────────────────────────────────────────────────────────
export const SIGNATURES: Signature[] = [
  // Tier 1 — 2 triggers each
  sig('dumbledore', 'Bacchetta di Sambuco', 'Infligge +30% danni e i suoi colpi possono stordire.', od(T1_DMG), hitStatus('stun', T1_STUN, 1)),
  sig('voldemort', 'Terrore Immortale', 'Devasta i bersagli morenti (+50% sotto il 40% HP) e i suoi colpi seminano terrore (-ATT).', odExecute(T1_EXEC, T1_EXEC_HP), hitStatus('weaken3', T1_FEAR, 2)),
  sig('harry', 'Coraggio del Grifondoro', 'Più è ferito più colpisce forte (fino a +70%); sotto metà vita l\'amore lo rigenera.', odFury(T1_FURY), tsWoundedSelfStatus('regen', T1_WOUND_HP, 3)),

  // Tier 2
  sig('snape', 'Pozioni Letali', 'I suoi colpi avvelenano e possono esporre la difesa del bersaglio.', hitStatuses([{ statusId: 'burn', chance: T2_BURN, duration: 2 }, { statusId: 'expose2', chance: T2_EXPOSE, duration: 2 }])),
  sig('bellatrix', 'Tortura Cruciatus', 'I suoi colpi possono stordire il bersaglio.', hitStatus('stun', T2_PROC, 1)),
  sig('mcgonagall', 'Trasfigurazione Marziale', 'Subisce il 30% di danni in meno.', idReduce(T2_ID)),
  sig('sirius', 'Lealtà Feroce', 'Mettendo a segno un colpo può rinforzare il proprio attacco.', hitSelfStatus('atkUp', T2_PROC, 2)),
  sig('lupin', 'Furia Lupesca', 'Sotto metà vita la bestia si scatena: +ATT a ogni turno.', tsWoundedSelfBuff('atk', T2_WOUND_ATK, 2, T2_WOUND_HP)),
  sig('moody', 'Vigilanza Costante', 'Subisce -22% danni e mantiene sempre la guardia alta (+DIF).', idReduce(0.22), tsSelfStatus('defUp', 1)),
  sig('lucius', 'Esecutore Spietato', 'Infligge +45% danni ai bersagli sotto il 35% di vita.', odExecute(T2_EXEC, T2_EXEC_HP)),
  sig('kingsley', 'Pugno dell\'Auror', 'I suoi colpi possono rallentare pesantemente il bersaglio.', hitStatus('slow2', T2_PROC, 2)),
  sig('fleur', 'Fascino Veela', 'I suoi colpi possono disarmare il bersaglio incantato.', hitStatus('disarm', T2_PROC, 2)),
  sig('viktor', 'Tuffo del Cercatore', 'Infligge +30% danni quando è più veloce del bersaglio.', odIfFaster(T2_DMG)),

  // Tier 3
  sig('hermione', 'Mente Brillante', 'I suoi colpi possono silenziare il bersaglio.', hitStatus('silence', T3_PROC, 2)),
  sig('ron', 'Mossa del Cavaliere', 'Subisce -16% danni.', idReduce(T3_ID)),
  sig('draco', 'Tocco Velenoso', 'I suoi colpi possono avvelenare il bersaglio.', hitStatus('burn', T3_BURN, 2)),
  sig('ginny', 'Maleficio Pipistrello', 'I suoi colpi possono indebolire l\'attacco del bersaglio.', hitStatus('weaken2', T3_PROC, 2)),
  sig('neville', 'Coraggio Tardivo', 'Quando un alleato cade, si infuria (+ATT).', adBuff('atk', T3_AD_ATK, 3)),
  sig('luna', 'Serenità', 'Si rigenera vita a ogni turno.', tsSelfStatus('regen', 3)),
  sig('fred', 'Caos Gemello', 'I suoi colpi possono stordire il bersaglio.', hitStatus('stun', T3_PROC, 1)),
  sig('george', 'Sorpresa Esplosiva', 'Infligge +18% danni.', od(T3_DMG)),
  sig('molly', 'Istinto Materno', 'Quando viene curata ottiene anche uno scudo.', healShield(T3_SHIELD, 2)),
  sig('arthur', 'Tocco Premuroso', 'Le sue cure sono più efficaci (+20%).', healMod(T3_HEAL)),
  sig('tonks', 'Riflessi Mutanti', 'A inizio turno guadagna velocità.', tsSelfBuff('spd', T3_SPD, 1)),
  sig('narcissa', 'Patto Materno', 'Sotto il 40% di vita si rigenera.', tsWoundedSelfStatus('regen', T3_WOUND_HP, 3)),
  sig('dolohov', 'Maledizione Viola', 'I suoi colpi possono avvelenare e rallentare.', hitStatuses([{ statusId: 'burn', chance: T3_COMBO, duration: 2 }, { statusId: 'slow1', chance: T3_COMBO, duration: 2 }])),
  sig('greyback', 'Morso Selvaggio', 'Infligge +20% danni ai bersagli sotto metà vita.', odExecute(T3_EXEC, T3_EXEC_HP)),
  sig('cho', 'Lacrime Gelide', 'I suoi colpi possono congelare il bersaglio.', hitStatus('freeze', T3_FREEZE, 2)),
  sig('cedric', 'Gioco Leale', 'Mettendo a segno un colpo può rinforzare il proprio attacco.', hitSelfStatus('atkUp', T3_PROC, 2)),
  sig('slughorn', 'Favori Utili', 'Le sue cure sono più efficaci (+20%).', healMod(T3_HEAL)),
  sig('hagrid', 'Forza del Gigante', 'Colpi pesanti: infligge +18% danni.', od(T3_DMG)),
  sig('flitwick', 'Maestro di Incantesimi', 'I suoi colpi possono silenziare il bersaglio.', hitStatus('silence', T3_PROC, 2)),
  sig('sprout', 'Mandragole', 'Si rigenera vita a ogni turno.', tsSelfStatus('regen', 3)),

  // Tier 4
  sig('seamus', 'Tendenza Esplosiva', 'I suoi colpi possono incendiare il bersaglio.', hitStatus('burn', T4_PROC, 2)),
  sig('dean', 'Mano Ferma', 'Infligge +10% danni.', od(T4_DMG)),
  sig('parvati', 'Divinazione', 'I suoi colpi possono indebolire il bersaglio.', hitStatus('weaken1', T4_PROC, 2)),
  sig('lavender', 'Devozione', 'Quando viene curata ottiene anche un piccolo scudo.', healShield(T4_SHIELD, 2)),
  sig('pansy', 'Lingua Tagliente', 'I suoi colpi possono silenziare il bersaglio.', hitStatus('silence', T4_PROC, 2)),
  sig('goyle', 'Stazza', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('crabbe', 'Stazza', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('marcus', 'Gioco Duro', 'Più è ferito più colpisce forte (fino a +20%).', odFury(T4_EXEC)),
  sig('pettigrew', 'Codardia Vigile', 'Sotto il 35% di vita scatta più veloce.', tsWoundedSelfBuff('spd', T4_WOUND_SPD, 2, T4_WOUND_HP)),
  sig('padma', 'Studio Attento', 'I suoi colpi possono disarmare il bersaglio.', hitStatus('disarm', T4_PROC, 2)),
  sig('terry', 'Concentrazione', 'I suoi colpi possono stordire il bersaglio.', hitStatus('stun', T4_PROC, 1)),
  sig('michael', 'Slancio', 'Infligge +10% danni.', od(T4_DMG)),
  sig('roger', 'Resistenza', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('marietta', 'Cautela', 'A inizio turno rinforza la difesa.', tsSelfBuff('def', T4_BUFF, 1)),
  sig('anthony', 'Disciplina', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('hannah', 'Gentilezza', 'Quando viene curata ottiene anche un piccolo scudo.', healShield(T4_SHIELD, 2)),
  sig('susan', 'Memoria di Famiglia', 'Si rigenera vita a ogni turno.', tsSelfStatus('regen', 3)),
  sig('ernie', 'Orgoglio Tassorosso', 'Subisce -10% danni.', idReduce(T4_ID)),
  sig('justin', 'Determinazione', 'Infligge +10% danni.', od(T4_DMG)),
  sig('zacharias', 'Spavalderia', 'I suoi colpi possono indebolire il bersaglio.', hitStatus('weaken1', T4_PROC, 2)),
  sig('leanne', 'Lealtà', 'Quando viene curata ottiene anche un piccolo scudo.', healShield(T4_SHIELD, 2)),
  sig('eloise', 'Caparbietà', 'Quando un alleato cade, si infuria (+ATT).', adBuff('atk', T4_AD_ATK, 2)),
  sig('theodore', 'Calcolo Freddo', 'I suoi colpi possono stordire il bersaglio.', hitStatus('stun', T4_PROC, 1)),
  sig('blaise', 'Eleganza Tagliente', 'I suoi colpi possono incendiare il bersaglio.', hitStatus('burn', T4_PROC, 2)),
  sig('astoria', 'Grazia', 'Quando viene curata ottiene anche un piccolo scudo.', healShield(T4_SHIELD, 2)),
  sig('penelope', 'Prefetto Diligente', 'A inizio turno rinforza la difesa.', tsSelfBuff('def', T4_BUFF, 1)),
  sig('megan', 'Discrezione', 'I suoi colpi possono rallentare il bersaglio.', hitStatus('slow1', T4_PROC, 2)),
]

export const SIGNATURE_BY_ID: Record<string, Signature> = Object.fromEntries(
  SIGNATURES.map(s => [s.id, s]),
)
