import { createBlastQuery } from './blast-query'
import type { BlastQuery } from './blast-query'
import type { SeamWorld, Vec3 } from './contract'
import { createCorpseBodies } from './engine-corpses'
import type { CorpseBodies, SettledCorpse } from './engine-corpses'
import type { PhysicsLoop } from './loop'
import { createServiceChannel } from './service-channel'
import type { ServiceChannel } from './service-channel'
import { WorkBudget } from './work-budget'

/** What a module needs of the host's physics to make bodies of its own: one loop and its world, a blast query, and the one set of corpse bodies of the world. */
export interface PhysicsServices {
  readonly loop: PhysicsLoop
  readonly world: SeamWorld
  readonly blast: BlastQuery
  /** The corpse bodies of the world, made on the first call and the same after it. */
  corpses(): CorpseBodies
  /** The points the corpses' distance is taken from (the player's); read once in each fixed step. */
  setInterest(interest: () => readonly Vec3[]): void
  /** The channel `name` of this host's physics, made on the first call and the same after it: how a module hands another what it made (`CROWD_AGENTS_CHANNEL`). */
  channel<TValue>(name: string): ServiceChannel<TValue>
  /** `listener` hears each corpse that fell asleep far from where its owner has it (`CorpseBodiesOptions.onSettled`), inside the fixed step; returns the call that stops it. */
  onCorpseSettled(listener: (corpse: SettledCorpse) => void): () => void
  /** Takes the corpse bodies out of the world and stops following the loop; the loop and the world stay the host's. */
  dispose(): void
}

export interface PhysicsServicesOptions {
  readonly loop: PhysicsLoop
  /** The frame's budget the corpses' changes of rung draw from. Without one the services make their own and refill it after each frame's steps; a budget given is refilled by its owner. */
  readonly budget?: WorkBudget
}

/** The channel the crowd lends its agents on: a value is `{ crowd, agents }` as `createRunOver` takes them (the crowd and the capsules of its agents). */
export const CROWD_AGENTS_CHANNEL = 'crowd.agents'

const NO_INTEREST: () => readonly Vec3[] = () => []

export const createPhysicsServices = ({ loop, budget }: PhysicsServicesOptions): PhysicsServices => {
  let interest: () => readonly Vec3[] = NO_INTEREST
  let corpses: CorpseBodies | null = null
  const channels = new Map<string, ServiceChannel<unknown>>()
  const settledListeners = new Set<(corpse: SettledCorpse) => void>()
  const work = budget ?? new WorkBudget()
  const stopRefill = budget ? () => undefined : loop.add({ afterSteps: () => work.beginFrame() }, 'rules')
  return {
    loop,
    world: loop.world,
    blast: createBlastQuery(loop.world),
    corpses: () => (corpses ??= createCorpseBodies(loop, { interest: () => interest(), budget: work, onSettled: (corpse) => settledListeners.forEach((listener) => listener(corpse)) })),
    setInterest: (next) => void (interest = next),
    channel: <TValue>(name: string): ServiceChannel<TValue> => {
      if (!channels.has(name)) channels.set(name, createServiceChannel<unknown>())
      return channels.get(name) as ServiceChannel<TValue>
    },
    onCorpseSettled: (listener) => {
      settledListeners.add(listener)
      return () => void settledListeners.delete(listener)
    },
    dispose: () => {
      stopRefill()
      settledListeners.clear()
      corpses?.dispose()
      corpses = null
    },
  }
}

export const isPhysicsServices = (value: unknown): value is PhysicsServices => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PhysicsServices>
  return typeof candidate.corpses === 'function' && typeof candidate.setInterest === 'function' && typeof candidate.blast === 'object' && typeof candidate.loop === 'object' && typeof candidate.world === 'object'
}
