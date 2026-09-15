import type { Tier } from '@/types'
import { tierFrame } from '@/lib/theme'

/**
 * Le tacche di rarità in cima al ritratto: quattro pallini, accesi quanti ne vale
 * la rarità. Sostituiscono la corona, che segnava solo le leggendarie e lasciava
 * indistinte le altre tre — qui il livello si conta a colpo d'occhio per tutte.
 */
export function RarityPips({ tier }: { tier: Tier }) {
  const { pips, keyline } = tierFrame(tier)
  return (
    <span
      data-testid="rarity-pips"
      aria-label={`Rarità ${pips} su 4`}
      className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 gap-[3px] rounded-b-md bg-[rgba(8,6,15,.72)] px-2 pb-1 pt-1.5"
    >
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          data-lit={i < pips}
          className="block h-[3.5px] w-[3.5px] rounded-full"
          style={{ background: i < pips ? keyline : 'rgba(255,255,255,.16)' }}
        />
      ))}
    </span>
  )
}
