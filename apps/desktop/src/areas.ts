/**
 * What the app can open and how it is asked for (pure: tested without Electron). The pages are the 4280's: the test room (`test-room.html`, every area
 * of the kit's modules behind `?area=`) and each example's page. Nothing here is listed by hand: the examples come from the stage's manifest (written from
 * `tools/check-area/plan.mjs`, the list `pnpm check:<área>` uses) and the room's areas from the room itself (`room.modules()`).
 */

/** An example page (`examples/<folder>`) as the stage found it; `page` is its built html, null when the example was not built. */
export type ExampleEntry = {
  readonly id: string
  readonly folder: string
  readonly name: string
  readonly description: string
  readonly page: string | null
}

export type DesktopManifest = { readonly examples: readonly ExampleEntry[] }

/** An area of the test room, as `room.modules()` reports a module that has one. */
export type RoomArea = { readonly id: string; readonly name: string; readonly group?: string }

export const ROOM_PAGE = 'test-room.html'
export const MENU_PATH = '/__desktop/menu'
export const MENU_IDS: readonly string[] = ['menu', 'home', 'inicio']
export const ROOM_IDS: readonly string[] = ['room', 'test-room', 'sala']

export type Solver = 'jolt' | 'own'
export type JoltBuildChoice = 'multithread' | 'single'

/** How the app was asked to start and what the room page gets. */
export type LaunchOptions = {
  readonly area: string | undefined
  readonly solver: Solver
  readonly joltBuild: JoltBuildChoice
  /** Job threads besides the main one; above 0 only runs with `joltContacts: 'off'` (the kit's contact rules off: a measurement mode). */
  readonly joltThreads: number | 'auto' | undefined
  readonly joltContacts: 'js' | 'off'
  readonly lang: 'pt' | 'en' | undefined
}

export const DEFAULT_LAUNCH: LaunchOptions = { area: undefined, solver: 'jolt', joltBuild: 'multithread', joltThreads: undefined, joltContacts: 'js', lang: undefined }

const flagOf = (argv: readonly string[], name: string): string | undefined => {
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const at = argv.indexOf(`--${name}`)
  const next = at >= 0 ? argv[at + 1] : undefined
  return next !== undefined && !next.startsWith('--') ? next : undefined
}

type LaunchEnv = Readonly<Record<string, string | undefined>>

/** `--area=<id>` (or `KIT_DESKTOP_AREA`), `--solver=jolt|own`, `--jolt-build=multithread|single`, `--jolt-threads=N|auto`, `--jolt-contacts=js|off`, `--lang=pt|en`. */
export const parseLaunch = (argv: readonly string[], env: LaunchEnv = {}): LaunchOptions => {
  const pick = (flag: string, variable: string): string | undefined => flagOf(argv, flag) ?? env[variable]
  const area = pick('area', 'KIT_DESKTOP_AREA')
  const solver = pick('solver', 'KIT_DESKTOP_SOLVER')
  const build = pick('jolt-build', 'KIT_DESKTOP_JOLT_BUILD')
  const threads = pick('jolt-threads', 'KIT_DESKTOP_JOLT_THREADS')
  const contacts = pick('jolt-contacts', 'KIT_DESKTOP_JOLT_CONTACTS')
  const lang = pick('lang', 'KIT_DESKTOP_LANG')
  const threadCount = threads === 'auto' ? 'auto' : threads !== undefined && /^\d+$/.test(threads) ? Number(threads) : undefined
  return {
    area: area && area.length > 0 ? area : undefined,
    solver: solver === 'own' ? 'own' : DEFAULT_LAUNCH.solver,
    joltBuild: build === 'single' ? 'single' : DEFAULT_LAUNCH.joltBuild,
    joltThreads: threadCount,
    joltContacts: contacts === 'off' ? 'off' : 'js',
    lang: lang === 'en' || lang === 'pt' ? lang : undefined,
  }
}

/** The room page's query for the physics the launch asked for (the page itself falls back to one thread when a combination cannot run). */
export const physicsQuery = (options: LaunchOptions): string => {
  const parts: string[] = []
  if (options.lang) parts.push(`lang=${options.lang}`)
  if (options.solver === 'own') return parts.join('&')
  parts.push('solver=jolt')
  if (options.joltBuild === 'multithread') parts.push('joltBuild=multithread')
  if (options.joltThreads !== undefined) parts.push(`joltThreads=${options.joltThreads}`)
  if (options.joltContacts === 'off') parts.push('joltContacts=off')
  return parts.join('&')
}

export type Target = { readonly kind: 'menu' } | { readonly kind: 'room'; readonly area: string | undefined } | { readonly kind: 'example'; readonly entry: ExampleEntry }

/** What an `--area` id opens: the menu, the room (on one of its areas), or an example's own page when one with that id was built. */
export const resolveArea = (id: string | undefined, manifest: DesktopManifest): Target => {
  if (id === undefined || MENU_IDS.includes(id)) return { kind: 'menu' }
  if (ROOM_IDS.includes(id)) return { kind: 'room', area: undefined }
  const example = manifest.examples.find((entry) => (entry.id === id || entry.folder === id) && entry.page !== null)
  if (example && !ROOM_IDS.includes(example.id)) return { kind: 'example', entry: example }
  return { kind: 'room', area: id }
}

/** The path (with query) of a target on the app's server. */
export const pathOf = (target: Target, options: LaunchOptions): string => {
  if (target.kind === 'menu') return MENU_PATH
  if (target.kind === 'example') return `/${target.entry.folder}/${target.entry.page ?? ''}`
  const query = [target.area ? `area=${encodeURIComponent(target.area)}` : '', physicsQuery(options)].filter(Boolean).join('&')
  return `/${ROOM_PAGE}${query ? `?${query}` : ''}`
}

/** The areas worth a menu entry: the modules that bring their own area, sorted by name. */
export const roomAreasOf = (modules: readonly { readonly id: string; readonly name: string; readonly group?: string; readonly hasArea: boolean }[]): RoomArea[] =>
  modules
    .filter((module) => module.hasArea)
    .map((module) => ({ id: module.id, name: module.name, ...(module.group ? { group: module.group } : {}) }))
    .sort((a, b) => a.name.localeCompare(b.name))
