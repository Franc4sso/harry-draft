'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Lock, Skull, Sparkles, Users, Gem, Zap, ArrowLeft } from 'lucide-react'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { Parchment } from '@/components/ui/Parchment'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { FoilText, EASE_CINEMATIC, Stagger, StaggerItem } from '@/components/ui/motion'
import { Chip } from '@/components/ui/Chip'
import { TierBadge } from '@/components/cards/TierBadge'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { houseTheme, tierLabel, tierColor } from '@/lib/theme'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
import { cn } from '@/lib/cn'
import { WIZARDS } from '@/data/wizards'
import { RELICS } from '@/data/relics'
import { BOSSES_BY_AREA } from '@/data/bosses'
import { SYNERGIES } from '@/data/synergies'
import { DUOS, SIGNAL_LABEL } from '@/data/duos'
import {
  STARTER_WIZARDS, STARTER_RELICS, MILESTONES, wizardUnlockCost, relicUnlockCost,
} from '@/data/unlocks'
import {
  loadProfile, saveProfile, spendCioccorane, unlockWizard, unlockRelic,
} from '@/lib/metaStore'
import type { MetaProfile } from '@/lib/metaStore'
import type { Wizard, Tier, Synergy, Duo } from '@/types'
import type { Relic, RelicRarity } from '@/types/relic'
import type { BossDef } from '@/data/bosses'

type Status = 'unlocked' | 'seen' | 'hidden'
/** Boss/synergy codex entries have no purchase path — they're discovery-only. */
type DiscoveryStatus = 'seen' | 'hidden'
type Kind = 'wizard' | 'relic'

const TIER_ORDER: Tier[] = [1, 2, 3, 4]
const RARITY_ORDER: RelicRarity[] = ['comune', 'non-comune', 'rara', 'epica']

/** BOSSES_BY_AREA is BossDef[][] indexed by area — flattened once, keeping the area index. */
const ALL_BOSSES: { boss: BossDef; area: number }[] = BOSSES_BY_AREA.flatMap(
  (bosses, area) => bosses.map((boss) => ({ boss, area })),
)

/** The 10 "named" (thematic) synergies — excludes the mechanical house-count/role-count ones,
 *  which aren't meant to be collected/discovered. Order matches data/synergies.ts. */
const NAMED_SYNERGY_IDS = [
  'goldenTrio', 'weasley', 'order', 'deatheater', 'tossicita',
  'spietatezza', 'bastione', 'oscurita', 'marauder', 'da',
] as const
const NAMED_SYNERGY_ID_SET: ReadonlySet<string> = new Set(NAMED_SYNERGY_IDS)
const NAMED_SYNERGIES: Synergy[] = SYNERGIES.filter((s) => NAMED_SYNERGY_ID_SET.has(s.id))

const TAG_LABEL: Record<string, string> = {
  weasley: 'Weasley',
  order: 'Ordine della Fenice',
  deatheater: 'Mangiamorte',
  veleno: 'Veleno',
  esecuzione: 'Esecuzione',
  scudirigen: 'Scudo Rigenerante',
  magieOscure: 'Magie Oscure',
  marauder: 'Malandrini',
  da: 'Esercito di Silente',
}

/** Renders a synergy's unlock condition as a short discovery hint, e.g. "3 Mangiamorte"
 *  or "Harry Potter + Ron Weasley + Hermione Granger". */
function synergyHint(synergy: Synergy): string {
  const { requires } = synergy
  if (requires.ids) {
    return requires.ids
      .map((id) => WIZARDS.find((w) => w.id === id)?.name ?? id)
      .join(' + ')
  }
  if (requires.tag && requires.count) {
    return `${requires.count} ${TAG_LABEL[requires.tag] ?? requires.tag}`
  }
  if (requires.house && requires.count) return `${requires.count} ${requires.house}`
  if (requires.role && requires.count) return `${requires.count} ${requires.role}`
  return ''
}

function statusFor(id: string, unlocked: Set<string>, seen: Set<string>): Status {
  if (unlocked.has(id)) return 'unlocked'
  if (seen.has(id)) return 'seen'
  return 'hidden'
}

function unlockHint(kind: Kind, id: string, cost: number): string {
  const milestone = MILESTONES.find((m) => m.unlock.kind === kind && m.unlock.id === id)
  if (milestone) return milestone.unlock.label
  return `compra: ${cost} 🍫`
}

/** Small pill button distinct from the app's chunkier Button/SealButton — grid tiles
 *  are compact, so the purchase action needs its own tiny footprint. */
function BuyButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-full border px-2 py-1 text-[10px] font-display font-bold uppercase tracking-wider transition-colors',
        disabled
          ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/25'
          : 'border-gold/60 bg-gold/15 text-[#f3e6c4] shadow-[0_0_14px_rgba(201,162,75,0.18)] hover:bg-gold/30',
      )}
    >
      {label}
    </button>
  )
}

/** The face-down collectible: what an undiscovered slot shows instead of a bare lock —
 *  a card-back with the album's gold seal, so empty slots read as "still to find". */
function CardBack({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative grid h-full w-full place-items-center overflow-hidden', className)}
      style={{
        background:
          'radial-gradient(circle at 50% 40%, rgba(201,162,75,0.10), rgba(20,16,33,0.6) 70%), repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 6px, transparent 6px 12px)',
      }}
    >
      <div className="grid h-9 w-9 place-items-center rounded-full border border-gold/25 bg-black/30">
        <Lock size={13} className="text-gold/45" />
      </div>
      <span className="absolute bottom-1 text-[8px] uppercase tracking-[0.2em] text-white/20">Da scoprire</span>
    </div>
  )
}

/** One numeric slab in the ledger header — a lifetime stat rendered as a foil figure. */
function LedgerStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="font-display text-xl font-bold text-[#f3e6c4] tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/40">{label}</p>
    </div>
  )
}

/** SIGNATURE: the completion crest — a gold ring that fills as the album fills, with the
 *  overall percent in foil at its heart. The one element that unifies the whole collection. */
function CompletionCrest({ found, total }: { found: number; total: number }) {
  const pct = total > 0 ? found / total : 0
  const R = 52
  const C = 2 * Math.PI * R
  const reduce = useReducedMotion()
  return (
    <div className="relative grid h-[132px] w-[132px] shrink-0 place-items-center">
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <defs>
          <linearGradient id="collGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f5e2a8" />
            <stop offset="0.5" stopColor="#C9A24B" />
            <stop offset="1" stopColor="#8a6d2f" />
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <motion.circle
          cx="66" cy="66" r={R} fill="none" stroke="url(#collGold)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C}
          initial={reduce ? false : { strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 1.1, ease: EASE_CINEMATIC, delay: 0.25 }}
          style={{ filter: 'drop-shadow(0 0 6px rgba(201,162,75,0.5))' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <FoilText as="span" className="font-display text-[2rem] font-bold leading-none">{Math.round(pct * 100)}%</FoilText>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-white/45 tabular-nums">{found}/{total}</p>
        </div>
      </div>
    </div>
  )
}

/** Section banner: an icon, the title, a live count, and a fill meter — the album page's
 *  header, so completing a page feels visible. */
function SectionHeader({
  icon, title, found, total, accent,
}: {
  icon: React.ReactNode; title: string; found: number; total: number; accent: string
}) {
  const pct = total > 0 ? (found / total) * 100 : 0
  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-wide text-[#f3e6c4]">
          <span style={{ color: accent }}>{icon}</span>
          {title}
        </h2>
        <span className="font-display text-xs tabular-nums text-white/45">
          {found}<span className="text-white/25">/{total}</span>
        </span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${accent}, #f3e6c4)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: EASE_CINEMATIC, delay: 0.15 }}
        />
      </div>
    </div>
  )
}

function WizardTile({
  wizard, status, hint, cost, canAfford, onBuy,
}: {
  wizard: Wizard
  status: Status
  hint: string
  cost: number
  canAfford: boolean
  onBuy: () => void
}) {
  const locked = status !== 'unlocked'
  const theme = houseTheme(wizard.house)
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div
        className="group relative aspect-[5/6] w-full overflow-hidden rounded-xl transition-transform duration-200 hover:-translate-y-0.5"
        style={{
          border: `1.5px solid ${status === 'hidden' ? 'rgba(201,162,75,0.18)' : locked ? 'rgba(255,255,255,0.18)' : theme.color}`,
          boxShadow: status === 'unlocked' ? `0 0 14px ${theme.glow}45` : undefined,
        }}
      >
        {status === 'hidden' ? (
          <CardBack />
        ) : (
          <>
            <div className={cn('h-full w-full', status === 'seen' && 'grayscale')}>
              <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="bust" />
            </div>
            {/* top-light sheen — a faint foil gleam only on owned cards */}
            {status === 'unlocked' && (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent opacity-60" />
            )}
            {status === 'seen' && (
              <div className="absolute inset-0 bg-black/45" />
            )}
            <span className="absolute left-1 top-1"><HouseCrest house={wizard.house} size={15} /></span>
            <span className="absolute right-1 top-1"><TierBadge tier={wizard.tier} /></span>
            {status === 'seen' && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-1.5 py-0.5 text-[7px] uppercase tracking-widest text-white/70">Avvistato</span>
            )}
          </>
        )}
      </div>
      <p className={cn('font-display text-[11px] leading-tight', locked ? 'text-white/45' : 'text-white/90')}>
        {status === 'hidden' ? '???' : wizard.name}
      </p>
      {locked && status !== 'hidden' && <BuyButton label={`${cost} 🍫`} disabled={!canAfford} onClick={onBuy} />}
      {status === 'hidden' && <p className="text-[9px] leading-snug text-white/30">{hint}</p>}
    </div>
  )
}

