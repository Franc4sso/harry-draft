// data/rtLoadout.ts — UN MAGO UNA MAGIA per il motore rt (spec §4.5). data/wizards.ts resta intatto per il motore vecchio.
export const RT_SPELL_BY_WIZARD: Record<string, string> = {
  // Grifondoro (🔥 seamus, dean · ❄ dumbledore, sirius)
  harry: 'expelliarmus', dumbledore: 'petrificus', mcgonagall: 'protego_maxima', sirius: 'stupeficium', lupin: 'salvio', moody: 'expecto',
  hermione: 'confundo', ron: 'protego', ginny: 'reducto', neville: 'fianto', fred: 'tarantallegra', george: 'diffindo', molly: 'episkey',
  arthur: 'incitamento', hagrid: 'fianto', seamus: 'incendio', dean: 'confringo', parvati: 'levicorpus', lavender: 'anapneo',
  // Serpeverde (☠ draco, blaise · ⚡ bellatrix · 🔥 lucius, dolohov)
  voldemort: 'avada', snape: 'sectumsempra', bellatrix: 'crucio', lucius: 'bombarda', draco: 'serpensortia', narcissa: 'vulnera',
  dolohov: 'confringo', greyback: 'fianto', slughorn: 'anapneo', pansy: 'langlock', goyle: 'fianto', crabbe: 'aegis', marcus: 'reducto',
  pettigrew: 'rennervate', theodore: 'silencio', blaise: 'oppugno', astoria: 'episkey',
  // Corvonero (⚡ flitwick, michael · ❄ cho, terry · 🔥 lo porta Fleur con l'abilità)
  kingsley: 'aegis', fleur: 'expelliarmus', viktor: 'reducto', luna: 'aguamenti', cho: 'glacius', flitwick: 'fulgari', padma: 'levicorpus',
  terry: 'petrificus', michael: 'baubillious', roger: 'fianto', marietta: 'anapneo', anthony: 'protego', penelope: 'incitamento',
  // Tassorosso (⛨ sprout, ernie, eloise · ❄ megan, cedric)
  tonks: 'confundo', cedric: 'stupeficium', sprout: 'ferula', hannah: 'episkey', susan: 'rennervate', ernie: 'protego', justin: 'flipendo',
  zacharias: 'langlock', leanne: 'tarantallegra', eloise: 'fianto', megan: 'petrificus',
}
