'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { GlowPanel } from '@/components/ui/GlowPanel'
import { Chip } from '@/components/ui/Chip'
import { RoleIcon } from '@/components/cards/RoleIcon'
import { SPELLS } from '@/data/spells'
import { RELICS } from '@/data/relics'
import { DUOS, SIGNAL_LABEL, SIGNAL_ICON, SIGNAL_COLOR, SIGNAL_HOWTO } from '@/data/duos'
import { trioText } from '@/game/engine/trioText'
import { houseTheme } from '@/lib/theme'
import type { House } from '@/types'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
import { ROLE_INFO } from '@/lib/roleInfo'
import {
  SPELL_TYPE_META, EFFECT_META, formatSpellStats, spellEffectChips,
} from '@/lib/glossary'
import { cn } from '@/lib/cn'
import type { SpellType } from '@/types/spell'
import type { RelicRarity } from '@/types/relic'
import type { Role } from '@/types'

const HOW_TO_PLAY: Array<{ title: string; body: string }> = [
  { title: 'Draft', body: 'Scegli 1 mago tra 3 carte. Ripeti finché la squadra iniziale ha 3 maghi; recluti gli altri lungo il cammino (fino a 5). Le carte non scelte vengono scartate.' },
  { title: 'Tier', body: 'Tier 1 Leggendario (raro e forte) → Tier 4 Comune. Mai più di un Tier 1 per schermata; ogni schermata garantisce almeno un Tier alto.' },
  { title: 'Combattimento', body: 'Le battaglie sono simulate automaticamente e in modo deterministico: velocità, danni, critici, schivate, cure e Combo Duo decidono il vincitore.' },
]

const SPELL_TYPE_ORDER: SpellType[] = ['Attacco', 'Difesa', 'Cura', 'Controllo']
const RARITY_ORDER: RelicRarity[] = ['comune', 'non-comune', 'rara', 'epica']

// Role identity for the glossary: each role's colour matches its combat lean
// (Attaccante=danno, Tank=difesa, Supporto=cura, Controllo=disturbo). Blurbs come
// straight from ROLE_INFO (single source of truth, also used as the card tooltip).
const ROLE_ORDER: Role[] = ['Attaccante', 'Tank', 'Supporto', 'Controllo']
const ROLE_COLOR: Record<Role, string> = {
  Attaccante: '#FF8A7A',
  Tank: '#7DB7FF',
  Supporto: '#7CFC9B',
  Controllo: '#C79BFF',
}

const RARITY_BLURB: Record<RelicRarity, string> = {
  comune: 'Bonus base, sempre utile.',
  'non-comune': 'Bonus condizionato alla casa.',
  rara: 'Bonus condizionato al ruolo.',
  epica: 'Effetti potenti con trigger speciali.',
}

type Tab = 'gioco' | 'combo' | 'magie' | 'reliquie'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'gioco', label: 'Come si gioca' },
  { id: 'combo', label: 'Combo Duo' },
  { id: 'magie', label: 'Magie' },
  { id: 'reliquie', label: 'Reliquie' },
]

/** One glossary entry: chip, then its blurb on the same line (wraps under on overflow). */
function GlossaryRow({ chip, blurb }: { chip: React.ReactNode; blurb: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5 [&+&]:border-t [&+&]:border-white/5">
      <span className="shrink-0">{chip}</span>
      <span className="text-sm text-white/55 leading-snug pt-0.5">{blurb}</span>
    </li>
  )
}

/** A titled glossary card in the balanced grid. `wide` spans the full row. */
function GlossaryCard({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <Frame variant="panel" className={wide ? 'sm:col-span-2' : undefined} innerClassName="p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 mb-3">{title}</p>
      <ul>{children}</ul>
    </Frame>
  )
}

/** Engraved gold section divider — the ledger masthead used across the premium UI. */
function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-display text-[11px] uppercase tracking-[0.18em] text-gold">{label}</span>
      <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(90deg,rgba(217,182,95,0.4),transparent)' }} />
    </div>
  )
}

