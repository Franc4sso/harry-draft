import type { Wizard } from '@/types'

export const WIZARDS: Wizard[] = [
  // ===== Tier 1 (rare, strongest) =====
  {
    id: 'dumbledore', name: 'Albus Silente', house: 'Grifondoro', role: 'Controllo', tier: 1,
    ranges: { hp: [110, 135], atk: [22, 30], def: [20, 28], spd: [24, 32] },
    spellPool: ['imperio', 'petrificus', 'confundo', 'levicorpus', 'fiendfyre'],
    tags: ['order'],
  },
  {
    id: 'voldemort', name: 'Lord Voldemort', house: 'Serpeverde', role: 'Attaccante', tier: 1,
    ranges: { hp: [100, 125], atk: [30, 38], def: [16, 24], spd: [22, 30] },
    spellPool: ['avada', 'sectumsempra', 'fiendfyre', 'serpensortia', 'crucio'],
    tags: ['deatheater'],
  },
  {
    id: 'harry', name: 'Harry Potter', house: 'Grifondoro', role: 'Attaccante', tier: 1,
    ranges: { hp: [105, 130], atk: [26, 34], def: [16, 24], spd: [24, 32] },
    spellPool: ['expelliarmus', 'stupeficium', 'reducto', 'sectumsempra', 'confundo'],
    tags: ['trio', 'da'],
  },

  // ===== Tier 2 (strong) =====
  {
    id: 'snape', name: 'Severus Piton', house: 'Serpeverde', role: 'Attaccante', tier: 2,
    ranges: { hp: [85, 105], atk: [24, 31], def: [14, 20], spd: [18, 25] },
    spellPool: ['sectumsempra', 'levicorpus', 'confringo', 'reducto', 'stupeficium'],
  },
  {
    id: 'bellatrix', name: 'Bellatrix Lestrange', house: 'Serpeverde', role: 'Controllo', tier: 2,
    ranges: { hp: [80, 100], atk: [20, 27], def: [12, 18], spd: [22, 29] },
    spellPool: ['crucio', 'imperio', 'petrificus', 'confringo'],
    tags: ['deatheater'],
  },
  {
    id: 'mcgonagall', name: 'Minerva McGonagall', house: 'Grifondoro', role: 'Tank', tier: 2,
    ranges: { hp: [105, 130], atk: [16, 22], def: [22, 30], spd: [16, 22] },
    spellPool: ['protego_maxima', 'fianto', 'reducto', 'bombarda', 'protego'],
    tags: ['order'],
  },
  {
    id: 'sirius', name: 'Sirius Black', house: 'Grifondoro', role: 'Attaccante', tier: 2,
    ranges: { hp: [88, 108], atk: [23, 30], def: [14, 20], spd: [20, 27] },
    spellPool: ['stupeficium', 'expelliarmus', 'reducto', 'flipendo', 'confundo'],
    tags: ['order', 'marauder'],
  },
  {
    id: 'lupin', name: 'Remus Lupin', house: 'Grifondoro', role: 'Supporto', tier: 2,
    ranges: { hp: [90, 112], atk: [16, 22], def: [16, 22], spd: [20, 27] },
    spellPool: ['expecto', 'episkey', 'vulnera', 'protego', 'riddikulus'],
    tags: ['order', 'marauder'],
  },
  {
    id: 'moody', name: 'Alastor Moody', house: 'Grifondoro', role: 'Tank', tier: 2,
    ranges: { hp: [108, 132], atk: [18, 24], def: [22, 30], spd: [14, 20] },
    spellPool: ['protego_maxima', 'fianto', 'stupeficium', 'reducto', 'salvio'],
    tags: ['order'],
  },
  {
    id: 'lucius', name: 'Lucius Malfoy', house: 'Serpeverde', role: 'Attaccante', tier: 2,
    ranges: { hp: [84, 104], atk: [21, 28], def: [15, 21], spd: [18, 25] },
    spellPool: ['serpensortia', 'sectumsempra', 'reducto', 'confringo'],
    tags: ['deatheater'],
  },
  {
    id: 'kingsley', name: 'Kingsley Shacklebolt', house: 'Corvonero', role: 'Tank', tier: 2,
    ranges: { hp: [106, 130], atk: [18, 24], def: [21, 29], spd: [16, 22] },
    spellPool: ['protego', 'fianto', 'stupeficium', 'bombarda', 'protego_maxima'],
    tags: ['order'],
  },
  {
    id: 'fleur', name: 'Fleur Delacour', house: 'Corvonero', role: 'Attaccante', tier: 2,
    ranges: { hp: [82, 102], atk: [22, 29], def: [13, 19], spd: [21, 28] },
    spellPool: ['incendio', 'confringo', 'reducto', 'flipendo'],
  },
  {
    id: 'viktor', name: 'Viktor Krum', house: 'Corvonero', role: 'Attaccante', tier: 2,
    ranges: { hp: [86, 106], atk: [23, 30], def: [15, 21], spd: [19, 26] },
    spellPool: ['confringo', 'bombarda', 'reducto', 'oppugno', 'stupeficium'],
  },

  // ===== Tier 3 (mid) =====
  {
    id: 'hermione', name: 'Hermione Granger', house: 'Grifondoro', role: 'Controllo', tier: 3,
    ranges: { hp: [72, 92], atk: [16, 22], def: [12, 18], spd: [20, 27] },
    spellPool: ['petrificus', 'confundo', 'levicorpus', 'langlock', 'reducto'],
    tags: ['trio', 'da'],
  },
  {
    id: 'ron', name: 'Ron Weasley', house: 'Grifondoro', role: 'Tank', tier: 3,
    ranges: { hp: [92, 114], atk: [16, 22], def: [18, 25], spd: [13, 19] },
    spellPool: ['protego', 'fianto', 'expelliarmus', 'flipendo', 'salvio'],
    tags: ['trio', 'weasley', 'da'],
  },
  {
    id: 'draco', name: 'Draco Malfoy', house: 'Serpeverde', role: 'Attaccante', tier: 3,
    ranges: { hp: [74, 94], atk: [18, 24], def: [12, 18], spd: [16, 23] },
    spellPool: ['serpensortia', 'sectumsempra', 'flipendo', 'expelliarmus'],
  },
  {
    id: 'ginny', name: 'Ginny Weasley', house: 'Grifondoro', role: 'Attaccante', tier: 3,
    ranges: { hp: [74, 94], atk: [19, 25], def: [12, 18], spd: [18, 25] },
    spellPool: ['reducto', 'stupeficium', 'flipendo', 'oppugno', 'expelliarmus'],
    tags: ['weasley', 'da'],
  },
  {
    id: 'neville', name: 'Neville Paciock', house: 'Grifondoro', role: 'Tank', tier: 3,
    ranges: { hp: [94, 116], atk: [16, 22], def: [19, 26], spd: [12, 18] },
    spellPool: ['protego', 'fianto', 'diffindo', 'reducto', 'flipendo'],
    tags: ['da'],
  },
  {
    id: 'luna', name: 'Luna Lovegood', house: 'Corvonero', role: 'Supporto', tier: 3,
    ranges: { hp: [76, 96], atk: [14, 20], def: [12, 18], spd: [18, 25] },
    spellPool: ['episkey', 'rennervate', 'protego', 'salvio', 'riddikulus'],
    tags: ['da'],
  },
  {
    id: 'fred', name: 'Fred Weasley', house: 'Grifondoro', role: 'Controllo', tier: 3,
    ranges: { hp: [76, 96], atk: [16, 22], def: [13, 19], spd: [19, 26] },
    spellPool: ['confundo', 'tarantallegra', 'flipendo', 'oppugno'],
    tags: ['weasley'],
  },
  {
    id: 'george', name: 'George Weasley', house: 'Grifondoro', role: 'Attaccante', tier: 3,
    ranges: { hp: [76, 96], atk: [18, 24], def: [13, 19], spd: [17, 24] },
    spellPool: ['flipendo', 'oppugno', 'diffindo', 'expelliarmus'],
    tags: ['weasley'],
  },
  {
    id: 'molly', name: 'Molly Weasley', house: 'Grifondoro', role: 'Supporto', tier: 3,
    ranges: { hp: [88, 108], atk: [15, 21], def: [15, 21], spd: [14, 20] },
    spellPool: ['vulnera', 'episkey', 'ferula', 'protego', 'fianto'],
    tags: ['weasley', 'order'],
  },
  {
    id: 'arthur', name: 'Arthur Weasley', house: 'Grifondoro', role: 'Supporto', tier: 3,
    ranges: { hp: [86, 106], atk: [14, 20], def: [15, 21], spd: [15, 21] },
    spellPool: ['episkey', 'rennervate', 'protego', 'salvio'],
    tags: ['weasley', 'order'],
  },
  {
    id: 'tonks', name: 'Nymphadora Tonks', house: 'Tassorosso', role: 'Controllo', tier: 3,
    ranges: { hp: [78, 98], atk: [16, 22], def: [13, 19], spd: [20, 27] },
    spellPool: ['confundo', 'petrificus', 'levicorpus', 'tarantallegra'],
    tags: ['order'],
  },
  {
    id: 'narcissa', name: 'Narcissa Malfoy', house: 'Serpeverde', role: 'Supporto', tier: 3,
    ranges: { hp: [82, 102], atk: [14, 20], def: [15, 21], spd: [16, 22] },
    spellPool: ['vulnera', 'episkey', 'protego', 'fianto'],
    tags: ['deatheater'],
  },
  {
    id: 'dolohov', name: 'Antonin Dolohov', house: 'Serpeverde', role: 'Attaccante', tier: 3,
    ranges: { hp: [80, 100], atk: [20, 26], def: [13, 19], spd: [16, 23] },
    spellPool: ['confringo', 'sectumsempra', 'reducto', 'serpensortia'],
    tags: ['deatheater'],
  },
  {
    id: 'greyback', name: 'Fenrir Greyback', house: 'Serpeverde', role: 'Tank', tier: 3,
    ranges: { hp: [98, 120], atk: [20, 26], def: [18, 25], spd: [13, 19] },
    spellPool: ['diffindo', 'reducto', 'protego', 'fianto', 'oppugno'],
    tags: ['deatheater'],
  },
  {
    id: 'cho', name: 'Cho Chang', house: 'Corvonero', role: 'Controllo', tier: 3,
    ranges: { hp: [74, 94], atk: [16, 22], def: [12, 18], spd: [19, 26] },
    spellPool: ['confundo', 'levicorpus', 'tarantallegra', 'reducto'],
    tags: ['da'],
  },
  {
    id: 'cedric', name: 'Cedric Diggory', house: 'Tassorosso', role: 'Attaccante', tier: 3,
    ranges: { hp: [82, 102], atk: [20, 26], def: [14, 20], spd: [18, 25] },
    spellPool: ['stupeficium', 'expelliarmus', 'reducto', 'flipendo'],
  },
  {
    id: 'slughorn', name: 'Horace Lumacorno', house: 'Serpeverde', role: 'Supporto', tier: 3,
    ranges: { hp: [88, 108], atk: [14, 20], def: [16, 22], spd: [13, 19] },
    spellPool: ['vulnera', 'episkey', 'anapneo', 'protego', 'fianto'],
  },
  {
    id: 'hagrid', name: 'Rubeus Hagrid', house: 'Grifondoro', role: 'Tank', tier: 3,
    ranges: { hp: [110, 134], atk: [18, 24], def: [20, 28], spd: [11, 17] },
    spellPool: ['oppugno', 'flipendo', 'protego', 'fianto'],
  },
  {
    id: 'flitwick', name: 'Filius Vitious', house: 'Corvonero', role: 'Controllo', tier: 3,
    ranges: { hp: [72, 92], atk: [16, 22], def: [12, 18], spd: [21, 28] },
    spellPool: ['confundo', 'levicorpus', 'petrificus', 'tarantallegra', 'langlock'],
  },
  {
    id: 'sprout', name: 'Pomona Sprite', house: 'Tassorosso', role: 'Supporto', tier: 3,
    ranges: { hp: [86, 106], atk: [13, 19], def: [16, 22], spd: [14, 20] },
    spellPool: ['ferula', 'episkey', 'rennervate', 'protego'],
  },

  // ===== Tier 4 (weakest / numerous) =====
  {
    id: 'seamus', name: 'Seamus Finnigan', house: 'Grifondoro', role: 'Attaccante', tier: 4,
    ranges: { hp: [62, 84], atk: [16, 22], def: [10, 15], spd: [15, 21] },
    spellPool: ['incendio', 'confringo', 'flipendo', 'reducto'],
    tags: ['da'],
  },
  {
    id: 'dean', name: 'Dean Thomas', house: 'Grifondoro', role: 'Attaccante', tier: 4,
    ranges: { hp: [62, 84], atk: [15, 21], def: [11, 16], spd: [15, 21] },
    spellPool: ['reducto', 'flipendo', 'diffindo', 'expelliarmus'],
    tags: ['da'],
  },
  {
    id: 'parvati', name: 'Parvati Patil', house: 'Grifondoro', role: 'Controllo', tier: 4,
    ranges: { hp: [60, 82], atk: [13, 19], def: [10, 15], spd: [17, 23] },
    spellPool: ['confundo', 'tarantallegra', 'levicorpus', 'reducto'],
  },
  {
    id: 'lavender', name: 'Lavender Brown', house: 'Grifondoro', role: 'Supporto', tier: 4,
    ranges: { hp: [66, 86], atk: [12, 18], def: [12, 17], spd: [15, 21] },
    spellPool: ['episkey', 'anapneo', 'ferula', 'protego'],
  },
  {
    id: 'pansy', name: 'Pansy Parkinson', house: 'Serpeverde', role: 'Controllo', tier: 4,
    ranges: { hp: [60, 82], atk: [13, 19], def: [10, 15], spd: [16, 22] },
    spellPool: ['confundo', 'langlock', 'tarantallegra', 'levicorpus'],
  },
  {
    id: 'goyle', name: 'Gregory Goyle', house: 'Serpeverde', role: 'Tank', tier: 4,
    ranges: { hp: [86, 108], atk: [15, 21], def: [17, 23], spd: [9, 14] },
    spellPool: ['protego', 'fianto', 'flipendo', 'oppugno'],
  },
  {
    id: 'crabbe', name: 'Vincent Tiger', house: 'Serpeverde', role: 'Tank', tier: 4,
    ranges: { hp: [86, 108], atk: [15, 21], def: [17, 23], spd: [9, 14] },
    spellPool: ['protego', 'fianto', 'diffindo', 'flipendo'],
  },
  {
    id: 'marcus', name: 'Marcus Flint', house: 'Serpeverde', role: 'Attaccante', tier: 4,
    ranges: { hp: [66, 88], atk: [17, 23], def: [11, 16], spd: [13, 19] },
    spellPool: ['oppugno', 'reducto', 'flipendo', 'diffindo'],
  },
  {
    id: 'pettigrew', name: 'Peter Minus', house: 'Serpeverde', role: 'Supporto', tier: 4,
    ranges: { hp: [64, 86], atk: [12, 18], def: [11, 16], spd: [15, 21] },
    spellPool: ['episkey', 'ferula', 'protego', 'salvio'],
    tags: ['deatheater', 'marauder'],
  },
  {
    id: 'padma', name: 'Padma Patil', house: 'Corvonero', role: 'Controllo', tier: 4,
    ranges: { hp: [60, 82], atk: [13, 19], def: [10, 15], spd: [17, 23] },
    spellPool: ['confundo', 'levicorpus', 'langlock', 'tarantallegra'],
  },
  {
    id: 'terry', name: 'Terry Boot', house: 'Corvonero', role: 'Controllo', tier: 4,
    ranges: { hp: [60, 82], atk: [14, 20], def: [10, 15], spd: [16, 22] },
    spellPool: ['petrificus', 'confundo', 'levicorpus', 'reducto'],
  },
  {
    id: 'michael', name: 'Michael Corner', house: 'Corvonero', role: 'Attaccante', tier: 4,
    ranges: { hp: [62, 84], atk: [16, 22], def: [10, 15], spd: [15, 21] },
    spellPool: ['reducto', 'flipendo', 'stupeficium', 'expelliarmus'],
  },
  {
    id: 'roger', name: 'Roger Davies', house: 'Corvonero', role: 'Tank', tier: 4,
    ranges: { hp: [82, 104], atk: [14, 20], def: [16, 22], spd: [11, 16] },
    spellPool: ['protego', 'fianto', 'reducto', 'flipendo'],
  },
  {
    id: 'marietta', name: 'Marietta Edgecombe', house: 'Corvonero', role: 'Supporto', tier: 4,
    ranges: { hp: [66, 86], atk: [12, 18], def: [12, 17], spd: [15, 21] },
    spellPool: ['episkey', 'anapneo', 'rennervate', 'protego'],
  },
  {
    id: 'anthony', name: 'Anthony Goldstein', house: 'Corvonero', role: 'Tank', tier: 4,
    ranges: { hp: [84, 106], atk: [14, 20], def: [17, 23], spd: [11, 16] },
    spellPool: ['protego', 'fianto', 'salvio', 'reducto'],
  },
  {
    id: 'hannah', name: 'Hannah Abbott', house: 'Tassorosso', role: 'Supporto', tier: 4,
    ranges: { hp: [68, 88], atk: [12, 18], def: [13, 18], spd: [14, 20] },
    spellPool: ['episkey', 'ferula', 'anapneo', 'protego'],
  },
  {
    id: 'susan', name: 'Susan Bones', house: 'Tassorosso', role: 'Supporto', tier: 4,
    ranges: { hp: [68, 88], atk: [13, 19], def: [13, 18], spd: [14, 20] },
    spellPool: ['episkey', 'rennervate', 'protego', 'salvio'],
  },
  {
    id: 'ernie', name: 'Ernie Macmillan', house: 'Tassorosso', role: 'Tank', tier: 4,
    ranges: { hp: [84, 106], atk: [14, 20], def: [17, 23], spd: [11, 16] },
    spellPool: ['protego', 'fianto', 'flipendo', 'reducto'],
  },
  {
    id: 'justin', name: 'Justin Finch-Fletchley', house: 'Tassorosso', role: 'Attaccante', tier: 4,
    ranges: { hp: [64, 86], atk: [16, 22], def: [11, 16], spd: [15, 21] },
    spellPool: ['reducto', 'flipendo', 'expelliarmus', 'diffindo'],
  },
  {
    id: 'zacharias', name: 'Zacharias Smith', house: 'Tassorosso', role: 'Controllo', tier: 4,
    ranges: { hp: [60, 82], atk: [13, 19], def: [10, 15], spd: [16, 22] },
    spellPool: ['confundo', 'levicorpus', 'langlock', 'tarantallegra'],
  },
  {
    id: 'leanne', name: 'Leanne Selwyn', house: 'Tassorosso', role: 'Controllo', tier: 4,
    ranges: { hp: [60, 82], atk: [13, 19], def: [10, 15], spd: [17, 23] },
    spellPool: ['confundo', 'levicorpus', 'tarantallegra', 'langlock'],
  },
  {
    id: 'eloise', name: 'Eloise Midgen', house: 'Tassorosso', role: 'Tank', tier: 4,
    ranges: { hp: [82, 104], atk: [16, 22], def: [16, 22], spd: [11, 16] },
    spellPool: ['protego', 'fianto', 'salvio', 'flipendo'],
  },
  {
    id: 'theodore', name: 'Theodore Nott', house: 'Serpeverde', role: 'Controllo', tier: 4,
    ranges: { hp: [60, 82], atk: [14, 20], def: [10, 15], spd: [16, 22] },
    spellPool: ['confundo', 'levicorpus', 'langlock', 'petrificus'],
  },
  {
    id: 'blaise', name: 'Blaise Zabini', house: 'Serpeverde', role: 'Attaccante', tier: 4,
    ranges: { hp: [64, 86], atk: [16, 22], def: [11, 16], spd: [15, 21] },
    spellPool: ['sectumsempra', 'reducto', 'flipendo', 'diffindo'],
  },
  {
    id: 'astoria', name: 'Astoria Greengrass', house: 'Serpeverde', role: 'Supporto', tier: 4,
    ranges: { hp: [66, 86], atk: [12, 18], def: [12, 17], spd: [15, 21] },
    spellPool: ['episkey', 'anapneo', 'ferula', 'protego'],
  },
  {
    id: 'penelope', name: 'Penelope Clearwater', house: 'Corvonero', role: 'Supporto', tier: 4,
    ranges: { hp: [66, 86], atk: [12, 18], def: [12, 17], spd: [15, 21] },
    spellPool: ['episkey', 'rennervate', 'anapneo', 'protego'],
  },
  {
    id: 'megan', name: 'Megan Jones', house: 'Tassorosso', role: 'Controllo', tier: 4,
    ranges: { hp: [60, 82], atk: [13, 19], def: [10, 15], spd: [17, 23] },
    spellPool: ['confundo', 'tarantallegra', 'levicorpus', 'langlock'],
  },
]

export const WIZARD_BY_ID: Record<string, Wizard> = Object.fromEntries(
  WIZARDS.map(w => [w.id, w]),
)
