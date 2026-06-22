import { cn } from '@/lib/cn'

export function DraftProgress({ picked, total }: { picked: number; total: number }) {
  const label = picked >= total ? `${total} / ${total}` : `Mago ${picked + 1} / ${total}`
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-display uppercase tracking-widest text-sm text-white/70">{label}</p>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn('h-2 w-2 rounded-full', i < picked ? 'bg-white' : 'bg-white/20')}
          />
        ))}
      </div>
    </div>
  )
}
