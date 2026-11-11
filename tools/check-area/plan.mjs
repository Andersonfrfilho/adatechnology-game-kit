// @ts-check
// What `pnpm check:<area>` runs for one test area (tools/check-area/check-area.mjs), as pure data so it is tested without building anything:
// the build of the packages the area's page loads (with their dependencies), the room page the area is built over when it is missing, the unit tests of
// those packages (vitest, no GPU) and the area's own page test (examples/<folder>/test.mjs: opens the page in Chromium and writes the prints to shots/).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The test room itself and the pages that are not built over the room page. */
const ROOM_FOLDER = 'test-room'
const STANDALONE = new Set([ROOM_FOLDER, 'interactables-showroom'])
/** The room page embeds the furniture area's entry (examples/test-room/build.mjs), so building the room builds that area's packages first. */
const ROOM_ENTRY_FOLDER = 'interactables-test-area'

/**
 * The short name of an area: `floorplan-test-area` is `floorplan`, `vehicles-proving-area` is `vehicles-proving`, `interactables-showroom` is
 * `showroom`, `items-test-area` is `items-area` and the room is `room`.
 * @param {string} folder @returns {string}
 */
export function areaId(folder) {
  if (folder === ROOM_FOLDER) return 'room'
  if (folder === 'interactables-showroom') return 'showroom'
  // `check:items` is the item catalogue's own check (packages/game-items-goods/scripts/check-items.mjs), so the items area is `check:items-area`
  if (folder === 'items-test-area') return 'items-area'
  return folder.replace(/-test-area$/, '').replace(/-area$/, '')
}

/** @typedef {{ id: string, folder: string, name: string }} Area */

/** Every folder of examples/ with a package.json and a test.mjs. @param {string} root @returns {Area[]} */
export function listAreas(root) {
  const examples = join(root, 'examples')
  return readdirSync(examples, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(examples, entry.name, 'package.json')) && existsSync(join(examples, entry.name, 'test.mjs')))
    .map((entry) => {
      const manifest = /** @type {{ name?: unknown }} */ (JSON.parse(readFileSync(join(examples, entry.name, 'package.json'), 'utf8')))
      return { id: areaId(entry.name), folder: entry.name, name: typeof manifest.name === 'string' ? manifest.name : entry.name }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * The workspace packages (folders of packages/) a page loads: its package.json dependencies and every `game-*` package its build script names.
 * @param {{ manifest: string, build: string, packages: readonly string[] }} input file texts and the folder names under packages/
 * @returns {string[]} folder names, sorted
 */
export function pagePackages({ manifest, build, packages }) {
  const known = new Set(packages)
  const found = new Set()
  const parsed = /** @type {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} */ (JSON.parse(manifest))
  for (const name of Object.keys({ ...parsed.dependencies, ...parsed.devDependencies })) {
    const folder = name.replace(/^@adatechnology\//, '')
    if (known.has(folder)) found.add(folder)
  }
  for (const match of build.matchAll(/['"`/](game-[a-z0-9-]+)['"`/]/g)) if (match[1] && known.has(match[1])) found.add(match[1])
  return [...found].sort()
}

/** @typedef {{ label: string, command: string, args: string[], env?: Record<string, string> }} Step */
/** @typedef {{ unit: boolean, browser: boolean, room: boolean }} Flags */

/** @param {string[]} folders @returns {string[]} pnpm filters that build these packages and everything they depend on */
const withDependencies = (folders) => folders.flatMap((folder) => ['--filter', `@adatechnology/${folder}...`])

/**
 * The steps of `pnpm check:<area>`, in order.
 * @param {{ area: Area, packages: string[], roomPackages: string[], roomBuilt: boolean, flags: Flags }} input `packages` are the area page's packages, `roomPackages` the room page's (its build script and the furniture area's entry)
 * @returns {Step[]}
 */
export function planCheck({ area, packages, roomPackages, roomBuilt, flags }) {
  /** @type {Step[]} */
  const steps = []
  const needsRoom = area.folder === ROOM_FOLDER || (!STANDALONE.has(area.folder) && (flags.room || !roomBuilt))
  const toBuild = [...new Set([...packages, ...(needsRoom ? roomPackages : [])])].sort()
  if (toBuild.length) steps.push({ label: `build ${toBuild.length} packages and their dependencies`, command: 'pnpm', args: [...withDependencies(toBuild), 'run', 'build'] })
  if (needsRoom && area.folder !== ROOM_FOLDER) steps.push({ label: 'build the test room page', command: 'node', args: [`examples/${ROOM_FOLDER}/build.mjs`] })
  steps.push({ label: `build ${area.folder}`, command: 'node', args: [`examples/${area.folder}/build.mjs`] })
  if (flags.unit && packages.length) {
    steps.push({ label: `unit tests of ${packages.join(', ')}`, command: 'pnpm', args: [...packages.flatMap((folder) => ['--filter', `@adatechnology/${folder}`]), 'run', 'test'] })
  }
  if (flags.browser) steps.push({ label: `open ${area.folder} in the browser (prints in examples/${area.folder}/shots)`, command: 'node', args: [`examples/${area.folder}/test.mjs`], env: { EXAMPLE_PART: '' } })
  return steps
}

export { ROOM_ENTRY_FOLDER, ROOM_FOLDER }
