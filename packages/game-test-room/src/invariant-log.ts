import type { KitEnergyOver } from '@adatechnology/game-destruction-three'

import type { WritableLog } from './log'

type Vars = Record<string, string | number>

/** What the room knows of an object it logs about: its name, and the item it was spawned from. */
export type InvariantSubject = { readonly name: string; readonly itemId?: string }

export type InvariantLogOptions = {
  readonly log: WritableLog
  readonly t: (key: string, vars?: Vars) => string
  readonly subjectOf: (objectId: string) => InvariantSubject | undefined
  /** Where the kit's rules tell of energy they made: the log listens to it for as long as the room lives. */
  readonly destruction: { on(event: 'kitEnergy', handler: (over: KitEnergyOver) => void): () => void }
}

/** The checks the room says aloud when the kit breaks one of its own invariants (`check`/`fail`, with the invariant's name in `data`). */
export type InvariantLog = {
  /** What was left of an object after a break stood on nothing, and the renderer let it go. */
  readonly brokenFloating: (objectId: string) => void
  /** A rule of the kit gave a piece more energy than its own fall would (`DestructionEvents.kitEnergy`). */
  readonly kitEnergy: (over: KitEnergyOver) => void
}

export const createInvariantLog = ({ log, t, subjectOf, destruction }: InvariantLogOptions): InvariantLog => {
  const fail = (invariant: string, objectId: string, text: (name: string) => string, data: Record<string, string | number> = {}): void => {
    const subject = subjectOf(objectId)
    log.add({ channel: 'check', type: 'fail', text: text(subject?.name ?? objectId), objectId, ...(subject?.itemId ? { itemId: subject.itemId } : {}), data: { invariant, ...data } })
  }
  const kitEnergy = ({ rule, objectId, given, fall }: KitEnergyOver): void =>
    fail('kit_energy', objectId, (name) => t('check.kit_energy', { name, rule, given: given.toFixed(1), fall: fall.toFixed(1) }), { rule, given, fall })
  destruction.on('kitEnergy', kitEnergy)
  return {
    brokenFloating: (objectId) => fail('broken_floating', objectId, (name) => t('check.broken_floating', { name })),
    kitEnergy,
  }
}
