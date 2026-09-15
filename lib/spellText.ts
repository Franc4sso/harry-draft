import { STATUS_BY_ID } from '@/data/statuses'
import type { Spell, SpellEffect, Stat } from '@/types/spell'

export interface SpellHeadline { value: string; unit: string }

/** Etichette brevi delle statistiche, minuscole: stanno SOTTO il numero, dove
 *  l'occhio le legge come unità di misura, non come intestazione. */
const STAT_UNIT: Record<Stat, string> = { hp: 'vita', atk: 'att', def: 'dif', spd: 'vel' }

/** Verbo per un debuff/buff di statistica. Il numero lo precede già, quindi il verbo
 *  dice solo COSA succede, non quanto. */
const DEBUFF_VERB: Partial<Record<Stat, string>> = {
  spd: 'rallenta', atk: 'indebolisce', def: 'espone', hp: 'logora',
}

const BUFF_VERB: Partial<Record<Stat, string>> = {
  spd: 'accelera', atk: 'rinforza', def: 'protegge', hp: 'rinvigorisce',
}

const CONTROL_VERB: Record<string, string> = {
  stun: 'stordisce', freeze: 'congela', silence: 'silenzia', disarm: 'disarma',
}

/** Il segno meno tipografico (U+2212), non il trattino: si allinea alle cifre
 *  ed è largo quanto un `+`, quindi le colonne di numeri restano dritte. */
const MINUS = '−'

function firstEffect(spell: Spell): SpellEffect | undefined {
  return spell.effects?.[0]
}

/** Il dato che il giocatore confronta fra due maghi, con la sua unità.
 *  Ordine di precedenza: danno → cura → modifica di statistica → durata del controllo. */
export function spellHeadline(spell: Spell): SpellHeadline {
  if (spell.power !== undefined) return { value: `×${spell.power}`, unit: 'danni' }
  if (spell.heal !== undefined) return { value: `+${spell.heal}`, unit: 'vita' }

  const e = firstEffect(spell)
  if (e && (e.kind === 'debuff' || e.kind === 'buff') && e.stat && e.amount !== undefined) {
    const sign = e.kind === 'buff' ? '+' : MINUS
    return { value: `${sign}${e.amount}`, unit: STAT_UNIT[e.stat] }
  }
  if (e && e.kind === 'dot' && e.amount !== undefined) {
    return { value: `${e.amount}`, unit: 'a turno' }
  }
  if (e && CONTROL_VERB[e.kind] && e.duration !== undefined) {
    return { value: `${e.duration}`, unit: e.duration === 1 ? 'turno' : 'turni' }
  }

  // Magie senza `effects` che passano per `spec` (scudi, cure di squadra, status
  // applicati) — nessuna in `effects[0]`, ma spesso una in `spec`. Applichiamo la
  // stessa gerarchia guardando la prima voce di `spec`.
  const s = spell.spec?.[0]
  if (s) {
    if (s.kind === 'heal') return { value: `+${s.amount}`, unit: 'vita' }
    if (s.kind === 'shield') return { value: `+${s.amount}`, unit: 'scudo' }
    if (s.kind === 'revive') return { value: `${Math.round(s.fraction * 100)}%`, unit: 'vita' }
    if (s.kind === 'damage') return { value: `×${s.power}`, unit: 'danni' }
    if (s.kind === 'applyStatus' && s.statusId) {
      const def = STATUS_BY_ID[s.statusId]
      if (def) {
        if ((def.kind === 'buff' || def.kind === 'debuff') && def.statMod) {
          const sign = def.kind === 'buff' ? '+' : MINUS
          const amt = def.statMod.pct ? `${def.statMod.amount}%` : `${def.statMod.amount}`
          return { value: `${sign}${amt}`, unit: STAT_UNIT[def.statMod.stat] }
        }
        const d = s.duration ?? def.defaultDuration ?? 1
        return { value: `${d}`, unit: d === 1 ? 'turno' : 'turni' }
      }
    }
    if (s.kind === 'protego') return { value: `${s.count ?? 1}`, unit: s.count === 1 || s.count === undefined ? 'incantesimo' : 'incantesimi' }
  }

  if (spell.revive !== undefined) {
    return { value: `${Math.round(spell.revive * 100)}%`, unit: 'vita' }
  }

  // Magie che agiscono solo via `spec` non riconosciuto: niente numero
  // da mettere in colonna, la riga si regge sul nome e sul verbo.
  return { value: '—', unit: '' }
}

