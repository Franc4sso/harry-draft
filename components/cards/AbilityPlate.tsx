/**
 * Gold "personal ability" plate — a distinct plate below the spell block so the
 * wizard's signature trait doesn't blend into the move description. See the
 * approved mockup's `.abil`.
 */
export function AbilityPlate({ name, blurb }: { name: string; blurb: string }) {
  return (
    <div
      data-testid="ability-plate"
      className="mt-2.5 flex items-start gap-2.5 rounded-[13px] border px-3 py-2.5"
      style={{
        background: 'linear-gradient(100deg, rgba(255,209,102,0.14), rgba(255,209,102,0.03))',
        borderColor: 'rgba(255,209,102,0.3)',
      }}
    >
      <div
        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] text-[15px] font-black"
        style={{
          background: 'linear-gradient(160deg, #ffd166, #e0a83a)',
          color: '#2a1c05',
          boxShadow: '0 3px 9px rgba(224,168,58,0.4)',
        }}
      >
        ✦
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: '#e0a83a' }}>
          Abilità personale
        </div>
        <div className="text-sm font-black leading-tight" style={{ color: '#ffd166' }}>
          {name}
        </div>
        <div className="mt-0.5 text-xs leading-snug text-white/70">{blurb}</div>
      </div>
    </div>
  )
}
