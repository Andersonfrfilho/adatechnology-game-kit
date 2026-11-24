import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { NOT_YET_USED } from './not-yet-used'
import { site } from './helpers'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGES_DIR = join(HERE, '../../../packages')
const GAME_DIR = join(HERE, '../src/game')
/** The host `createKitWorld` is what the page builds the world with: what it imports is instantiated by every page. */
const HOST_DIR = join(PACKAGES_DIR, 'game-kit-defaults/src/world')
/** R2: the two packages the scene is not asked to use. */
const EXCEPTIONS = ['game-test-room', 'game-vehicles-proving'] as const
const IMPORT_FROM = /(?:from|import\()\s*'@adatechnology\/([a-z0-9-]+)[^']*'/g

const sourcesOf = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourcesOf(path)
    return name.endsWith('.ts') ? [path] : []
  })

/** The packages named by the imports of the `.ts` files under the folders, a subpath (`game-vegetation/three`) counting for its package. */
function importedPackages(dirs: readonly string[]): Set<string> {
  const found = new Set<string>()
  for (const file of dirs.flatMap(sourcesOf)) for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_FROM)) found.add(match[1] as string)
  return found
}

const packagesOnDisk = readdirSync(PACKAGES_DIR).filter((name) => existsSync(join(PACKAGES_DIR, name, 'package.json')))
const expected = packagesOnDisk.filter((name) => !EXCEPTIONS.some((exception) => exception === name))
// the host's own package is the assembly's entry: the page calls `createKitWorld` and `createKitWorkers` from it
const used = importedPackages([GAME_DIR, HOST_DIR])
const pendingOwners = new Map<string, string[]>()
for (const entry of site.missing) for (const owner of entry.owner) pendingOwners.set(owner, [...(pendingOwners.get(owner) ?? []), `${entry.id} (${entry.task})`])
const isPending = (name: string): boolean => !used.has(name) && pendingOwners.has(name)

describe('R2: the assembly uses every package of the SDK', () => {
  it('reads packages from disk and the imports of the assembly and of the host', () => {
    expect(expected.length).toBeGreaterThan(60)
    expect(used.has('game-kit-defaults')).toBe(true)
    expect(used.has('game-physics-jolt')).toBe(true)
    expect(EXCEPTIONS.every((name) => packagesOnDisk.includes(name))).toBe(true)
    expect(used.has('game-test-room')).toBe(false)
  })

  it('has every package used, pending by a `missing` entry of the site, or listed in NOT_YET_USED', () => {
    const uncovered = expected.filter((name) => !used.has(name) && !isPending(name) && !(name in NOT_YET_USED))
    expect(uncovered, `packages neither used, pending nor in NOT_YET_USED: ${uncovered.join(', ')}`).toEqual([])
  })

  it('keeps NOT_YET_USED honest: no package that exists no more, is used now, or is already pending', () => {
    const listed = Object.keys(NOT_YET_USED)
    expect(listed.filter((name) => !expected.includes(name)), 'listed but not in packages/').toEqual([])
    expect(listed.filter((name) => used.has(name)), 'listed but used now: take it out of the table').toEqual([])
    expect(listed.filter((name) => pendingOwners.has(name)), 'listed but a `missing` entry already waits for it').toEqual([])
  })

  it('names an existing package as the owner of every `missing` entry', () => {
    expect([...pendingOwners.keys()].filter((name) => !packagesOnDisk.includes(name))).toEqual([])
  })

  it('reports the pending packages with their owner task, and what the table leaves undecided', () => {
    const pending = expected.filter(isPending).map((name) => `${name}: ${pendingOwners.get(name)?.join(', ')}`)
    const undecided = Object.entries(NOT_YET_USED).flatMap(([name, bringer]) => ('undecided' in bringer ? [`${name}: ${bringer.undecided}`] : []))
    console.info(`pending by missing (${pending.length}):\n  ${pending.join('\n  ')}\nundecided (${undecided.length}):\n  ${undecided.join('\n  ')}`)
    expect(pending.length).toBeGreaterThan(0)
  })
})