/** Cosa fa la magia, in parole. Mai gergo di sistema, mai parentesi annidate,
 *  e il singolare concorda (il vecchio testo diceva "per 1 turni"). */
export function spellVerb(spell: Spell): string {
  const parts: string[] = []

  for (const e of spell.effects ?? []) {
    if (e.kind === 'debuff' || e.kind === 'buff') {
      const verbMap = e.kind === 'buff' ? BUFF_VERB : DEBUFF_VERB
      const verb = (e.stat && verbMap[e.stat]) ?? 'altera'
      // Gli effetti di statistica sono permanenti e cumulativi (data/statuses.ts):
      // al giocatore basta sapere che l'effetto RESTA.
      parts.push(`${verb}, e resta`)
    } else if (e.kind === 'dot') {
      const d = e.duration ?? 1
      parts.push(`brucia ${e.amount ?? 0} per ${d} ${d === 1 ? 'turno' : 'turni'}`)
    } else if (CONTROL_VERB[e.kind]) {
      const d = e.duration ?? 1
      parts.push(`${CONTROL_VERB[e.kind]} ${d} ${d === 1 ? 'turno' : 'turni'}`)
    }
  }

  for (const s of spell.spec ?? []) {
    if (s.kind === 'shield') { parts.push('assorbe danno'); continue }
    if (s.kind === 'heal') { parts.push('cura'); continue }
    if (s.kind === 'revive') { parts.push(`rianima al ${Math.round(s.fraction * 100)}% di vita`); continue }
    if (s.kind === 'damage') { parts.push('morde'); continue }
    if (s.kind === 'protego') { parts.push('annulla il prossimo incantesimo'); continue }
    if (s.kind !== 'applyStatus' || !s.statusId) continue
    const def = STATUS_BY_ID[s.statusId]
    if (!def) continue
    if (def.kind === 'buff' || def.kind === 'debuff') {
      const verbMap = def.kind === 'buff' ? BUFF_VERB : DEBUFF_VERB
      const verb = (def.statMod?.stat && verbMap[def.statMod.stat]) ?? 'altera'
      parts.push(`${verb}, e resta`)
    } else {
      const d = s.duration ?? def.defaultDuration ?? 1
      const verb = CONTROL_VERB[def.kind] ?? def.name.toLowerCase()
      parts.push(`${verb} ${d} ${d === 1 ? 'turno' : 'turni'}`)
    }
  }

  if (spell.revive !== undefined) {
    parts.push(`rianima al ${Math.round(spell.revive * 100)}% di vita`)
  }

  // Nessun effetto meccanico: resta la descrizione d'autore, che per le magie
  // di solo danno è già breve ("Esplosione concussiva").
  if (parts.length === 0) return spell.desc ?? ''
  return parts.join(', ')
}

/** La precisione. Una magia che non può mancare dice «sempre»: un «100%»
 *  inviterebbe a confrontarlo con un 95%, ma non è la stessa cosa. */
export function spellAccuracy(spell: Spell): { pct: number; label: string } {
  const pct = Math.round(spell.hitChance * 100)
  return { pct, label: pct >= 100 ? 'sempre' : `${pct}%` }
}

/** Il ritmo reale. `cooldown: 1` significa un turno di attesa, quindi la magia
 *  si lancia OGNI DUE turni: dirlo com'è evita l'ambiguità di «Ricarica: 1». */
export function spellCadence(spell: Spell): { turns: number; label: string } {
  const turns = (spell.cooldown ?? 0) + 1
  return { turns, label: turns === 1 ? 'ogni turno' : `ogni ${turns} turni` }
}
