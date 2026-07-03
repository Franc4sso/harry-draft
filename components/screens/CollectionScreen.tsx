'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Lock, Skull } from 'lucide-react'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { GlowPanel } from '@/components/ui/GlowPanel'
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
import { STARTER_WIZARDS, STARTER_RELICS, UNLOCK_COSTS, MILESTONES } from '@/data/unlocks'
import {
  loadProfile, saveProfile, spendCioccorane, unlockWizard, unlockRelic,
} from '@/lib/metaStore'
import type { MetaProfile } from '@/lib/metaStore'
import type { Wizard, Tier, Synergy } from '@/types'
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

function unlockHint(kind: Kind, id: string): string {
  const milestone = MILESTONES.find((m) => m.unlock.kind === kind && m.unlock.id === id)
  if (milestone) return milestone.unlock.label
  return `compra: ${UNLOCK_COSTS[kind]} 🍫`
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
        'rounded-full border px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider transition-colors',
        disabled
          ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/25'
          : 'border-gold/50 bg-gold/15 text-[#f3e6c4] hover:bg-gold/25',
      )}
    >
      {label}
    </button>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <GlowPanel className="px-4 py-3 text-center">
      <p className="font-display text-2xl font-bold text-[#f3e6c4]">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/45">{label}</p>
    </GlowPanel>
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
        className="relative h-28 w-24 overflow-hidden rounded-xl"
        style={{
          border: `2px solid ${locked ? 'rgba(255,255,255,0.15)' : theme.color}`,
          boxShadow: locked ? undefined : `0 0 10px ${theme.glow}40`,
        }}
      >
        {status === 'hidden' ? (
          <div className="grid h-full w-full place-items-center bg-black/50">
            <Lock size={20} className="text-white/25" />
          </div>
        ) : (
          <>
            <div className={cn(status === 'seen' && 'grayscale')}>
              <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="bust" />
            </div>
            {locked && <div className="absolute inset-0 bg-black/55" />}
          </>
        )}
        <span className="absolute right-1 top-1"><TierBadge tier={wizard.tier} /></span>
      </div>
      <p className={cn('font-display text-xs leading-tight', locked ? 'text-white/40' : 'text-white/90')}>
        {status === 'hidden' ? '???' : wizard.name}
      </p>
      {locked && <p className="text-[10px] leading-snug text-white/35">{hint}</p>}
      {locked && <BuyButton label={`Sblocca (${cost} 🍫)`} disabled={!canAfford} onClick={onBuy} />}
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
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border p-3 text-left"
      style={{
        borderColor: locked ? 'rgba(255,255,255,0.12)' : `${color}55`,
        background: locked ? 'rgba(255,255,255,0.02)' : `${color}14`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn('font-display text-xs font-medium', locked && 'text-white/40')}
          style={locked ? undefined : { color }}
        >
          {status === 'hidden' ? '???' : relic.name}
        </p>
        {locked && <Lock size={12} className="shrink-0 text-white/25" />}
      </div>
      {!locked && <p className="text-[11px] leading-snug text-white/65">{relic.desc}</p>}
      {locked && <p className="text-[10px] leading-snug text-white/35">{hint}</p>}
      {locked && <BuyButton label={`Sblocca (${cost} 🍫)`} disabled={!canAfford} onClick={onBuy} />}
    </div>
  )
}

function BossTile({ boss, area, status }: { boss: BossDef; area: number; status: DiscoveryStatus }) {
  const hidden = status === 'hidden'
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center',
        hidden ? 'border-white/10 bg-white/5' : 'border-rose-400/40 bg-rose-500/10',
      )}
    >
      {hidden
        ? <Lock size={18} className="text-white/25" />
        : <Skull size={18} className="text-rose-300" style={{ filter: 'drop-shadow(0 0 6px rgba(244,63,94,0.5))' }} />}
      <p className={cn('font-display text-xs leading-tight', hidden ? 'text-white/40' : 'text-white/90')}>
        {hidden ? '???' : boss.name}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-white/30">Area {area + 1}</p>
    </div>
  )
}

