import { FINDS_PROVIDERS, RESULT_EXTENSIONS } from './registry'
import type { ResultExtension } from './registry'
import { createRng } from './rng'
import type { FindsQuery, FindStack, FloorplanOptions, Json, Plan } from './types'

/** Extensions in the order they run: registration order, with each one after the ones it names. */
function orderOf(extensions: readonly ResultExtension[]): ResultExtension[] {
  const ordered: ResultExtension[] = []
  const visiting = new Set<string>()
  const visit = (extension: ResultExtension) => {
    if (ordered.includes(extension)) return
    if (visiting.has(extension.name)) throw new Error('Result extensions depend on each other: ' + extension.name)
    visiting.add(extension.name)
    for (const name of extension.after) {
      const before = extensions.find((x) => x.name === name)
      if (before) visit(before)
    }
    visiting.delete(extension.name)
    ordered.push(extension)
  }
  extensions.forEach(visit)
  return ordered
}

/** Runs the registered extensions and stores each output in `result[name]`. */
export function runResultExtensions(plan: Plan, result: Json, seed: number | string, options: FloorplanOptions): void {
  for (const extension of orderOf(RESULT_EXTENSIONS)) {
    result[extension.name] = extension.run({ plan, result, seed, rng: createRng(seed, extension.seedKey), options })
  }
}

/** What a container holds, from the first registered provider that has an answer; none registered means nothing. */
export function findsFor(query: FindsQuery): readonly FindStack[] {
  for (const provider of FINDS_PROVIDERS) {
    const stacks = provider.findsFor(query)
    if (stacks.length > 0) return stacks
  }
  return []
}
