import type { Behavior } from './behavior'
import { createBlocksBehavior } from './behaviors/blocks'
import { createCarBehavior } from './behaviors/car'
import { createCracksBehavior } from './behaviors/cracks'
import { createCylinderBehavior } from './behaviors/cylinder'
import { createPlateBehavior } from './behaviors/plate'
import { createRainBehavior } from './behaviors/rain'
import { createWalkersBehavior } from './behaviors/walkers'

/** How to build each prop the Workshop animates by hand, by id (see `Behavior`). A game adds its own the same way. */
export const WORKSHOP_BEHAVIORS: Readonly<Record<string, () => Behavior>> = {
  walkers: () => createWalkersBehavior(),
  cracks: () => createCracksBehavior(),
  blocks: () => createBlocksBehavior(),
  plate: () => createPlateBehavior(),
  cylinder: () => createCylinderBehavior(),
  car: () => createCarBehavior(),
  rain: () => createRainBehavior(),
}

/** A fresh set of the props the Workshop animates by hand, by id; one per runner, since they keep state. */
export function createWorkshopBehaviors(factories: Readonly<Record<string, () => Behavior>> = WORKSHOP_BEHAVIORS): Record<string, Behavior> {
  return Object.fromEntries(Object.entries(factories).map(([id, make]) => [id, make()]))
}
