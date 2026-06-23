'use client'
import { useState } from 'react'
import Link from 'next/link'
import { GlowPanel } from '@/components/ui/GlowPanel'
import { Chip } from '@/components/ui/Chip'
import { SynergyGraph, KIND_COLOR } from '@/components/screens/compendium/SynergyGraph'
import { SPELLS } from '@/data/spells'
import { RELICS } from '@/data/relics'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
import {
  SPELL_TYPE_META, EFFECT_META, formatSpellStats, spellEffectChips,
} from '@/lib/glossary'
import { cn } from '@/lib/cn'
import type { SpellType } from '@/types/spell'
import type { RelicRarity } from '@/types/relic'

const HOW_TO_PLAY: Array<{ title: string; body: string }> = [
  { title: 'Draft', body: 'Scegli 1 mago tra 5 carte. Ripeti finché la tua squadra ha 5 maghi. Le carte non scelte vengono scartate.' },
  { title: 'Tier', body: 'Tier 1 Leggendario (raro e forte) → Tier 4 Comune. Mai più di un Tier 1 per schermata; ogni schermata garantisce almeno un Tier alto.' },
  { title: 'Combattimento', body: 'Le battaglie sono simulate automaticamente e in modo deterministico: velocità, danni, critici, schivate, cure e sinergie decidono il vincitore.' },
]

const SPELL_TYPE_ORDER: SpellType[] = ['Attacco', 'Difesa', 'Cura', 'Controllo']
const RARITY_ORDER: RelicRarity[] = ['comune', 'non-comune', 'rara', 'epica']

const RARITY_BLURB: Record<RelicRarity, string> = {
  comune: 'Bonus base, sempre utile.',
  'non-comune': 'Bonus condizionato alla casa.',
  rara: 'Bonus condizionato al ruolo.',
  epica: 'Effetti potenti con trigger speciali.',
}

const SYNERGY_KIND_META: Array<{ kind: 'house' | 'role' | 'group'; label: string; blurb: string }> = [
  { kind: 'house',  label: 'Casa',   blurb: '3+ maghi della stessa casa.' },
  { kind: 'role',   label: 'Ruolo',  blurb: '3+ maghi dello stesso ruolo.' },
  { kind: 'group',  label: 'Gruppo', blurb: 'Gruppi a tema (Golden Trio, Weasley…).' },
]

type Tab = 'gioco' | 'magie' | 'reliquie' | 'sinergie'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'gioco', label: 'Come si gioca' },
  { id: 'magie', label: 'Magie' },
  { id: 'reliquie', label: 'Reliquie' },
  { id: 'sinergie', label: 'Sinergie' },
]

/** Chip + blurb row: stacks on mobile, inline from sm up. */
/** One glossary entry: chip, then its blurb on the same line (wraps under on overflow). */
function GlossaryRow({ chip, blurb }: { chip: React.ReactNode; blurb: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="shrink-0">{chip}</span>
      <span className="text-sm text-white/60 leading-snug">{blurb}</span>
    </li>
  )
}

/** A titled glossary card; sits inside the masonry column flow. */
function GlossaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlowPanel className="p-4 sm:p-5 mb-4 sm:mb-5 break-inside-avoid">
      <p className="text-xs uppercase tracking-wider text-white/40 mb-3">{title}</p>
      <ul className="space-y-2.5">{children}</ul>
    </GlowPanel>
  )
}

