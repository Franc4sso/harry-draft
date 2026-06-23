'use client'
import Link from 'next/link'
import { GlowPanel } from '@/components/ui/GlowPanel'
import { Chip } from '@/components/ui/Chip'
import { SynergyGraph } from '@/components/screens/compendium/SynergyGraph'
import { SPELLS } from '@/data/spells'
import { RELICS } from '@/data/relics'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
import {
  SPELL_TYPE_META, EFFECT_META, formatSpellStats, spellEffectChips,
} from '@/lib/glossary'
import type { SpellType } from '@/types/spell'
import type { RelicRarity } from '@/types/relic'

const HOW_TO_PLAY: Array<{ title: string; body: string }> = [
  { title: 'Draft', body: 'Scegli 1 mago tra 5 carte. Ripeti finché la tua squadra ha 5 maghi. Le carte non scelte vengono scartate.' },
  { title: 'Tier', body: 'Tier 1 Leggendario (raro e forte) → Tier 4 Comune. Mai più di un Tier 1 per schermata; ogni schermata garantisce almeno un Tier alto.' },
  { title: 'Combattimento', body: 'Le battaglie sono simulate automaticamente e in modo deterministico: velocità, danni, critici, schivate, cure e sinergie decidono il vincitore.' },
]

const SPELL_TYPE_ORDER: SpellType[] = ['Attacco', 'Difesa', 'Cura', 'Controllo']
const RARITY_ORDER: RelicRarity[] = ['comune', 'non-comune', 'rara', 'epica']

export function RulesScreen() {
  return (
    <main className="flex-1 flex flex-col items-center gap-10 p-8 max-w-4xl mx-auto w-full">
      <header className="text-center mt-6">
        <h1 className="font-display text-4xl">Compendio</h1>
        <p className="mt-2 text-white/60 text-sm max-w-xl mx-auto">
          Tutto ciò che serve sapere: come si gioca, cosa fanno le magie, le reliquie e le sinergie.
        </p>
      </header>

      {/* Come si gioca */}
      <section className="w-full grid gap-4 md:grid-cols-3">
        {HOW_TO_PLAY.map((s) => (
          <GlowPanel key={s.title} className="p-5 text-left">
            <h2 className="font-display text-lg mb-1">{s.title}</h2>
            <p className="text-white/70 text-sm leading-relaxed">{s.body}</p>
          </GlowPanel>
        ))}
      </section>

      {/* Glossario */}
      <section className="w-full">
        <h2 className="font-display text-2xl mb-4">Glossario</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <GlowPanel className="p-5">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Tipi di magia</p>
            <ul className="space-y-2">
              {SPELL_TYPE_ORDER.map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <Chip label={t} color={SPELL_TYPE_META[t].color} icon={SPELL_TYPE_META[t].icon} />
                  <span className="text-sm text-white/65">{SPELL_TYPE_META[t].blurb}</span>
                </li>
              ))}
            </ul>
          </GlowPanel>
          <GlowPanel className="p-5">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Effetti</p>
            <ul className="space-y-2">
              {Object.entries(EFFECT_META).map(([k, m]) => (
                <li key={k} className="flex items-center gap-3">
                  <Chip label={m.label} color={m.color} icon={m.icon} />
                  <span className="text-sm text-white/65">{m.blurb}</span>
                </li>
              ))}
            </ul>
          </GlowPanel>
        </div>
      </section>

      {/* Magie */}
      <section className="w-full">
        <h2 className="font-display text-2xl mb-4">Magie</h2>
        <div className="space-y-6">
          {SPELL_TYPE_ORDER.map((type) => {
            const spells = SPELLS.filter((s) => s.type === type)
            if (!spells.length) return null
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <Chip label={type} color={SPELL_TYPE_META[type].color} icon={SPELL_TYPE_META[type].icon} size="md" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {spells.map((s) => (
                    <GlowPanel key={s.id} className="p-4">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-white/65 mt-0.5">{s.desc}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/55">
                        {formatSpellStats(s).map((st) => (
                          <span key={st.label}><span className="text-white/40">{st.label}</span> {st.value}</span>
                        ))}
                      </div>
                      {spellEffectChips(s).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {spellEffectChips(s).map((c) => <Chip key={c.label} label={c.label} color={c.color} icon={c.icon} />)}
                        </div>
                      )}
                    </GlowPanel>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Reliquie */}
      <section className="w-full">
        <h2 className="font-display text-2xl mb-4">Reliquie</h2>
        <div className="space-y-6">
          {RARITY_ORDER.map((rarity) => {
            const relics = RELICS.filter((r) => r.rarity === rarity)
            if (!relics.length) return null
            return (
              <div key={rarity}>
                <div className="mb-2">
                  <Chip label={rarity} color={RELIC_RARITY_COLOR[rarity]} size="md" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </section>

      {/* Sinergie — signature */}
      <section className="w-full">
        <h2 className="font-display text-2xl mb-1">Sinergie</h2>
        <p className="text-white/55 text-sm mb-4">Combina case, ruoli e gruppi per bonus potenti. Esplora il grafo.</p>
        <SynergyGraph />
      </section>

      <Link href="/" className="text-white/70 hover:text-white text-sm uppercase tracking-wider font-display">← Indietro al menu</Link>
    </main>
  )
}