export function RulesScreen() {
  const [tab, setTab] = useState<Tab>('gioco')

  return (
    <main className="flex-1 flex flex-col items-center gap-6 sm:gap-8 px-4 py-6 sm:p-8 max-w-5xl mx-auto w-full">
      <header className="text-center mt-2 sm:mt-6">
        <Insegna kicker="Il grimorio del gioco" title="Compendio" />
        <p className="mt-2 text-white/60 text-sm max-w-xl mx-auto">
          Tutto ciò che serve sapere: come si gioca, cosa fanno le magie e le reliquie.
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
                  ? 'border border-gold/50 bg-gold/15 text-[#f3e6c4] shadow-[0_0_14px_rgba(202,162,74,0.25)]'
                  : 'text-white/60 hover:text-white border border-white/10 bg-white/5 hover:border-gold/30',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {/* Come si gioca — numbered steps (a real sequence) + a balanced glossary grid. */}
      {tab === 'gioco' && (
        <div className="w-full space-y-8">
          <section className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {HOW_TO_PLAY.map((s, i) => (
              <GlowPanel key={s.title} className="relative p-5 text-left">
                <span
                  className="mb-3 grid h-7 w-7 place-items-center rounded-full font-display text-[13px] font-extrabold text-[#0c0a16]"
                  style={{ background: 'linear-gradient(135deg,#f6ecc4,#a9802f)', boxShadow: '0 0 10px rgba(217,182,95,0.4)' }}
                >
                  {i + 1}
                </span>
                <h2 className="font-display text-lg mb-1 text-[#f6ecc4]">{s.title}</h2>
                <p className="text-white/60 text-sm leading-relaxed">{s.body}</p>
              </GlowPanel>
            ))}
          </section>

          <section>
            <SectionTitle label="Glossario" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {/* Ruoli — the four archetypes. Icon + name chip, behaviour from ROLE_INFO.
                  Full width, two columns, so it reads as the headline of the glossary. */}
              <GlossaryCard title="Ruoli dei maghi" wide>
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
                  {ROLE_ORDER.map((r) => (
                    <GlossaryRow
                      key={r}
                      chip={
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                          style={{ color: ROLE_COLOR[r], borderColor: `${ROLE_COLOR[r]}55`, background: `${ROLE_COLOR[r]}14` }}
                        >
                          <RoleIcon role={r} size={13} />
                          {r}
                        </span>
                      }
                      blurb={ROLE_INFO[r]}
                    />
                  ))}
                </div>
              </GlossaryCard>
              <GlossaryCard title="Tipi di magia">
                {SPELL_TYPE_ORDER.map((t) => (
                  <GlossaryRow key={t} chip={<Chip label={t} color={SPELL_TYPE_META[t].color} icon={SPELL_TYPE_META[t].icon} />} blurb={SPELL_TYPE_META[t].blurb} />
                ))}
              </GlossaryCard>
              <GlossaryCard title="Rarità reliquie">
                {RARITY_ORDER.map((r) => (
                  <GlossaryRow key={r} chip={<Chip label={r} color={RELIC_RARITY_COLOR[r]} className="capitalize" />} blurb={RARITY_BLURB[r]} />
                ))}
              </GlossaryCard>
              {/* Effetti is the longest list — give it the full width and split its rows
                  into two columns so the grid stays balanced instead of one tall card. */}
              <GlossaryCard title="Effetti di stato" wide>
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
                  {Object.entries(EFFECT_META).map(([k, m]) => (
                    <GlossaryRow key={k} chip={<Chip label={m.label} color={m.color} icon={m.icon} />} blurb={m.blurb} />
                  ))}
                </div>
              </GlossaryCard>
            </div>
          </section>
        </div>
      )}

      {/* Combo Duo */}
      {tab === 'combo' && (
        <section className="w-full space-y-6">
          <p className="max-w-2xl text-sm leading-relaxed text-white/60">
            Due <span className="text-gold">segnali</span> in squadra accendono una <span className="text-gold">Combo Duo</span>:
            un bonus di battaglia permanente. I segnali vengono dai ruoli dei maghi o dalle loro affinità
            (veleno, esecuzione, scudo/rigen, magie oscure). Accendi entrambi i segnali di una combo e l'effetto è tuo.
          </p>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {DUOS.map((duo) => (
              <GlowPanel key={duo.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-lg font-bold text-gold">{duo.name}</p>
                  {/* Recipe: signal ＋ signal, each in its own colour/glyph */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {duo.signals.map((sig, i) => (
                      <span key={sig} className="flex items-center gap-1.5">
                        {i > 0 && <span aria-hidden className="text-white/30">＋</span>}
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{ color: SIGNAL_COLOR[sig], borderColor: `${SIGNAL_COLOR[sig]}66`, background: `${SIGNAL_COLOR[sig]}18` }}
                        >
                          <span aria-hidden>{SIGNAL_ICON[sig]}</span>
                          {SIGNAL_LABEL[sig]}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm leading-snug text-white/75">{duo.desc}</p>
                <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-2">
                  {duo.signals.map((sig) => (
                    <p key={sig} className="flex items-center gap-1.5 text-[11px] text-white/45">
                      <span aria-hidden style={{ color: SIGNAL_COLOR[sig] }}>{SIGNAL_ICON[sig]}</span>
                      <span className="text-white/60">{SIGNAL_LABEL[sig]}:</span> {SIGNAL_HOWTO[sig]}
                    </p>
                  ))}
                </div>
              </GlowPanel>
            ))}
          </div>

          {/* Le casate amplificano le Combo — sistema Trio (game/engine/trios.ts). */}
          <div className="mt-2 space-y-3 rounded-2xl border border-gold/25 bg-gold/[0.04] p-5">
            <div>
              <p className="font-display text-lg font-bold text-gold">Le casate potenziano le Combo</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/65">
                Con <span className="text-white/85">3 maghi della stessa casata</span> in squadra e almeno una
                Combo Duo attiva, quella casata <span className="text-white/85">amplifica</span> le tue combo con un
                bonus permanente. Con <span className="text-white/85">4+ maghi</span> il bonus è più forte. Costruire
                di casata è un secondo livello di sinergia sopra le Combo.
              </p>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {(['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso'] as House[]).map((house) => {
                const color = houseTheme(house).color
                return (
                  <div
                    key={house}
                    className="flex items-start gap-3 rounded-xl border bg-black/25 p-3"
                    style={{ borderColor: `${color}44` }}
                  >
                    <span
                      aria-hidden
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md border font-display text-sm font-bold"
                      style={{ color, borderColor: `${color}66`, background: `${color}1f` }}
                    >
                      {house[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color }}>{house}</p>
                      <p className="text-xs leading-snug text-white/70">{trioText(house, 0)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
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

      <Link href="/" className="text-white/70 hover:text-white text-sm uppercase tracking-wider font-display">← Indietro al menu</Link>
    </main>
  )
}