function RelicTile({
  relic, status, hint, cost, canAfford, onBuy,
}: {
  relic: Relic
  status: Status
  hint: string
  cost: number
  canAfford: boolean
  onBuy: () => void
}) {
  const locked = status !== 'unlocked'
  const color = RELIC_RARITY_COLOR[relic.rarity]
  if (status === 'hidden') {
    return (
      <div className="relative flex min-h-[92px] flex-col gap-1.5 overflow-hidden rounded-xl border border-gold/15 p-3">
        <div className="absolute inset-0"><CardBack /></div>
        <p className="relative z-10 font-display text-xs font-medium text-white/45">???</p>
        <p className="relative z-10 text-[10px] leading-snug text-white/35">{hint}</p>
      </div>
    )
  }
  return (
    <div
      className="flex min-h-[92px] flex-col gap-1.5 rounded-xl border p-3 text-left transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: locked ? 'rgba(255,255,255,0.14)' : `${color}66`,
        background: locked ? 'rgba(255,255,255,0.02)' : `linear-gradient(160deg, ${color}22, ${color}0a)`,
        boxShadow: locked ? undefined : `0 0 14px ${color}22`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn('font-display text-[13px] font-semibold', locked && 'text-white/50')}
          style={locked ? undefined : { color }}
        >
          {relic.name}
        </p>
        <Gem size={12} className="shrink-0" style={{ color: locked ? 'rgba(255,255,255,0.2)' : color }} />
      </div>
      {!locked && <p className="text-[11px] leading-snug text-white/70">{relic.desc}</p>}
      {locked && (
        <>
          <p className="text-[10px] leading-snug text-white/40">Avvistata — {hint}</p>
          <BuyButton label={`Sblocca · ${cost} 🍫`} disabled={!canAfford} onClick={onBuy} />
        </>
      )}
    </div>
  )
}

function BossTile({ boss, area, status }: { boss: BossDef; area: number; status: DiscoveryStatus }) {
  const hidden = status === 'hidden'
  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border p-3 text-center transition-transform duration-200',
        hidden ? 'border-rose-400/15' : 'border-rose-400/45 bg-gradient-to-b from-rose-500/15 to-rose-950/20 hover:-translate-y-0.5',
      )}
    >
      {hidden ? (
        <><div className="absolute inset-0"><CardBack /></div>
          <div className="relative"><Skull size={16} className="text-rose-300/30" /></div></>
      ) : (
        <Skull size={20} className="text-rose-300" style={{ filter: 'drop-shadow(0 0 7px rgba(244,63,94,0.55))' }} />
      )}
      <p className={cn('relative font-display text-xs leading-tight', hidden ? 'text-white/45' : 'text-rose-50/95')}>
        {hidden ? '???' : boss.name}
      </p>
      <p className="relative text-[9px] uppercase tracking-[0.16em] text-white/30">Area {area + 1}</p>
    </div>
  )
}

function SynergyTile({ synergy, status, hint }: { synergy: Synergy; status: DiscoveryStatus; hint: string }) {
  const hidden = status === 'hidden'
  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 overflow-hidden rounded-xl border p-3 text-left transition-transform duration-200',
        hidden ? 'border-gold/15' : 'border-gold/45 bg-gradient-to-b from-gold/12 to-transparent hover:-translate-y-0.5',
      )}
    >
      {hidden && <div className="absolute inset-0"><CardBack /></div>}
      <p className={cn('relative flex items-center gap-1.5 font-display text-[13px] font-semibold', hidden ? 'text-white/45' : 'text-[#f3e6c4]')}>
        {!hidden && <Zap size={12} className="text-gold/80" />}
        {hidden ? '???' : synergy.name}
      </p>
      {hint && <p className="relative text-[10px] leading-snug text-white/40">{hint}</p>}
    </div>
  )
}