function SynergyTile({ synergy, status, hint }: { synergy: Synergy; status: DiscoveryStatus; hint: string }) {
  const hidden = status === 'hidden'
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border p-3 text-left',
        hidden ? 'border-white/10 bg-white/5' : 'border-gold/40 bg-gold/10',
      )}
    >
      <p className={cn('font-display text-xs font-medium', hidden ? 'text-white/40' : 'text-[#f3e6c4]')}>
        {hidden ? '???' : synergy.name}
      </p>
      {hint && <p className="text-[10px] leading-snug text-white/35">{hint}</p>}
    </div>
  )
}

export function CollectionScreen() {
  const [profile, setProfile] = useState<MetaProfile | null>(null)

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

  const buy = (kind: Kind, id: string) => {
    if (!profile) return
    const cost = UNLOCK_COSTS[kind]
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

  return (
    <main className="flex-1 flex flex-col items-center gap-6 px-4 py-6 sm:gap-8 sm:p-8 max-w-5xl mx-auto w-full">
      <header className="mt-2 flex flex-col items-center gap-4 text-center sm:mt-6">
        <Insegna kicker="L'album delle Cioccorane" title="Collezione" />
        <Frame variant="panel" innerClassName="px-5 py-2.5">
          <p className="font-display text-lg font-bold text-[#f3e6c4]">{cioccorane} 🍫</p>
        </Frame>
        <div className="grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Partite giocate" value={stats.runsPlayed} />
          <StatTile label="Vittorie" value={stats.runsWon} />
          <StatTile label="Boss sconfitti" value={stats.bossesKilled} />
          <StatTile label="Miglior area" value={stats.bestStageReached} />
        </div>
      </header>

      <section className="w-full space-y-5">
        <h2 className="font-display text-sm uppercase tracking-wider text-white/50">Maghi</h2>
        {TIER_ORDER.map((tier) => {
          const wizards = WIZARDS.filter((w) => w.tier === tier)
          if (!wizards.length) return null
          return (
            <div key={tier}>
              <div className="mb-2">
                <Chip label={tierLabel(tier)} color={tierColor(tier)} size="md" />
              </div>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
                {wizards.map((w) => {
                  const status = statusFor(w.id, unlockedWizards, seenWizards)
                  return (
                    <WizardTile
                      key={w.id}
                      wizard={w}
                      status={status}
                      hint={unlockHint('wizard', w.id)}
                      cost={UNLOCK_COSTS.wizard}
                      canAfford={cioccorane >= UNLOCK_COSTS.wizard}
                      onBuy={() => buy('wizard', w.id)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>

      <section className="w-full space-y-5">
        <h2 className="font-display text-sm uppercase tracking-wider text-white/50">Reliquie</h2>
        {RARITY_ORDER.map((rarity) => {
          const relics = RELICS.filter((r) => r.rarity === rarity)
          if (!relics.length) return null
          return (
            <div key={rarity}>
              <div className="mb-2">
                <Chip label={rarity} color={RELIC_RARITY_COLOR[rarity]} size="md" className="capitalize" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {relics.map((r) => {
                  const status = statusFor(r.id, unlockedRelics, seenRelics)
                  return (
                    <RelicTile
                      key={r.id}
                      relic={r}
                      status={status}
                      hint={unlockHint('relic', r.id)}
                      cost={UNLOCK_COSTS.relic}
                      canAfford={cioccorane >= UNLOCK_COSTS.relic}
                      onBuy={() => buy('relic', r.id)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>

      <section className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm uppercase tracking-wider text-white/50">Boss</h2>
          <span className="text-[10px] uppercase tracking-wider text-white/35">
            {seenBosses.size}/{ALL_BOSSES.length} scoperti
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ALL_BOSSES.map(({ boss, area }) => (
            <BossTile
              key={boss.id}
              boss={boss}
              area={area}
              status={seenBosses.has(boss.name) ? 'seen' : 'hidden'}
            />
          ))}
        </div>
      </section>

      <section className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm uppercase tracking-wider text-white/50">Sinergie</h2>
          <span className="text-[10px] uppercase tracking-wider text-white/35">
            {seenSynergies.size}/{NAMED_SYNERGIES.length} scoperte
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

      <Link href="/" className="font-display text-sm uppercase tracking-wider text-white/70 hover:text-white">← Indietro al menu</Link>
    </main>
  )
}
