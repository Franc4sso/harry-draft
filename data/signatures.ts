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
const T2_ID = 0.30           // mcgonagall soak
const T2_PROC = 0.40
const T2_BURN = 0.55
const T2_EXPOSE = 0.35
const T2_WOUND_ATK = 25
const T2_WOUND_HP = 0.50
// Tier 3
const T3_PROC = 0.30
const T3_FREEZE = 0.25
const T3_SPD = 10
const T3_AD_ATK = 18
const T3_SHIELD = 30

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
const idReduce = (pct: number): TraitTrigger => ({
  kind: 'modifier', hook: 'modifyIncomingDamage', owner: 'target', apply: (v) => v * (1 - pct),
})
// NOTE on `duration` params below: statuses are either control/dot/regen/shield (kind
// 'stun'|'freeze'|'silence'|'disarm'|'dot'|'regen'|'shield') — these DO expire, and
// `duration` is live — or stat buff/debuff (kind 'buff'|'debuff', e.g. atkUp/weaken*/
// expose*/slow*) — these are PERMANENT by design (game/engine/status.ts tickStatuses
// never decrements a buff/debuff's `remaining`), so `duration` passed for a buff/debuff
// statusId (or via the inline `{ kind: 'buff', ... }` effect, always permanent) is inert:
// accepted for a uniform call shape but never read at runtime. `hitStatus`/`hitStatuses`/
// `tsSelfStatus`/`tsWoundedSelfStatus` are shared by both families (the call site's
// statusId decides); `tsSelfBuff`/`tsWoundedSelfBuff`/`adBuff` always build an inline
// buff, so their `duration` is unconditionally inert.
const hitStatus = (statusId: string, chance: number, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onHit', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'enemy', statusId, chance, duration }],
})
const hitStatuses = (list: Array<{ statusId: string; chance: number; duration?: number }>): TraitTrigger => ({
  kind: 'reactive', hook: 'onHit', owner: 'actor',
  effects: (): EffectSpec[] => list.map(s => ({ kind: 'applyStatus', target: 'enemy', statusId: s.statusId, chance: s.chance, duration: s.duration })),
})
const tsSelfStatus = (statusId: string, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', statusId, duration }],
})
// No `duration` param: these always build an inline `{ kind: 'buff', ... }` effect, and
// stat buffs are permanent by design (see the NOTE above), so a duration would be inert.
const tsSelfBuff = (stat: Stat, amount: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat, amount } }],
})
const tsWoundedSelfStatus = (statusId: string, hpFrac: number, duration?: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (ctx: HookCtx): EffectSpec[] => {
    const a = ctx.actor
    return a.maxHp > 0 && a.hp / a.maxHp < hpFrac ? [{ kind: 'applyStatus', target: 'self', statusId, duration }] : []
  },
})
const tsWoundedSelfBuff = (stat: Stat, amount: number, hpFrac: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
  effects: (ctx: HookCtx): EffectSpec[] => {
    const a = ctx.actor
    return a.maxHp > 0 && a.hp / a.maxHp < hpFrac ? [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat, amount } }] : []
  },
})
const adBuff = (stat: Stat, amount: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onAllyDeath', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat, amount } }],
})
const healShield = (amount: number, duration: number): TraitTrigger => ({
  kind: 'reactive', hook: 'onHeal', owner: 'actor',
  effects: (): EffectSpec[] => [{ kind: 'shield', amount, duration }],
})

const sig = (id: string, name: string, desc: string, ...triggers: TraitTrigger[]): Signature => ({ id, name, desc, triggers })

