export type TutorialStepId = 'draft' | 'ruoli' | 'autobattle' | 'duo'

export interface TutorialCtx {
  phase: 'draft' | 'battle' | 'other'
  hasActiveDuo: boolean
}

export interface TutorialStep {
  id: TutorialStepId
  anchor: string // data-testid of the element to highlight
  title: string
  body: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  when: (c: TutorialCtx) => boolean
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'draft',
    anchor: 'draft-pick-0',
    placement: 'right',
    title: 'Pesca la tua squadra',
    body: 'Scegli 3 maghi: sono la squadra con cui affronterai tutta la run.',
    when: (c) => c.phase === 'draft',
  },
  {
    id: 'ruoli',
    anchor: 'draft-pick-0',
    placement: 'right',
    title: 'I ruoli si contrano',
    body: 'Ogni mago ha un ruolo. Tank → Attaccante → Supporto → Controllo → Tank: ognuno è forte contro il successivo.',
    when: (c) => c.phase === 'draft',
  },
  {
    id: 'duo',
    anchor: 'duo-panel',
    placement: 'left',
    title: 'Hai formato un Duo!',
    body: 'Due maghi compatibili accendono una combo automatica. Guardala nel pannello: si scatenerà in battaglia.',
    when: (c) => c.hasActiveDuo && c.phase !== 'battle',
  },
  {
    id: 'autobattle',
    anchor: 'battle-arena',
    placement: 'top',
    title: 'Prepari, poi guardi',
    body: 'Non controlli i colpi: la squadra combatte da sola in base a come l\'hai formata. Il tuo lavoro è la preparazione.',
    when: (c) => c.phase === 'battle',
  },
]
