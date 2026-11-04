// @ts-check
// Which browser suites of tools/gpu/browser-checks.mjs a branch needs, from the files it changed against origin/main (CLAUDE.md section 9). Each suite opens
// pages, and each page loads workspace packages: a suite runs when the branch changed one of its pages' folders or a package its pages load (directly or
// through the packages those depend on). A change to what every page stands on runs every suite; a change to docs, specs or tests runs none.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** The example areas, with the test room first: the other pages are built over its page. */
export const AREAS = /** @type {const} */ ([
  'test-room',
  'interactables-test-area',
  'floorplan-test-area',
  'vfx-test-area',
  'weapons-test-area',
  'characters-test-area',
  'animals-test-area',
  'vehicles-test-area',
  'vegetation-test-area',
  'urban-test-area',
  'audio-test-area',
  'weather-test-area',
  'player-test-area',
  'crowd-test-area',
  'stories-test-area',
])

/** The test room page carries every module of the kit: its build embeds interactables-test-area's entry, which loads them all. */
const ROOM_PAGES = ['test-room', 'interactables-test-area']

/**
 * The suites, in the order they run. `pages` are the folders under examples/ whose page the suite opens, `folders` other files it is made of.
 * @typedef {{ readonly id: string, readonly group: 'areas' | 'scene' | 'leak', readonly pages: readonly string[], readonly folders: readonly string[] }} SuiteSpec
 * @type {readonly SuiteSpec[]}
 */
export const SUITES = [
  ...AREAS.map((area) => /** @type {SuiteSpec} */ ({ id: area, group: 'areas', pages: area === 'test-room' ? ROOM_PAGES : [area], folders: [] })),
  { id: 'scene', group: 'scene', pages: ROOM_PAGES, folders: ['tools/kit-audit/'] },
  { id: 'cost', group: 'scene', pages: ROOM_PAGES, folders: ['tools/kit-audit/'] },
  { id: 'leak', group: 'leak', pages: ROOM_PAGES, folders: [] },
]

/**
 * Packages that run every suite. By the dependency graph: game-contracts, game-shapes, game-shapes-three and game-render-three are loaded by three in four
 * area pages or more (`basePackagesOf`, checked by the unit test). By the room: every area is built over the test room's page (game-test-room), and the
 * room breaks the objects of every area through game-destruction and game-destruction-three.
 */
export const BASE_PACKAGES = [
  '@adatechnology/game-contracts',
  '@adatechnology/game-shapes',
  '@adatechnology/game-shapes-three',
  '@adatechnology/game-render-three',
  '@adatechnology/game-test-room',
  '@adatechnology/game-destruction',
  '@adatechnology/game-destruction-three',
]
/** The share of the area pages a package must be loaded by to count as base. */
export const BASE_SHARE = 0.75

/** Files every page stands on: the gate itself, the hooks, the workspace and its lockfile, the base compiler options and the room's own page. */
const BASE_PATHS = [/^\.githooks\//, /^tools\/gpu\//, /^package\.json$/, /^pnpm-lock\.yaml$/, /^pnpm-workspace\.yaml$/, /^tsconfig\.base\.json$/, /^examples\/test-room\//]
/** Files no page reads: docs, specs, changesets, CI, lint settings, unit tests, the site. */
const PAGELESS_PATHS = [
  /\.md$/,
  /^(docs|specs|site|test-support|\.changeset|\.github)\//,
  /^packages\/[^/]+\/tests\//,
  /^(LICENSE|\.gitignore|\.dockerignore|compose\.yaml|railway\.json|eslint\.config\.mjs|eslint-suppressions\.json|\.dependency-cruiser.*)$/,
]

/** @typedef {{ readonly packageOfFolder: ReadonlyMap<string, string>, readonly dependencies: ReadonlyMap<string, readonly string[]>, readonly pageLoads: ReadonlyMap<string, readonly string[]> }} Workspace */
/** @typedef {{ readonly id: string, readonly reasons: readonly string[] }} SelectedSuite */
/** @typedef {{ readonly all: boolean, readonly reason: string, readonly suites: readonly SelectedSuite[] }} Selection */

/** @param {string} file @returns {Record<string, unknown>} */
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
/** @param {unknown} value @returns {string[]} */
const workspaceNames = (value) => (value && typeof value === 'object' ? Object.keys(value).filter((name) => name.startsWith('@adatechnology/')) : [])

/** The files of a page that import packages: its src tree and its scripts. @param {string} dir @returns {string[]} */
const pageSources = (dir) => {
  /** @type {string[]} */
  const found = []
  /** @param {string} at */
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(m?[jt]sx?)$/.test(name)) found.push(path)
    }
  }
  if (existsSync(join(dir, 'src'))) walk(join(dir, 'src'))
  for (const name of readdirSync(dir)) if (name.endsWith('.mjs')) found.push(join(dir, name))
  return found
}