export function RulesScreen() {
  const [tab, setTab] = useState<Tab>('gioco')

  return (
    <main className="flex-1 flex flex-col items-center gap-6 sm:gap-8 px-4 py-6 sm:p-8 max-w-4xl mx-auto w-full">
      <header className="text-center mt-2 sm:mt-6">
        <h1 className="font-display text-3xl sm:text-4xl">Compendio</h1>
        <p className="mt-2 text-white/60 text-sm max-w-xl mx-auto">
          Tutto ciò che serve sapere: come si gioca, cosa fanno le magie, le reliquie e le sinergie.
        </p>
      </header>

      {/* Tabs — scrollable on narrow screens, no wrap */}
      <nav
        aria-label="Sezioni del compendio"
        className="w-full flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:justify-center pb-1"
      >
        {TABS.map((t) => {
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={isActive}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-display uppercase tracking-wider transition-colors',
                isActive
                  ? 'bg-white/15 text-white border border-white/25'
                  : 'text-white/60 hover:text-white border border-white/10 bg-white/5',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {/* Glossario — always visible: the legend for chips everywhere.
          Masonry columns pack the asymmetric cards (Effetti is tall) with no gaps. */}
      <section className="w-full">
        <h2 className="sr-only">Glossario</h2>
        <div className="columns-1 sm:columns-2 xl:columns-3 gap-4 sm:gap-5">
          <GlossaryCard title="Tipi di magia">
            {SPELL_TYPE_ORDER.map((t) => (
              <GlossaryRow
                key={t}
                chip={<Chip label={t} color={SPELL_TYPE_META[t].color} icon={SPELL_TYPE_META[t].icon} />}
                blurb={SPELL_TYPE_META[t].blurb}
              />
            ))}
          </GlossaryCard>
          <GlossaryCard title="Effetti">
            {Object.entries(EFFECT_META).map(([k, m]) => (
              <GlossaryRow
                key={k}
                chip={<Chip label={m.label} color={m.color} icon={m.icon} />}
                blurb={m.blurb}
              />
            ))}
          </GlossaryCard>
          <GlossaryCard title="Rarità reliquie">
            {RARITY_ORDER.map((r) => (
              <GlossaryRow
                key={r}
                chip={<Chip label={r} color={RELIC_RARITY_COLOR[r]} className="capitalize" />}
                blurb={RARITY_BLURB[r]}
              />
            ))}
          </GlossaryCard>
          <GlossaryCard title="Tipi sinergia">
            {SYNERGY_KIND_META.map(({ kind, label, blurb }) => (
              <GlossaryRow
                key={kind}
                chip={<Chip label={label} color={KIND_COLOR[kind]} />}
                blurb={blurb}
              />
            ))}
          </GlossaryCard>
        </div>
      </section>

      {/* Come si gioca */}
      {tab === 'gioco' && (
        <section className="w-full grid gap-4 grid-cols-1 sm:grid-cols-3">
          {HOW_TO_PLAY.map((s) => (
            <GlowPanel key={s.title} className="p-4 sm:p-5 text-left">
              <h2 className="font-display text-lg mb-1">{s.title}</h2>
              <p className="text-white/70 text-sm leading-relaxed">{s.body}</p>
            </GlowPanel>
          ))}
        </section>
      )}

      {/* Magie */}
      {tab === 'magie' && (
        <section className="w-full space-y-6">
          {SPELL_TYPE_ORDER.map((type) => {
            const spells = SPELLS.filter((s) => s.type === type)
            if (!spells.length) return null
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <Chip label={type} color={SPELL_TYPE_META[type].color} icon={SPELL_TYPE_META[type].icon} size="md" />
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {spells.map((s) => {
                    const effectChips = spellEffectChips(s)
                    return (
                      <GlowPanel key={s.id} className="p-4">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-white/65 mt-0.5">{s.desc}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/55">
                          {formatSpellStats(s).map((st) => (
                            <span key={st.label}><span className="text-white/40">{st.label}</span> {st.value}</span>
                          ))}
                        </div>
                        {effectChips.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {effectChips.map((c) => <Chip key={c.label} label={c.label} color={c.color} icon={c.icon} />)}
                          </div>
                        )}
                      </GlowPanel>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* Reliquie */}
      {tab === 'reliquie' && (
        <section className="w-full space-y-6">
          {RARITY_ORDER.map((rarity) => {
            const relics = RELICS.filter((r) => r.rarity === rarity)
            if (!relics.length) return null
            return (
              <div key={rarity}>
                <div className="mb-2">
                  <Chip label={rarity} color={RELIC_RARITY_COLOR[rarity]} size="md" />
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {relics.map((r) => (
                    <GlowPanel key={r.id} className="p-4">
                      <p className="font-medium" style={{ color: RELIC_RARITY_COLOR[rarity] }}>{r.name}</p>
                      <p className="text-xs text-white/70 mt-0.5">{r.desc}</p>
                    </GlowPanel>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* Sinergie — signature */}
      {tab === 'sinergie' && (
        <section className="w-full">
          <p className="text-white/55 text-sm mb-4">Combina case, ruoli e gruppi per bonus potenti. Tocca un nodo per vedere il bonus.</p>
          <SynergyGraph />
        </section>
      )}

      <Link href="/" className="text-white/70 hover:text-white text-sm uppercase tracking-wider font-display">← Indietro al menu</Link>
    </main>
  )
}
