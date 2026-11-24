import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { NOT_YET_USED, SPEC_LACUNAS, SPEC_TASKS } from './not-yet-used'
import { site } from './helpers'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGES_DIR = join(HERE, '../../../packages')
const GAME_DIR = join(HERE, '../src/game')
/** The host `createKitWorld` builds the world of every page with: what it imports is instantiated, unless the file is one of the optional ones below. */
const HOST_DIR = join(PACKAGES_DIR, 'game-kit-defaults/src/world')
/** R2: the two packages the scene is not asked to use. */
const EXCEPTIONS = ['game-test-room', 'game-vehicles-proving'] as const
/**
 * Files of the host that run only when the scene passes their option to `createKitWorld`. Others are optional too (the sounds can be turned off) but the page turns them on by default, which no
 * static read can tell, so the rule is conservative: a host file counts unless it is listed here and the option is absent from `src/game/main.ts`.
 */
const OPTIONAL_HOST_FILES: Readonly<Record<string, string>> = { 'graphics.ts': 'graphics' }
const SOURCE_FILE = /\.(?:ts|tsx|js|mjs)$/
const STATIC_IMPORT = /\b(?:import|export)\s+(type\s+)?(?:[\w*{}\s,$]+?\s+from\s*)?(['"])@adatechnology\/([a-z0-9-]+)[^'"]*\2/g
const DYNAMIC_IMPORT = /\bimport\(\s*(['"])@adatechnology\/([a-z0-9-]+)[^'"]*\1\s*\)/g

const sourcesOf = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourcesOf(path)
    return SOURCE_FILE.test(name) ? [path] : []
  })

const withoutComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\w])\/\/.*$/gm, '$1')

/** The packages a file imports at run time: `import type` does not count, a comment does not, a subpath (`game-vegetation/three`) counts for its package. */
export function importedPackagesOf(source: string): string[] {
  const text = withoutComments(source)
  const statics = [...text.matchAll(STATIC_IMPORT)].flatMap((match) => (match[1] ? [] : [match[3] as string]))
  const dynamics = [...text.matchAll(DYNAMIC_IMPORT)].map((match) => match[2] as string)
  return [...statics, ...dynamics]
}

const mainSource = readFileSync(join(GAME_DIR, 'main.ts'), 'utf8')
const isHostFileRun = (file: string): boolean => {
  const option = OPTIONAL_HOST_FILES[basename(file)]
  return option === undefined || new RegExp(`\\b${option}\\s*:`).test(withoutComments(mainSource))
}
const files = [...sourcesOf(GAME_DIR), ...sourcesOf(HOST_DIR).filter(isHostFileRun)]
const used = new Set(files.flatMap((file) => importedPackagesOf(readFileSync(file, 'utf8'))))

const packagesOnDisk = readdirSync(PACKAGES_DIR).filter((name) => existsSync(join(PACKAGES_DIR, name, 'package.json')))
const expected = packagesOnDisk.filter((name) => !EXCEPTIONS.some((exception) => exception === name))
const pendingOwners = new Map<string, string[]>()
for (const entry of site.missing) for (const owner of entry.owner) pendingOwners.set(owner, [...(pendingOwners.get(owner) ?? []), `${entry.id} (${entry.task})`])
const isPending = (name: string): boolean => !used.has(name) && pendingOwners.has(name)

describe('the import reader', () => {
  it('skips type imports and comments, reads both quotes, subpaths, re-exports and dynamic imports', () => {
    const source = [
      "import type { A } from '@adatechnology/game-a'",
      "export type { B } from '@adatechnology/game-b'",
      "// import { C } from '@adatechnology/game-c'",
      "/* import { D } from '@adatechnology/game-d' */",
      'import { E } from "@adatechnology/game-e/three"',
      "import * as F from '@adatechnology/game-f'",
      "export { G } from '@adatechnology/game-g'",
      "const h = await import('@adatechnology/game-h')",
      "import '@adatechnology/game-i'",
      "import {\n  J,\n  K,\n} from '@adatechnology/game-j'",
    ].join('\n')
    expect(importedPackagesOf(source).sort()).toEqual(['game-e', 'game-f', 'game-g', 'game-h', 'game-i', 'game-j'])
  })
})

describe('R2: the assembly uses every package of the SDK', () => {
  it('reads packages from disk and the imports of the assembly and of the host', () => {
    expect(expected.length).toBeGreaterThan(60)
    expect(used.has('game-kit-defaults')).toBe(true)
    expect(used.has('game-physics-jolt')).toBe(true)
    expect(EXCEPTIONS.every((name) => packagesOnDisk.includes(name))).toBe(true)
    expect(used.has('game-test-room')).toBe(false)
  })

  it('does not count the optional graphics of the host while the page does not turn it on', () => {
    expect(withoutComments(mainSource)).not.toMatch(/\bgraphics\s*:/)
    expect(used.has('game-graphics')).toBe(false)
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

  it('gives every entry of NOT_YET_USED a task of the spec, a lacuna of its section 8, or a reason', () => {
    for (const [name, bringer] of Object.entries(NOT_YET_USED)) {
      if ('task' in bringer) expect(bringer.proposed === true || SPEC_TASKS.includes(bringer.task), `${name}: ${bringer.task} is not a task of tasks.md (mark it proposed)`).toBe(true)
      else if ('lacuna' in bringer) expect(SPEC_LACUNAS, name).toContain(bringer.lacuna)
      else expect(bringer.notScenePackage.length, name).toBeGreaterThan(20)
    }
  })

  it('names an existing package as the owner of every `missing` entry', () => {
    expect([...pendingOwners.keys()].filter((name) => !packagesOnDisk.includes(name))).toEqual([])
  })

  it('reports the pending packages with their owner task', () => {
    const pending = expected.filter(isPending).map((name) => `${name}: ${pendingOwners.get(name)?.join(', ')}`)
    console.info(`pending by missing (${pending.length}):\n  ${pending.join('\n  ')}`)
    expect(pending.every((line) => line.includes('('))).toBe(true)
  })
})