/** Reads the workspace: each package's folder and runtime dependencies, and the packages each example page declares or imports. @param {string} root @returns {Workspace} */
export const readWorkspace = (root) => {
  /** @type {Map<string, string>} */
  const packageOfFolder = new Map()
  /** @type {Map<string, readonly string[]>} */
  const dependencies = new Map()
  for (const dir of readdirSync(join(root, 'packages'))) {
    const file = join(root, 'packages', dir, 'package.json')
    if (!existsSync(file)) continue
    const pkg = readJson(file)
    const name = String(pkg.name)
    packageOfFolder.set(`packages/${dir}`, name)
    dependencies.set(name, [...workspaceNames(pkg.dependencies), ...workspaceNames(pkg.peerDependencies)])
  }
  /** @type {Map<string, readonly string[]>} */
  const pageLoads = new Map()
  for (const page of AREAS) {
    const dir = join(root, 'examples', page)
    const pkg = readJson(join(dir, 'package.json'))
    const imported = pageSources(dir).flatMap((file) => readFileSync(file, 'utf8').match(/@adatechnology\/[a-z0-9-]+/g) ?? [])
    pageLoads.set(page, [...new Set([...workspaceNames(pkg.dependencies), ...workspaceNames(pkg.devDependencies), ...imported])].filter((name) => dependencies.has(name)))
  }
  return { packageOfFolder, dependencies, pageLoads }
}

/** Every package `names` load, themselves included. @param {Workspace} workspace @param {readonly string[]} names @returns {Set<string>} */
export const closureOf = (workspace, names) => {
  const seen = new Set()
  const stack = [...names]
  for (let name = stack.pop(); name !== undefined; name = stack.pop()) {
    if (seen.has(name)) continue
    seen.add(name)
    stack.push(...(workspace.dependencies.get(name) ?? []))
  }
  return seen
}

/** The packages loaded by at least `BASE_SHARE` of the area pages other than the room's. @param {Workspace} workspace @returns {string[]} */
export const basePackagesOf = (workspace) => {
  const pages = AREAS.filter((page) => !ROOM_PAGES.includes(page))
  /** @type {Map<string, number>} */
  const count = new Map()
  for (const page of pages) for (const name of closureOf(workspace, workspace.pageLoads.get(page) ?? [])) count.set(name, (count.get(name) ?? 0) + 1)
  return [...count].filter(([, pagesLoading]) => pagesLoading >= pages.length * BASE_SHARE).map(([name]) => name).sort()
}

/** What a changed file is: nothing a page reads, a base file, a package, a folder, or a path no rule knows. @param {Workspace} workspace @param {string} file */
const classify = (workspace, file) => {
  if (PAGELESS_PATHS.some((pattern) => pattern.test(file))) return /** @type {const} */ ({ kind: 'pageless' })
  if (BASE_PATHS.some((pattern) => pattern.test(file))) return /** @type {const} */ ({ kind: 'base' })
  const [top, dir] = file.split('/')
  const name = top === 'packages' && dir ? workspace.packageOfFolder.get(`packages/${dir}`) : undefined
  if (name) return BASE_PACKAGES.includes(name) ? /** @type {const} */ ({ kind: 'base' }) : /** @type {const} */ ({ kind: 'package', name })
  if ((top === 'examples' || top === 'tools') && dir) return /** @type {const} */ ({ kind: 'folder', folder: `${top}/${dir}/` })
  return /** @type {const} */ ({ kind: 'unknown' })
}

/** Selects the suites for the changed files (paths from the repository root). @param {Workspace} workspace @param {readonly string[]} changed @returns {Selection} */
export const selectSuites = (workspace, changed) => {
  const everything = (/** @type {string} */ reason) => ({ all: true, reason, suites: SUITES.map((suite) => ({ id: suite.id, reasons: [reason] })) })
  /** @type {Map<string, string[]>} */
  const reasons = new Map()
  for (const file of changed) {
    const what = classify(workspace, file)
    if (what.kind === 'base') return everything(`${file} is under every page`)
    if (what.kind === 'unknown') return everything(`${file} is outside the map`)
    if (what.kind === 'pageless') continue
    for (const suite of SUITES) {
      const folders = [...suite.pages.map((page) => `examples/${page}/`), ...suite.folders]
      const hit = what.kind === 'folder' ? folders.includes(what.folder) : closureOf(workspace, suite.pages.flatMap((page) => workspace.pageLoads.get(page) ?? [])).has(what.name)
      if (!hit) continue
      const why = what.kind === 'folder' ? what.folder : what.name.replace('@adatechnology/', '')
      const list = reasons.get(suite.id) ?? []
      if (!list.includes(why)) list.push(why)
      reasons.set(suite.id, list)
    }
  }
  const suites = SUITES.filter((suite) => reasons.has(suite.id)).map((suite) => ({ id: suite.id, reasons: reasons.get(suite.id) ?? [] }))
  return { all: false, reason: suites.length ? 'the branch changes what these pages load' : 'the branch changes nothing a page loads', suites }
}