// ─── Catalogo (15) ────────────────────────────────────────────────────────────
// Onda 1.d (2026-07-27): potato da 60 a 15. Spec:
// docs/superpowers/specs/2026-07-27-onda-1d-potare-le-firme.md
//
// Le 60 firme si riducevano a ~12 meccaniche ripetute: 27 maghi di Tier 4 con effetti
// +/-10% (invisibili in un gioco che si GUARDA), un clone esatto (goyle/crabbe = "Stazza",
// stesso nome e stesso -10%), "-10% danni subiti" sotto 5 nomi diversi e "+10% danni"
// sotto 3. Sessanta righe non erano sessanta identita'.
//
// REGOLA DI SOPRAVVIVENZA: una firma resta solo se produce a schermo qualcosa che il
// giocatore puo' NOMINARE — un'icona di stato, un turno saltato, una barra che si muove
// contro corrente. Sono cadute tutte le firme fatte di soli moltiplicatori piatti (od /
// idReduce / healMod), i bonus condizionali senza segnale (odIfFaster) e ogni clone di una
// meccanica gia' coperta meglio altrove. La scelta e' per DISTINTIVITA', non per tier:
// Tier 1 3/3 - Tier 2 6/10 - Tier 3 6/20 - Tier 4 0/27.
//
// I 60 MAGHI RESTANO TUTTI nel gioco (data/wizards.ts intatto): un mago senza firma tiene
// nome, ritratto, casata, ruolo, tag, magia e statistiche, e alimenta Duo/Trii/Sinergie
// esattamente come prima — quei sistemi leggono tag+ruolo, mai le firme. Guard in
// tests/data/signatures.catalog.test.ts.
export const SIGNATURES: Signature[] = [
  // Tier 1 — le leggende, 2 trigger ciascuna
  sig('dumbledore', 'Bacchetta di Sambuco', 'Infligge +30% danni e i suoi colpi possono stordire.', od(T1_DMG), hitStatus('stun', T1_STUN, 1)),
  sig('voldemort', 'Terrore Immortale', 'Devasta i bersagli morenti (+50% sotto il 40% HP) e i suoi colpi seminano terrore (-ATT).', odExecute(T1_EXEC, T1_EXEC_HP), hitStatus('weaken3', T1_FEAR)),
  sig('harry', 'Coraggio del Grifondoro', 'Più è ferito più colpisce forte (fino a +70%); sotto metà vita l\'amore lo rigenera.', odFury(T1_FURY), tsWoundedSelfStatus('regen', T1_WOUND_HP, 3)),

  // Tier 2 — 6 su 10: cadono lucius (esecuzione clone di voldemort), moody (difesa clone
  // di mcgonagall), sirius (atkUp, stessa meccanica di cedric), viktor (+30% se piu'
  // veloce: condizione senza alcun segnale a schermo).
  sig('snape', 'Pozioni Letali', 'I suoi colpi avvelenano e possono esporre la difesa del bersaglio.', hitStatuses([{ statusId: 'veleno', chance: T2_BURN, duration: 2 }, { statusId: 'expose2', chance: T2_EXPOSE }])),
  sig('bellatrix', 'Tortura Cruciatus', 'I suoi colpi possono stordire il bersaglio.', hitStatus('stun', T2_PROC, 1)),
  // UNICA firma di soli numeri ammessa: e' il pilastro Tank del roster e il -30% e' il
  // singolo numero difensivo piu' grande del gioco. Ammessa per id nel guard test, cosi'
  // che aggiungerne una seconda rompa la suite.
  sig('mcgonagall', 'Trasfigurazione Marziale', 'Subisce il 30% di danni in meno.', idReduce(T2_ID)),
  sig('lupin', 'Furia Lupesca', 'Sotto metà vita la bestia si scatena: +ATT a ogni turno.', tsWoundedSelfBuff('atk', T2_WOUND_ATK, T2_WOUND_HP)),
  sig('kingsley', 'Pugno dell\'Auror', 'I suoi colpi possono rallentare pesantemente il bersaglio.', hitStatus('slow2', T2_PROC)),
  sig('fleur', 'Fascino Veela', 'I suoi colpi possono disarmare il bersaglio incantato.', hitStatus('disarm', T2_PROC, 2)),

  // Tier 3 — 6 su 20, tenuti per la meccanica, non per il tier: sono le uniche occorrenze
  // di silenzio, gelo, cura->scudo, morte-di-un-alleato, rigenerazione e velocita'.
  sig('hermione', 'Mente Brillante', 'I suoi colpi possono silenziare il bersaglio.', hitStatus('silence', T3_PROC, 2)),
  sig('cho', 'Lacrime Gelide', 'I suoi colpi possono congelare il bersaglio.', hitStatus('freeze', T3_FREEZE, 2)),
  sig('molly', 'Istinto Materno', 'Quando viene curata ottiene anche uno scudo.', healShield(T3_SHIELD, 2)),
  sig('neville', 'Coraggio Tardivo', 'Quando un alleato cade, si infuria (+ATT).', adBuff('atk', T3_AD_ATK)),
  sig('luna', 'Serenità', 'Si rigenera vita a ogni turno.', tsSelfStatus('regen', 3)),
  sig('tonks', 'Riflessi Mutanti', 'A inizio turno guadagna velocità.', tsSelfBuff('spd', T3_SPD)),
]

export const SIGNATURE_BY_ID: Record<string, Signature> = Object.fromEntries(
  SIGNATURES.map(s => [s.id, s]),
)
