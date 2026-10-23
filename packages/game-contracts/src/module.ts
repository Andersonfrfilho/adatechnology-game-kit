import type { AnimationClipSpec } from './animation'
import type { DestructibleSpec, Vec3 } from './destruction'
import type { DestructibleImpl } from './impact'
import type { ContainerSpec } from './fluids'

/** An item that holds a liquid (a cup, a bottle, a fuel tank). `part` is the destruction part that is the container; a hole in it makes it leak. */
export interface ModuleItemFluid {
  container: ContainerSpec
  part?: string
  /** Item uses offered while held (`drink`, `pour`...). */
  uses?: string[]
  offset?: Vec3
}

/** One thing a module can put in the test room (or any viewer): a toy car, a chair, a pistol on a table. */
export interface TestableItem {
  /** snake_case id, unique inside the module. */
  id: string
  /** Display name, already translated for the locale passed to `TestableModule.items`. */
  name: string
  /**
   * Builds the 3D object: `THREE` is the host's three.js namespace, the result is its `Object3D` (origin at the centre of the footprint, on the
   * floor, front facing +z). The contracts package does not depend on three.js, so both are `unknown` here; the host narrows them.
   */
  build: (THREE: unknown) => unknown
  /** Destruction spec for the default destruction world. A module that owns its destruction gives `impl` instead (or as well). */
  spec?: DestructibleSpec | ((root: unknown) => DestructibleSpec)
  /** The module's own destruction: parts, hits and state are its business. The world hosts it next to its own objects. `id` is the object id the host gives it: `DestructibleImpl.id` must be that id. */
  impl?: (root: unknown, id: string) => DestructibleImpl
  fluid?: ModuleItemFluid
  /** The item is also a weapon the player can equip: an id of the arsenal in use. */
  weapon?: string
  /** Use animations this item brings (a pistol `reload` moves `mag`; a car door `open` rotates `door_l`). */
  animations?: AnimationClipSpec[]
  /** Can be grabbed and thrown. */
  movable?: boolean
}

/** A scripted check a module brings: the host calls `run` with its own context (the test room passes a `ScenarioContext`). */
export interface ModuleScenario<Context = unknown> {
  id: string
  name: string
  run(context: Context): void | Promise<void>
}

/** What a module hands the test room: its items and, optionally, scenarios that exercise them. */
export interface TestableModule<Context = unknown> {
  /** snake_case id of the module. */
  id: string
  name: string
  /** Catalogue tab the items go under. */
  group: string
  items(locale: string): TestableItem[]
  scenarios?(locale: string): Array<ModuleScenario<Context>>
}
