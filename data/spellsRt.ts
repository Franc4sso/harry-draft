// data/spellsRt.ts — catalogo spell del motore rt (spec §4.4). UN MAGO UNA MAGIA: l'assegnazione è in data/rtLoadout.ts.
import type { SpellRt } from '@/types/rt'

const S = (s: SpellRt) => s

export const SPELLS_RT: SpellRt[] = [
  // ── Applicatori ──────────────────────────────────────────────────────────────
  S({ id: 'incendio', name: 'Incendio', desc: 'Fiamme che bruciano nel tempo. Crescendo: +1 Fiamma per ogni cast precedente.', verb: 'danno', potenza: 1.2, segno: { kind: 'fiamma', stacks: 3 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 1, unit: 'segno' } }),
  S({ id: 'confringo', name: 'Confringo', desc: 'Esplosione ardente. Memoria: +1 Fiamma ogni 5 Deflagrazioni.', verb: 'danno', potenza: 1.9, segno: { kind: 'fiamma', stacks: 2 }, crescita: { kind: 'memoria', trigger: 'reazione:deflagrazione', per: 0.2, unit: 'segno' } }),
  S({ id: 'fiendfyre', name: 'Ardemonio', desc: 'Fuoco maledetto: cinque Fiamme in un colpo, cooldown lungo.', verb: 'danno', potenza: 2.8, cdMod: 1, segno: { kind: 'fiamma', stacks: 5 }, keywords: ['magieOscure'] }),
  S({ id: 'serpensortia', name: 'Serpensortia', desc: 'Un serpente velenoso. Memoria: +1 Veleno ogni 3 Miasma.', verb: 'danno', potenza: 0.45, segno: { kind: 'veleno', stacks: 2 }, crescita: { kind: 'memoria', trigger: 'reazione:miasma', per: 1 / 3, unit: 'segno' } }),
  S({ id: 'oppugno', name: 'Oppugno', desc: 'Uno stormo che becca. Crescendo: +1 Veleno ogni 2 cast.', verb: 'danno', potenza: 1.5, segno: { kind: 'veleno', stacks: 1 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.5, unit: 'segno' } }),
  S({ id: 'crucio', name: 'Crucio', desc: 'Dolore che scuote i nervi. Crescendo: +1 Scossa per cast consecutivo senza subire Gelo.', verb: 'status', segno: { kind: 'scossa', stacks: 3 }, crescita: { kind: 'crescendo', trigger: 'lancioSenzaGelo', per: 1, unit: 'segno' } }),
  S({ id: 'baubillious', name: 'Baubillious', desc: 'Un fulmine giallo. Memoria: +1 Scossa ogni 5 Frantuma.', verb: 'danno', potenza: 1.4, segno: { kind: 'scossa', stacks: 2 }, crescita: { kind: 'memoria', trigger: 'reazione:frantuma', per: 0.2, unit: 'segno' } }),
  S({ id: 'fulgari', name: 'Fulgari', desc: 'Corde di fulmine: Scossa e Lentezza.', verb: 'status', segno: { kind: 'scossa', stacks: 3 }, unitStatus: { kind: 'lentezza', secondi: 1.5 } }),
  S({ id: 'glacius', name: 'Glacius', desc: 'Gelo secco: il bersaglio si ferma.', verb: 'status', gelo: 2.4 }),
  S({ id: 'petrificus', name: 'Petrificus Totalus', desc: 'Pietrifica e rallenta.', verb: 'status', gelo: 1.8, unitStatus: { kind: 'lentezza', secondi: 1 } }),
  S({ id: 'stupeficium', name: 'Stupeficium', desc: 'Un lampo rosso che gela. Memoria: +0,1 s di Gelo per vittoria (max 2 s).', verb: 'danno', potenza: 1.6, gelo: 1, crescita: { kind: 'memoria', trigger: 'vittoria', per: 0.1, cap: 2, unit: 'secondi' } }),
  S({ id: 'imperio', name: 'Imperio', desc: 'Piega la volontà. Crescendo: ogni 2° cast anche Silenzio 2 s.', verb: 'status', cdMod: 1, gelo: 2.5, combo: { cond: { ogniNLanci: 2 }, effect: { kind: 'silenzio', secondi: 2 } } }),
  // ── Detonatori ───────────────────────────────────────────────────────────────
  S({ id: 'reducto', name: 'Reducto', desc: 'Riduce in polvere. Frantuma ×2,5. Memoria: +10% danno per Frantuma.', verb: 'danno', potenza: 1.8, frantumaMult: 2.5, crescita: { kind: 'memoria', trigger: 'reazione:frantuma', per: 0.1, unit: 'pct' } }),
  S({ id: 'diffindo', name: 'Diffindo', desc: 'Due tagli. Combo: se il nemico è Scosso, +1 Scossa. Crescendo: +1 colpo ogni 3 cast.', verb: 'danno', potenza: 0.7, multicast: 2, combo: { cond: { segnoNemico: { segno: 'scossa', min: 1 } }, effect: { kind: 'segno', segno: 'scossa', stacks: 1 }, target: 'squadraNemica' }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 1 / 3, unit: 'colpi' } }),
  S({ id: 'bombarda', name: 'Bombarda', desc: 'Esplosione secca, con una scintilla.', verb: 'danno', potenza: 2.4, segno: { kind: 'fiamma', stacks: 1 } }),
  S({ id: 'avada', name: 'Avada Kedavra', desc: 'La maledizione che uccide: sotto il 25% di HP nemica, KO all\'opposto. Memoria: −0,3 s di cooldown per KO fatto.', verb: 'danno', potenza: 3.2, cdMod: 2, keywords: ['magieOscure'], combo: { cond: { hpNemicaSotto: 0.25 }, effect: { kind: 'ko' }, target: 'opposto' }, crescita: { kind: 'memoria', trigger: 'ko', per: 0.3, unit: 'cd' } }),
  S({ id: 'sectumsempra', name: 'Sectumsempra', desc: 'Taglio oscuro che lascia Vulnerabile. Memoria: +2 danno per vittoria.', verb: 'danno', potenza: 2.4, keywords: ['magieOscure'], teamStatus: { kind: 'vulnerabile', secondi: 2 }, crescita: { kind: 'memoria', trigger: 'vittoria', per: 2, unit: 'danno' } }),
  S({ id: 'expelliarmus', name: 'Expelliarmus', desc: 'Disarma. Combo: entro 2 s da un Gelo alleato, Silenzio 2 s. Memoria: +1 danno per Disarmo riuscito.', verb: 'danno', potenza: 1.4, unitStatus: { kind: 'disarmo' }, combo: { cond: { entroSecondiDa: { evento: 'gelo', secondi: 2 } }, effect: { kind: 'silenzio', secondi: 2 } }, crescita: { kind: 'memoria', trigger: 'disarmo', per: 1, unit: 'danno' } }),
  S({ id: 'levicorpus', name: 'Levicorpus', desc: 'Solleva per la caviglia: Sospeso. Crescendo: +0,5 s per cast.', verb: 'status', unitStatus: { kind: 'sospeso', secondi: 3 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.5, unit: 'secondi' } }),
  S({ id: 'tarantallegra', name: 'Tarantallegra', desc: 'Gambe fuori controllo. Combo: se il nemico è Scosso, crampi: Gelo 1 s.', verb: 'status', unitStatus: { kind: 'lentezza', secondi: 2.4 }, combo: { cond: { segnoNemico: { segno: 'scossa', min: 1 } }, effect: { kind: 'gelo', secondi: 1 } } }),
  S({ id: 'confundo', name: 'Confundo', desc: 'Confonde: Lentezza e Vulnerabile. Memoria: +0,2 s di Vulnerabile per vittoria.', verb: 'status', unitStatus: { kind: 'lentezza', secondi: 1.5 }, teamStatus: { kind: 'vulnerabile', secondi: 2 }, crescita: { kind: 'memoria', trigger: 'vittoria', per: 0.2, unit: 'secondi' } }),
  S({ id: 'langlock', name: 'Langlock', desc: 'Lingua al palato: Silenzio. Crescendo: +0,5 s per cast.', verb: 'status', unitStatus: { kind: 'silenzio', secondi: 3 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.5, unit: 'secondi' } }),
  S({ id: 'silencio', name: 'Silencio', desc: 'Silenzio e Indebolimento.', verb: 'status', unitStatus: { kind: 'silenzio', secondi: 2.4 }, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'indebolito', pct: 0.2, secondi: 3 } } }),
  S({ id: 'flipendo', name: 'Flipendo', desc: 'Spinta rapida, cooldown corto. Crescendo: +5% danno per cast.', verb: 'danno', potenza: 1.1, cdMod: -1, unitStatus: { kind: 'lentezza', secondi: 1 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.05, unit: 'pct' } }),
  // ── Sostegno ─────────────────────────────────────────────────────────────────
  S({ id: 'episkey', name: 'Episkey', desc: 'Cura sicura.', verb: 'cura', cura: 34 }),
  S({ id: 'vulnera', name: 'Vulnera Sanentur', desc: 'Richiude le ferite. Memoria: +4 cura per vittoria.', verb: 'cura', cura: 48, crescita: { kind: 'memoria', trigger: 'vittoria', per: 4, unit: 'cura' } }),
  S({ id: 'anapneo', name: 'Anapneo', desc: 'Libera il respiro: cura e Purifica un alleato adiacente.', verb: 'cura', cura: 26, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'purifica' }, target: 'adiacenti' } }),
  S({ id: 'aguamenti', name: 'Aguamenti', desc: 'Getto d\'acqua: cura, un po\' di Scudo e spegne la Fiamma sulla propria squadra. Memoria: +2 cura per battaglia.', verb: 'cura', cura: 18, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'rimuoviSegnoProprio', segno: 'fiamma' }, target: 'squadraPropria' }, crescita: { kind: 'memoria', trigger: 'battaglia', per: 2, unit: 'cura' } }),
  S({ id: 'ferula', name: 'Ferula', desc: 'Bende e stecche: cura e Scudo.', verb: 'cura', cura: 17, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'scudo', n: 18 }, target: 'squadraPropria' } }),
  S({ id: 'fianto', name: 'Fianto Duri', desc: 'Scudo solido.', verb: 'scudo', scudo: 48 }),
  S({ id: 'aegis', name: 'Aegis', desc: 'Scudo grande, cooldown lungo. Memoria: +5 Scudo per battaglia combattuta.', verb: 'scudo', scudo: 60, cdMod: 1, crescita: { kind: 'memoria', trigger: 'battaglia', per: 5, unit: 'scudo' } }),
  S({ id: 'protego', name: 'Protego', desc: 'Protego a un alleato adiacente (o a sé).', verb: 'protego' }),
  S({ id: 'protego_maxima', name: 'Protego Maxima', desc: 'Protego a tutta la squadra. Memoria: −0,5 s di cooldown per boss battuto.', verb: 'protego', cdMod: 3, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'protego' }, target: 'tuttiAlleati' }, crescita: { kind: 'memoria', trigger: 'boss', per: 0.5, unit: 'cd' } }),
  S({ id: 'incitamento', name: 'Incitamento', desc: 'Cura leggera e Carica l\'alleato davanti. Crescendo: +0,25 s di Carica per cast.', verb: 'cura', cura: 8, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'carica', secondi: 1 }, target: 'davanti' }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.25, unit: 'secondi' } }),
  S({ id: 'salvio', name: 'Salvio Hexia', desc: 'Carica 0,5 s agli adiacenti. Memoria: +0,05 s per vittoria.', verb: 'carica', carica: { secondi: 0.5, target: 'adiacenti' }, crescita: { kind: 'memoria', trigger: 'vittoria', per: 0.05, unit: 'secondi' } }),
  S({ id: 'expecto', name: 'Expecto Patronum', desc: 'Scudo e Carica agli adiacenti. Crescendo: +0,25 s di Carica per cast.', verb: 'scudo', scudo: 30, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'carica', secondi: 1 }, target: 'adiacenti' }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.25, unit: 'secondi' } }),
  S({ id: 'rennervate', name: 'Rennervate', desc: 'Rianima l\'alleato KO con lo slot più basso; se nessuno, cura 20.', verb: 'rianima', cdMod: 4 }),
  S({ id: 'riddikulus', name: 'Riddikulus', desc: '+15% danno alla squadra per il resto della battaglia (max 3).', verb: 'buff', buff: { dannoPct: 0.15, max: 3 } }),
]

export const SPELL_RT_BY_ID: Record<string, SpellRt> = Object.fromEntries(SPELLS_RT.map(s => [s.id, s]))