/** Duo entries are a recipe book (Hades model, spec §7): name + the two ingredient
 *  signals ALWAYS show (so the player can chase them), unlike SynergyTile which hides
 *  everything behind "???" until seen. Only the effect text is gated on discovery. */
function DuoTile({ duo, seen }: { duo: Duo; seen: boolean }) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-1.5 overflow-hidden rounded-xl border p-3 text-left transition-transform duration-200',
        seen ? 'border-gold/45 bg-gradient-to-b from-gold/12 to-transparent hover:-translate-y-0.5' : 'border-gold/20',
      )}
    >
      <p className="flex items-center gap-1.5 font-display text-[13px] font-semibold text-[#f3e6c4]">
        <Zap size={12} className="text-gold/80" />
        {duo.name}
      </p>
      <div className="flex flex-wrap gap-1">
        {duo.signals.map((s) => (
          <span key={s} className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/60">
            {SIGNAL_LABEL[s]}
          </span>
        ))}
      </div>
      {seen ? (
        <p className="text-[10px] leading-snug text-white/45">{duo.desc}</p>
      ) : (
        <p className="text-[10px] leading-snug text-white/30">??? — scoprila in battaglia</p>
      )}
    </div>
  )
}

export function CollectionScreen() {
  const [profile, setProfile] = useState<MetaProfile | null>(null)
  const reduce = useReducedMotion()

  // loadProfile() reads localStorage — must run client-only after mount, or the
  // server-rendered markup (always "no profile yet") would mismatch the client's.
  useEffect(() => {
    setProfile(loadProfile())
  }, [])

  const unlockedWizards = useMemo(
    () => new Set([...STARTER_WIZARDS, ...(profile?.unlockedWizards ?? [])]),
    [profile],
  )
  const seenWizards = useMemo(() => new Set(profile?.codex.wizardsSeen ?? []), [profile])
  const unlockedRelics = useMemo(
    () => new Set([...STARTER_RELICS, ...(profile?.unlockedRelics ?? [])]),
    [profile],
  )
  const seenRelics = useMemo(() => new Set(profile?.codex.relicsSeen ?? []), [profile])
  const seenBosses = useMemo(() => new Set(profile?.codex.bossesSeen ?? []), [profile])
  const seenSynergies = useMemo(() => new Set(profile?.codex.synergiesSeen ?? []), [profile])
  const seenDuos = useMemo(() => new Set(profile?.codex.duosSeen ?? []), [profile])

  const buy = (kind: Kind, id: string, cost: number) => {
    if (!profile) return
    const spent = spendCioccorane(profile, cost)
    if (!spent) return
    const next = kind === 'wizard' ? unlockWizard(spent, id) : unlockRelic(spent, id)
    saveProfile(next)
    setProfile(next)
  }

  if (!profile) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-xs uppercase tracking-widest text-white/40">Apertura dell'album…</p>
      </main>
    )
  }

  const { stats, cioccorane } = profile

  // Per-page discovery counts (a slot is "discovered" once it's no longer hidden).
  const wizFound = WIZARDS.filter((w) => statusFor(w.id, unlockedWizards, seenWizards) !== 'hidden').length
  const relFound = RELICS.filter((r) => statusFor(r.id, unlockedRelics, seenRelics) !== 'hidden').length
  const bossFound = ALL_BOSSES.filter(({ boss }) => seenBosses.has(boss.name)).length
  const synFound = NAMED_SYNERGIES.filter((s) => seenSynergies.has(s.id)).length
  const duoFound = DUOS.filter((d) => seenDuos.has(d.id)).length
  const totalFound = wizFound + relFound + bossFound + synFound + duoFound
  const grandTotal = WIZARDS.length + RELICS.length + ALL_BOSSES.length + NAMED_SYNERGIES.length + DUOS.length

  return (
    <main className="relative flex-1">
      {/* Album backdrop: warm parchment vignette so the collection reads as a bound tome.
          Fixed so it stays behind the (long, scrolling) content without clipping it. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <Parchment className="absolute inset-0 opacity-[0.45]" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 55% at 50% 0%, rgba(201,162,75,0.10), transparent 55%)' }} />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:p-8">
        <header className="mt-2 flex flex-col items-center gap-5 sm:mt-4">
          <Insegna kicker="L'album delle Cioccorane" title="Collezione" />

          {/* Ledger: treasure · completion crest · lifetime record — one bound header. */}
          <Frame variant="panel" className="w-full max-w-2xl" innerClassName="px-5 py-4 sm:px-7 sm:py-5">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
              <div className="text-center sm:text-left">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Il tuo tesoro</p>
                <p className="mt-1 font-display text-3xl font-bold text-[#f3e6c4] tabular-nums leading-none">
                  {cioccorane} <span className="text-2xl">🍫</span>
                </p>
                <p className="mt-1 text-[10px] text-white/35">da spendere per nuove carte</p>
              </div>

              <CompletionCrest found={totalFound} total={grandTotal} />

              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <LedgerStat label="Partite" value={stats.runsPlayed} />
                <LedgerStat label="Vittorie" value={stats.runsWon} />
                <LedgerStat label="Boss" value={stats.bossesKilled} />
                <LedgerStat label="Miglior area" value={stats.bestStageReached} />
              </div>
            </div>
          </Frame>
        </header>

        <Stagger className="flex flex-col gap-9">
          {/* Maghi */}
          <StaggerItem>
            <section className="w-full">
              <SectionHeader icon={<Users size={17} />} title="Maghi" found={wizFound} total={WIZARDS.length} accent="#C9A24B" />
              <div className="space-y-4">
                {TIER_ORDER.map((tier) => {
                  const wizards = WIZARDS.filter((w) => w.tier === tier)
                  if (!wizards.length) return null
                  return (
                    <div key={tier}>
                      <div className="mb-2"><Chip label={tierLabel(tier)} color={tierColor(tier)} size="md" /></div>
                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8">
                        {wizards.map((w) => {
                          const status = statusFor(w.id, unlockedWizards, seenWizards)
                          const cost = wizardUnlockCost(w)
                          return (
                            <WizardTile
                              key={w.id}
                              wizard={w}
                              status={status}
                              hint={unlockHint('wizard', w.id, cost)}
                              cost={cost}
                              canAfford={cioccorane >= cost}
                              onBuy={() => buy('wizard', w.id, cost)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </StaggerItem>

          {/* Reliquie */}
          <StaggerItem>
            <section className="w-full">
              <SectionHeader icon={<Gem size={17} />} title="Reliquie" found={relFound} total={RELICS.length} accent="#7dd3fc" />
              <div className="space-y-4">
                {RARITY_ORDER.map((rarity) => {
                  const relics = RELICS.filter((r) => r.rarity === rarity)
                  if (!relics.length) return null
                  return (
                    <div key={rarity}>
                      <div className="mb-2"><Chip label={rarity} color={RELIC_RARITY_COLOR[rarity]} size="md" className="capitalize" /></div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {relics.map((r) => {
                          const status = statusFor(r.id, unlockedRelics, seenRelics)
                          const cost = relicUnlockCost(r)
                          return (
                            <RelicTile
                              key={r.id}
                              relic={r}
                              status={status}
                              hint={unlockHint('relic', r.id, cost)}
                              cost={cost}
                              canAfford={cioccorane >= cost}
                              onBuy={() => buy('relic', r.id, cost)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </StaggerItem>

          {/* Boss */}
          <StaggerItem>
            <section className="w-full">
              <SectionHeader icon={<Skull size={17} />} title="Signori Oscuri" found={bossFound} total={ALL_BOSSES.length} accent="#fb7185" />
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                {ALL_BOSSES.map(({ boss, area }) => (
                  <BossTile key={boss.id} boss={boss} area={area} status={seenBosses.has(boss.name) ? 'seen' : 'hidden'} />
                ))}
              </div>
            </section>
          </StaggerItem>

          {/* Sinergie */}
          <StaggerItem>
            <section className="w-full">
              <SectionHeader icon={<Sparkles size={17} />} title="Sinergie" found={synFound} total={NAMED_SYNERGIES.length} accent="#C9A24B" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {NAMED_SYNERGIES.map((synergy) => (
                  <SynergyTile
                    key={synergy.id}
                    synergy={synergy}
                    status={seenSynergies.has(synergy.id) ? 'seen' : 'hidden'}
                    hint={synergyHint(synergy)}
                  />
                ))}
              </div>
            </section>
          </StaggerItem>

          {/* Duo */}
          <StaggerItem>
            <section className="w-full">
              <SectionHeader icon={<Zap size={17} />} title="Duo" found={duoFound} total={DUOS.length} accent="#C9A24B" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {DUOS.map((duo) => (
                  <DuoTile key={duo.id} duo={duo} seen={seenDuos.has(duo.id)} />
                ))}
              </div>
            </section>
          </StaggerItem>
        </Stagger>

        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center pt-2"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 font-display text-xs uppercase tracking-[0.14em] text-white/65 transition-colors hover:border-gold/40 hover:text-[#f3e6c4]"
          >
            <ArrowLeft size={14} /> Torna al menu
          </Link>
        </motion.div>
      </div>
    </main>
  )
}
