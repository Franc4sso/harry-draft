import type { Spell } from '@/types'

export const SPELLS: Spell[] = [
  { id: 'base_attack', name: 'Colpo Base', desc: 'Attacco elementare senza incantesimo.', type: 'Attacco', power: 1, hitChance: 0.95, cooldown: 0 },

  // Attacco
  { id: 'expelliarmus', name: 'Expelliarmus', desc: 'Disarma il bersaglio.', type: 'Attacco', power: 1.4, hitChance: 0.95, cooldown: 0 },
  { id: 'stupeficium', name: 'Stupeficium', desc: 'Stordisce con un lampo rosso.', type: 'Attacco', power: 1.6, hitChance: 0.9, cooldown: 1, effects: [{ kind: 'stun', duration: 1 }] },
  { id: 'sectumsempra', name: 'Sectumsempra', desc: 'Taglio oscuro e profondo.', type: 'Attacco', power: 2.4, hitChance: 0.8, cooldown: 1, keywords: ['magieOscure'] },
  { id: 'bombarda', name: 'Bombarda', desc: 'Esplosione concussiva.', type: 'Attacco', power: 2.0, hitChance: 0.85, cooldown: 1 },
  { id: 'incendio', name: 'Incendio', desc: 'Fiamme che bruciano nel tempo.', type: 'Attacco', power: 1.2, hitChance: 0.9, cooldown: 1, effects: [{ kind: 'dot', amount: 8, duration: 2 }] },
  { id: 'avada', name: 'Avada Kedavra', desc: 'Maledizione che uccide.', type: 'Attacco', power: 3.2, hitChance: 0.6, cooldown: 2, keywords: ['magieOscure'] },
  { id: 'reducto', name: 'Reducto', desc: 'Distrugge ciò che colpisce.', type: 'Attacco', power: 1.8, hitChance: 0.88, cooldown: 1 },
  { id: 'diffindo', name: 'Diffindo', desc: 'Lacera il bersaglio.', type: 'Attacco', power: 1.3, hitChance: 0.92, cooldown: 0 },
  { id: 'confringo', name: 'Confringo', desc: 'Esplosione incendiaria.', type: 'Attacco', power: 1.9, hitChance: 0.83, cooldown: 1, effects: [{ kind: 'dot', amount: 6, duration: 2 }] },

  // Controllo
  { id: 'crucio', name: 'Crucio', desc: 'Dolore lancinante e debilitante.', type: 'Controllo', power: 0.8, hitChance: 0.85, cooldown: 1, effects: [{ kind: 'dot', amount: 10, duration: 2 }, { kind: 'debuff', stat: 'atk', amount: 10, duration: 2 }] },
  { id: 'imperio', name: 'Imperio', desc: 'Controlla la volontà; salta il turno.', type: 'Controllo', hitChance: 0.8, cooldown: 2, effects: [{ kind: 'stun', duration: 2 }] },
  { id: 'petrificus', name: 'Petrificus Totalus', desc: 'Paralisi totale.', type: 'Controllo', hitChance: 0.85, cooldown: 1, effects: [{ kind: 'stun', duration: 1 }] },
  { id: 'levicorpus', name: 'Levicorpus', desc: 'Solleva e indebolisce la difesa.', type: 'Controllo', hitChance: 0.9, cooldown: 1, effects: [{ kind: 'debuff', stat: 'def', amount: 20, duration: 2 }] },
  { id: 'confundo', name: 'Confundo', desc: 'Confonde, riduce la velocità.', type: 'Controllo', hitChance: 0.9, cooldown: 1, effects: [{ kind: 'debuff', stat: 'spd', amount: 15, duration: 2 }] },
  { id: 'langlock', name: 'Langlock', desc: "Riduce l'attacco nemico.", type: 'Controllo', hitChance: 0.92, cooldown: 1, effects: [{ kind: 'debuff', stat: 'atk', amount: 18, duration: 2 }] },
  { id: 'tarantallegra', name: 'Tarantallegra', desc: 'Gambe fuori controllo.', type: 'Controllo', hitChance: 0.88, cooldown: 1, effects: [{ kind: 'debuff', stat: 'spd', amount: 20, duration: 2 }] },

  // Cura
  { id: 'episkey', name: 'Episkey', desc: 'Cura ferite minori.', type: 'Cura', heal: 28, hitChance: 1, cooldown: 1 },
  { id: 'vulnera', name: 'Vulnera Sanentur', desc: 'Cura profonda.', type: 'Cura', heal: 48, hitChance: 1, cooldown: 1 },
  { id: 'rennervate', name: 'Rennervate', desc: 'Rianima e cura.', type: 'Cura', heal: 34, hitChance: 1, cooldown: 1 },
  { id: 'anapneo', name: 'Anapneo', desc: 'Libera e ristora.', type: 'Cura', heal: 22, hitChance: 1, cooldown: 1 },
  { id: 'ferula', name: 'Ferula', desc: 'Fascia le ferite, cura nel tempo.', type: 'Cura', heal: 14, hitChance: 1, cooldown: 1, effects: [{ kind: 'buff', stat: 'def', amount: 10, duration: 2 }] },

  // Difesa
  { id: 'protego', name: 'Protego', desc: 'Annulla la prossima magia sul bersaglio.', type: 'Difesa', hitChance: 1, cooldown: 1, spec: [{ kind: 'protego', count: 1 }] },
  { id: 'protego_maxima', name: 'Protego Maxima', desc: 'Annulla la prossima magia su due alleati.', type: 'Difesa', hitChance: 1, cooldown: 2, spec: [{ kind: 'protego', count: 2 }] },
  { id: 'fianto', name: 'Fianto Duri', desc: 'Rinforza le barriere.', type: 'Difesa', hitChance: 1, cooldown: 1, effects: [{ kind: 'buff', stat: 'def', amount: 30, duration: 2 }] },
  { id: 'salvio', name: 'Salvio Hexia', desc: 'Devia gli incantesimi, +velocità.', type: 'Difesa', hitChance: 1, cooldown: 1, effects: [{ kind: 'buff', stat: 'spd', amount: 20, duration: 2 }] },
  { id: 'riddikulus', name: 'Riddikulus', desc: 'Rinforza il morale, +attacco.', type: 'Difesa', hitChance: 1, cooldown: 1, effects: [{ kind: 'buff', stat: 'atk', amount: 20, duration: 2 }] },
  { id: 'expecto', name: 'Expecto Patronum', desc: 'Protezione luminosa, +tutte le difese.', type: 'Difesa', hitChance: 1, cooldown: 2, effects: [{ kind: 'buff', stat: 'def', amount: 25, duration: 3 }, { kind: 'buff', stat: 'spd', amount: 15, duration: 3 }] },

  // extra Attacco to reach count + variety
  { id: 'flipendo', name: 'Flipendo', desc: 'Spinta concussiva.', type: 'Attacco', power: 1.1, hitChance: 0.93, cooldown: 0 },
  { id: 'oppugno', name: 'Oppugno', desc: 'Scaglia oggetti contro il nemico.', type: 'Attacco', power: 1.5, hitChance: 0.87, cooldown: 1 },
  { id: 'fiendfyre', name: 'Ardemonio', desc: 'Fuoco maledetto devastante.', type: 'Attacco', power: 2.8, hitChance: 0.7, cooldown: 2, effects: [{ kind: 'dot', amount: 12, duration: 2 }], keywords: ['magieOscure'] },
  { id: 'serpensortia', name: 'Serpensortia', desc: 'Evoca un serpente velenoso che morde.', type: 'Attacco', hitChance: 0.85, cooldown: 1, spec: [{ kind: 'damage', power: 1.4, canCrit: true, canDodge: true }, { kind: 'applyStatus', target: 'enemy', statusId: 'veleno', duration: 2 }] },

  // demo: data-driven statuses (Status & Effect engine)
  { id: 'glacius', name: 'Glacius', desc: 'Congela il bersaglio.', type: 'Controllo', hitChance: 0.85, cooldown: 1,
    spec: [{ kind: 'applyStatus', target: 'enemy', statusId: 'freeze', duration: 1 }] },
  { id: 'silencio', name: 'Silencio', desc: 'Silenzia il bersaglio.', type: 'Controllo', hitChance: 0.9, cooldown: 1,
    spec: [{ kind: 'applyStatus', target: 'enemy', statusId: 'silence', duration: 2 }] },
  { id: 'aegis', name: 'Aegis', desc: 'Evoca uno scudo che assorbe danno.', type: 'Difesa', hitChance: 1, cooldown: 2,
    spec: [{ kind: 'shield', amount: 60, duration: 3 }] },
]

export const SPELL_BY_ID: Record<string, Spell> = Object.fromEntries(
  SPELLS.map(s => [s.id, s]),
)
