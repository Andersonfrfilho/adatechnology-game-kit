// The first load of the furniture room page (sala-moveis.html): the room's own loading indicator (the kit's, `room.loading`) covers the page from the start, with a bar
// that moves module by module, then while the area asked by `?area=` is laid and until what it laid has come to rest. Only then does the page show the room.
import type { SpawnedObject, TestRoom } from '@adatechnology/game-test-room'

/** One step of the modules' load, as `loadIntoAsync` tells it. */
export interface LoadProgress {
  readonly index: number
  readonly total: number
  readonly name: string
  readonly done?: boolean
  /** The item of the module being built and checked now, when the module loads an item at a time. */
  readonly item?: string
}

export interface BootOptions<TReport> {
  /** Loads the modules into the room, telling each step (`loadIntoAsync` of the entry). */
  readonly load: (room: TestRoom, options: { readonly onProgress: (progress: LoadProgress) => void }) => Promise<TReport>
  /** The report once the modules are in (the page publishes it as `__furnitureReport`). */
  readonly onLoaded?: (report: TReport) => void
  readonly search?: string
}

/** Share of the bar each phase fills: the modules, the laying of the area, its settling. */
const MODULES_SHARE = 70
const AREA_SHARE = 85
const BAR_TOTAL = 100
/** The area has settled when nothing it laid moved more than this in a window, metres, for `QUIET_WINDOWS` windows in a row. */
const QUIET_MOVE = 0.002
const QUIET_WINDOW_MS = 400
const QUIET_WINDOWS = 2
/** A piece that never sleeps (a jitter) must not hold the page closed: past this many windows (30 s) the room shows anyway. */
const SETTLE_WINDOWS = 75

const TEXTS = {
  'pt-BR': { title: 'Sala de móveis', starting: 'Iniciando…', opening: 'Montando a área', settling: 'Assentando as peças', moving: 'em movimento', ready: 'Pronta' },
  en: { title: 'Furniture room', starting: 'Starting…', opening: 'Laying the area', settling: 'Settling the pieces', moving: 'moving', ready: 'Ready' },
} as const

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Where every piece of the room is now, by object id. */
const positionsOf = (pieces: readonly SpawnedObject[]): Map<string, readonly [number, number, number]> =>
  new Map(pieces.map((so) => [so.objectId, [so.root.position.x, so.root.position.y, so.root.position.z] as const]))

/** How many pieces moved more than `QUIET_MOVE` since `before` (a piece that left the room counts as still). */
function movingSince(room: TestRoom, before: ReadonlyMap<string, readonly [number, number, number]>): number {
  let moving = 0
  for (const so of room.spawned()) {
    const at = before.get(so.objectId)
    if (!at) continue
    const p = so.root.position
    if (Math.hypot(p.x - at[0], p.y - at[1], p.z - at[2]) > QUIET_MOVE) moving++
  }
  return moving
}

/** Waits for what the area laid to come to rest, telling on the bar how many pieces still move. */
async function settle(room: TestRoom, step: (text: string, done: number) => void, text: { readonly settling: string; readonly moving: string }): Promise<void> {
  let quiet = 0
  for (let pass = 0; pass < SETTLE_WINDOWS && quiet < QUIET_WINDOWS; pass++) {
    const before = positionsOf(room.spawned())
    await wait(QUIET_WINDOW_MS)
    const moving = movingSince(room, before)
    quiet = moving === 0 ? quiet + 1 : 0
    const share = Math.max((pass + 1) / SETTLE_WINDOWS, quiet / QUIET_WINDOWS)
    step(`${text.settling}: ${moving} ${text.moving}`, Math.round(AREA_SHARE + (BAR_TOTAL - AREA_SHARE - 1) * share))
  }
}

/**
 * Boots the page: shows the room's loading indicator at once (opaque), loads the modules with the bar, opens the area of `?area=` (when a loaded module brings it) and waits
 * for it to settle, then takes the indicator down. Resolves with the modules' report.
 */
export async function bootFurnitureRoom<TReport>(room: TestRoom, options: BootOptions<TReport>): Promise<TReport> {
  const params = new URLSearchParams(options.search ?? globalThis.location?.search ?? '')
  const text = params.get('lang') === 'en' ? TEXTS.en : TEXTS['pt-BR']
  const task = room.loading.begin(text.title, { total: BAR_TOTAL, opaque: true })
  try {
    task.step(text.starting, 0)
    await task.paint()
    const report = await options.load(room, {
      onProgress: (progress) => task.step(progress.done ? text.opening : `${progress.name} ${progress.index}/${progress.total}${progress.item ? ` · ${progress.item}` : ''}`, Math.round(((progress.index - 1) / progress.total) * MODULES_SHARE)),
    })
    options.onLoaded?.(report)
    const area = params.get('area')
    if (area && room.modules().some((module) => module.id === area && module.hasArea)) {
      task.step(text.opening, MODULES_SHARE)
      await task.paint()
      room.openArea(area)
      task.step(text.settling, AREA_SHARE)
      await task.paint()
      await settle(room, (line, done) => task.step(line, done), text)
    }
    task.step(text.ready, BAR_TOTAL)
    await task.paint()
    return report
  } finally {
    task.end()
  }
}
