import { Tooltip } from '@/components/ui/Tooltip'
import { abilityText } from '@/lib/abilityText'

/**
 * L'abilità personale come sigillo di ceralacca sul ritratto, col testo in tooltip.
 *
 * Perché non una riga di testo sulla carta: l'abilità occupava 62px sulla carta di
 * un mago su quattro (solo 15 maghi su 60 hanno una firma), e su una leggendaria
 * con due effetti diventava la riga più alta della metà bassa. Il sigillo vive
 * SOPRA il ritratto, in un angolo già scuro: la carta col sigillo è alta quanto
 * una carta senza abilità.
 *
 * Resta comunque VISIBILE che quel mago ha qualcosa di speciale — le firme sono
 * attive in combattimento (registerSignatures in simulate.ts), non decorative —
 * ma il testo arriva solo a richiesta. Un sigillo che compare di rado viene notato.
 */
export function AbilitySeal({ wizardId }: { wizardId: string }) {
  const ability = abilityText(wizardId)
  if (!ability) return null

  return (
    <Tooltip
      label={`Abilità personale: ${ability.name}`}
      // `bottom-full mb-1.5` invece di una costante in pixel: il sigillo si appoggia
      // al bordo superiore della targa del nome, qualunque altezza abbia. Con un
      // `bottom-[70px]` fisso restava isolato a metà ritratto sulle carte piene e
      // finiva sopra il nome su quelle basse.
      className="absolute bottom-full left-3 z-20 mb-1.5"
      triggerClassName="flex h-7 w-7 items-center justify-center rounded-full text-[12px] text-[#2a1d05] transition-transform hover:scale-110 focus-visible:scale-110"
      content={
        <span className="block w-52">
          <span className="text-[8.5px] font-extrabold uppercase tracking-[.14em] text-[#caa24a]">
            Abilità personale
          </span>
          <span className="mt-1.5 block font-display text-[13.5px] font-bold text-[#f3e6a0]">
            {ability.name}
          </span>
          {ability.lines.map(l => (
            <span key={l.value + l.what} className="mt-1.5 flex items-baseline gap-1.5 text-[11.5px]">
              <b className="text-[12px] font-black tabular-nums text-[#ffe9a8]">{l.value}</b>
              <span className="text-white/60">{l.what}</span>
            </span>
          ))}
        </span>
      }
    >
      <span
        data-testid="ability-seal"
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(160deg, #f0d9a0, #c9a24a)',
          boxShadow: '0 2px 8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.45)',
        }}
      >
        ✦
      </span>
    </Tooltip>
  )
}
