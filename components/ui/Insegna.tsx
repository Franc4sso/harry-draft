import { FoilText, DrawDivider } from './motion'

export function Insegna({
  kicker, title, className,
}: { kicker?: string; title: string; className?: string }) {
  return (
    <div className={`text-center ${className ?? ''}`}>
      {kicker && <p className="kicker">{kicker}</p>}
      <FoilText as="h1" className="mt-1 block font-display text-4xl font-bold sm:text-5xl">{title}</FoilText>
      <DrawDivider className="mt-3" />
    </div>
  )
}
