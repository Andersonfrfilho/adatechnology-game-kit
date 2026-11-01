import type { ShapeGenerator } from './types'

const GENERATOR_NAME = /^[a-zA-Z][\w.:-]*$/

/** The generators of one set: what `{ kind: 'custom', generator: name, params }` nodes look up. */
export interface ShapeGenerators {
  /**
   * Registers a generator: a pure function of its params and a seeded stream that returns a node. A worker that generates shapes with custom nodes must
   * register the same generators (import the same module in the worker script).
   */
  register(name: string, generator: ShapeGenerator): void
  unregister(name: string): boolean
  get(name: string): ShapeGenerator | undefined
  list(): string[]
  /** The generators by name, as `GenerateOptions.generators` takes them. */
  record(): Readonly<Record<string, ShapeGenerator>>
}

export const generatorsOver = (generators: Map<string, ShapeGenerator>): ShapeGenerators => ({
  register(name, generator) {
    if (!GENERATOR_NAME.test(name)) throw new Error(`game-shapes: generator name "${name}" must start with a letter and use letters, digits, ".", ":", "-" or "_"`)
    generators.set(name, generator)
  },
  unregister: (name) => generators.delete(name),
  get: (name) => generators.get(name),
  list: () => [...generators.keys()].sort(),
  record: () => Object.fromEntries(generators),
})

let defaultGenerators: ShapeGenerators | undefined

/** The set behind `registerGenerator`, `getGenerator` and the rest of the global functions, created on first use. */
export const defaultShapeGenerators = (): ShapeGenerators => (defaultGenerators ??= generatorsOver(new Map()))

/** @deprecated use `createShapes(...).register`. */
export const registerGenerator = (name: string, generator: ShapeGenerator): void => defaultShapeGenerators().register(name, generator)
/** @deprecated use `createShapes(...).unregister`. */
export const unregisterGenerator = (name: string): boolean => defaultShapeGenerators().unregister(name)
/** @deprecated use `createShapes(...).get`. */
export const getGenerator = (name: string): ShapeGenerator | undefined => defaultShapeGenerators().get(name)
/** @deprecated use `createShapes(...).list`. */
export const listGenerators = (): string[] => defaultShapeGenerators().list()
