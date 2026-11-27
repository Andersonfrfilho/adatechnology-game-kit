import { createBlastQuery } from './blast-query'
import type { BlastQuery } from './blast-query'
import type { SeamWorld, Vec3 } from './contract'
import { createCorpseBodies } from './engine-corpses'
import type { CorpseBodies } from './engine-corpses'
import type { PhysicsLoop } from './loop'
import type { WorkBudget } from './work-budget'

/** What a module needs of the host's physics to make bodies of its own: one loop and its world, a blast query, and the one set of corpse bodies of the world. */
export interface PhysicsServices {
  readonly loop: PhysicsLoop
  readonly world: SeamWorld
  readonly blast: BlastQuery
  /** The corpse bodies of the world, made on the first call and the same after it. */
  corpses(): CorpseBodies
  /** The points the corpses' distance is taken from (the player's); read once in each fixed step. */
  setInterest(interest: () => readonly Vec3[]): void
  /** Takes the corpse bodies out of the world and stops following the loop; the loop and the world stay the host's. */
  dispose(): void
}

export interface PhysicsServicesOptions {
  readonly loop: PhysicsLoop
  /** The frame's budget the corpses' changes of rung draw from. */
  readonly budget?: WorkBudget
}

const NO_INTEREST: () => readonly Vec3[] = () => []

export const createPhysicsServices = ({ loop, budget }: PhysicsServicesOptions): PhysicsServices => {
  let interest: () => readonly Vec3[] = NO_INTEREST
  let corpses: CorpseBodies | null = null
  return {
    loop,
    world: loop.world,
    blast: createBlastQuery(loop.world),
    corpses: () => (corpses ??= createCorpseBodies(loop, { interest: () => interest(), ...(budget ? { budget } : {}) })),
    setInterest: (next) => void (interest = next),
    dispose: () => {
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
