import { readFileSync } from 'node:fs'

const cache = new Map<string, string>()

/** A team source file, read once per process. */
export const readSource = (path: string): string => {
  const cached = cache.get(path)
  if (cached !== undefined) return cached
  const text = readFileSync(path, 'utf8')
  cache.set(path, text)
  return text
}

/** The part of a source that starts at `marker`: names such as `J` or `TYPES` appear more than once in the game, so each cut says where to look. */
export const fromMarker = (source: string, marker: string): string => {
  const start = source.indexOf(marker)
  if (start < 0) throw new Error(`characters-catalog: marker "${marker}" not found`)
  return source.slice(start)
}
