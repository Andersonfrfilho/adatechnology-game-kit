import type { ShapeGenerator } from './types'

const generators = new Map<string, ShapeGenerator>()

/**
 * Registers a generator for `{ kind: 'custom', generator: name, params }` nodes: a pure function of its params and a seeded stream that returns a
 * node. A worker that generates shapes with custom nodes must register the same generators (import the same module in the worker script).
 */
export function registerGenerator(name: string, generator: ShapeGenerator): void {
  if (!/^[a-zA-Z][\w.:-]*$/.test(name)) throw new Error(`game-shapes: generator name "${name}" must start with a letter and use letters, digits, ".", ":", "-" or "_"`)
  generators.set(name, generator)
}
export const unregisterGenerator = (name: string): boolean => generators.delete(name)
export const getGenerator = (name: string): ShapeGenerator | undefined => generators.get(name)
export const listGenerators = (): string[] => [...generators.keys()].sort()
