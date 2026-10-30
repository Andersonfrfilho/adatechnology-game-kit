import type { Vec3 } from '@adatechnology/game-contracts'

/**
 * What a trial does to one object: a shot, a punch, a knife blow, a flame on it or a blast beside it. The test table runs one on the object it has picked, so every item of the
 * catalogue can be tried one by one with the same hit.
 */
export type TrialKind = 'shot' | 'punch' | 'stab' | 'fire' | 'blast'

export const TRIAL_KINDS: readonly TrialKind[] = ['shot', 'punch', 'stab', 'fire', 'blast']

/**
 * How the room runs a trial: the tool (an id of the arsenal), where the player stands and how long the trigger is held.
 * `distance` is metres from the front face of the object (the side the player comes from) to the eye, `lift` metres the eye is above the object's centre, `hold` seconds the
 * trigger stays down (a flame). For `blast` the explosive of `weapon` goes off `distance` metres behind the object, and the player watches from `watch` metres in front.
 */
export interface TrialTool {
  readonly weapon: string
  readonly distance: number
  readonly lift: number
  readonly hold?: number
  readonly watch?: number
}

/** The tools of the trials: a 9 mm pistol, the fists, a knife, a flamethrower and a fragmentation grenade, all of the default arsenal. */
export const DEFAULT_TRIALS: Readonly<Record<TrialKind, TrialTool>> = {
  shot: { weapon: 'pistol_9mm', distance: 2.5, lift: 0.5 },
  punch: { weapon: 'fists', distance: 0.3, lift: 0.15 },
  stab: { weapon: 'knife', distance: 0.22, lift: 0.1 },
  fire: { weapon: 'flamethrower', distance: 1.6, lift: 0.4, hold: 0.8 },
  blast: { weapon: 'frag_grenade', distance: 0.3, lift: 1, watch: 6 },
}

/** The test table: which piece of the arena it is, the gap between the things laid on it and the trial tools (each one replaces the default's fields it gives). */
export interface TestTableOptions {
  /** Id of the `scenery` piece with a `top` the items are laid on (default `test_table`). */
  readonly scenery?: string
  /** Metres between two items on the table (default 0.12). */
  readonly gap?: number
  /** Metres kept free at each end of the table (default 0.1). */
  readonly margin?: number
  readonly trials?: Partial<Record<TrialKind, Partial<TrialTool>>>
}

/** One item laid on the table. */
export interface TestTableObject {
  readonly objectId: string
  readonly itemId: string
  readonly name: string
}

/** The page of a group that lies on the table now. */
export interface TestTablePage {
  /** The catalogue group (its translated name, as the catalogue tabs show it). */
  readonly group: string
  /** Index of the page, from 0. */
  readonly page: number
  /** Index in the group of the first item on the table, and how many the group has. */
  readonly first: number
  readonly total: number
  readonly objects: readonly TestTableObject[]
  /** The object the trials hit (the first one until another is picked). */
  readonly selected: string | null
  readonly hasPrev: boolean
  readonly hasNext: boolean
}

/** The test table of the room: lays a group of the catalogue on the table a page at a time, picks one object and runs the trials on it. */
export interface TestTable {
  /** The groups of the catalogue that can be laid (every group with items). */
  groups(): string[]
  /** Every item that can be laid, with its group (what a search looks in). */
  items(): Array<{ id: string; name: string; group: string }>
  /** Clears the room and lays page `page` (default 0) of `group`; null when the room has no table or the group no items. */
  open(group: string, page?: number): TestTablePage | null
  next(): TestTablePage | null
  prev(): TestTablePage | null
  /** Lays the page of the group that holds `itemId` and picks it; null when no group has it (or the room has no table). */
  find(itemId: string): TestTablePage | null
  /** Puts the table and the page back as they were before the trials: everything is restored and laid again. */
  relay(): TestTablePage | null
  state(): TestTablePage | null
  /** Picks the object the trials hit; false when it is not on the table. */
  select(objectId: string): boolean
  /** Runs a trial on the picked object (or on `objectId`): the room equips the tool, puts the player in front of it, aims and uses it. False when there is nothing to hit. */
  trial(kind: TrialKind, objectId?: string): boolean
  /** Follow the table: a page laid, an object picked, a trial run. Returns the unsubscribe function. */
  on(listener: (page: TestTablePage | null) => void): () => void
}

export const resolveTrials = (overrides: TestTableOptions['trials'] = {}): Record<TrialKind, TrialTool> =>
  Object.fromEntries(TRIAL_KINDS.map((kind) => [kind, { ...DEFAULT_TRIALS[kind], ...overrides[kind] }])) as Record<TrialKind, TrialTool>

/**
 * How many items, from `start`, fit side by side along a table of `length` metres with `gap` between them (`width(i)` is the width of item i). At least one, so an item longer
 * than the table still gets a page of its own. Pure.
 */
export function fitRow(width: (index: number) => number, start: number, total: number, length: number, gap: number): number {
  let used = 0
  let count = 0
  for (let i = start; i < total; i++) {
    const w = width(i)
    const next = count === 0 ? w : used + gap + w
    if (count > 0 && next > length) break
    used = next
    count++
  }
  return count
}

/** The x of the centre of each item of a row laid side by side, centred on `centreX`, with `gap` between them. Pure. */
export function rowCentres(widths: readonly number[], centreX: number, gap: number): number[] {
  const length = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1)
  let x = centreX - length / 2
  return widths.map((w) => {
    const centre = x + w / 2
    x += w + gap
    return centre
  })
}

/**
 * Where the player's eye goes for a trial on an object whose box is `min`..`max` (world), and where it looks. The player comes from +z (the side of the room the table faces),
 * so a melee blow lands on the front face. A blast is watched from `watch` metres. Pure.
 */
export function trialView(tool: TrialTool, kind: TrialKind, min: Vec3, max: Vec3): { eye: Vec3; target: Vec3 } {
  const target: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const away = kind === 'blast' ? (tool.watch ?? 6) : tool.distance
  return { eye: [target[0], target[1] + tool.lift, max[2] + away], target }
}

/** What the test table needs of the room. */
export interface TestTableContext {
  /** The catalogue by group: the ids and names of the items of each one. */
  readonly groups: () => ReadonlyMap<string, ReadonlyArray<{ readonly id: string; readonly name: string }>>
  /** The top of the table in the world (null: the room has no such piece, or its top is broken). */
  readonly top: () => { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; readonly top: number } | null
  /** Width (x) and depth (z) of an item's model at rotation 0, metres. */
  readonly measure: (itemId: string) => { readonly w: number; readonly d: number }
  readonly spawn: (itemId: string, position: Vec3) => { readonly objectId: string }
  readonly clear: () => void
  readonly resetAll: () => void
  /** The world box of an object still in the room, else null. */
  readonly box: (objectId: string) => { readonly min: Vec3; readonly max: Vec3 } | null
  /** Puts the tool in hand (added to the hotbar) and waits for its draw. False for an id the arsenal does not have. */
  readonly equip: (weapon: string) => boolean
  readonly look: (eye: Vec3, target: Vec3) => void
  readonly use: (hold: number) => void
  /** Sets off the explosive of `weapon` at `point`. False when the weapon throws or places no explosive. */
  readonly blastAt: (weapon: string, point: Vec3) => boolean
  readonly log: (type: string, text: string, data: Record<string, unknown>) => void
  readonly translate: (key: string, vars?: Record<string, string | number>) => string
}

/** The test table over a room (see `TestTable`). */
export function createTestTable(context: TestTableContext, options: TestTableOptions = {}): TestTable {
  const gap = options.gap ?? 0.12
  const margin = options.margin ?? 0.1
  const trials = resolveTrials(options.trials)
  const listeners = new Set<(page: TestTablePage | null) => void>()
  let current: { group: string; page: number; first: number; objects: TestTableObject[]; selected: string | null } | null = null

  const itemsOf = (group: string) => context.groups().get(group) ?? []
  const emit = (): TestTablePage | null => {
    const page = state()
    for (const listener of [...listeners]) listener(page)
    return page
  }
  const state = (): TestTablePage | null => {
    if (!current) return null
    const total = itemsOf(current.group).length
    const live = current.objects.filter((o) => context.box(o.objectId))
    return {
      group: current.group,
      page: current.page,
      first: current.first,
      total,
      objects: live,
      selected: current.selected,
      hasPrev: current.page > 0,
      hasNext: current.first + current.objects.length < total,
    }
  }

  // the bounds of each page of each group: page n is [bounds[n], bounds[n + 1]), found one after the other (a page holds what fits on the table), up to the group's length
  const bounds = new Map<string, number[]>()
  const widthOf = (itemId: string): number => context.measure(itemId).w
  /** The bounds of `group` known at least up to the page that holds item `index` (or page `page`). */
  const boundsUntil = (group: string, length: number, until: (bound: number[]) => boolean): number[] => {
    const items = itemsOf(group)
    const known = bounds.get(group) ?? [0]
    bounds.set(group, known)
    while (known[known.length - 1] < items.length && !until(known)) {
      const first = known[known.length - 1]
      known.push(first + fitRow((i) => widthOf(items[i].id), first, items.length, length, gap))
    }
    return known
  }
  const lengthOf = (top: NonNullable<ReturnType<TestTableContext['top']>>): number => top.maxX - top.minX - 2 * margin

  const lay = (group: string, page: number, top: NonNullable<ReturnType<TestTableContext['top']>>): TestTablePage | null => {
    const items = itemsOf(group)
    const known = boundsUntil(group, lengthOf(top), (b) => b.length > page + 1)
    const index = Math.max(0, Math.min(page, known.length - 2))
    const first = known[index]
    const laid = items.slice(first, known[index + 1])
    context.clear()
    const sizes = laid.map((item) => context.measure(item.id))
    const centres = rowCentres(sizes.map((size) => size.w), (top.minX + top.maxX) / 2, gap)
    // along the front edge of the table (the player's side), so a blow from in front reaches each one
    const objects = laid.map((item, i) => {
      const d = Math.min(sizes[i].d, top.maxZ - top.minZ)
      const { objectId } = context.spawn(item.id, [centres[i], top.top, top.maxZ - margin / 2 - d / 2])
      return { objectId, itemId: item.id, name: item.name }
    })
    current = { group, page: index, first, objects, selected: objects[0]?.objectId ?? null }
    context.log('test_table', context.translate('act.test_table', { group, from: first + 1, to: first + laid.length, total: items.length }), { group, page: index, items: laid.map((i) => i.id) })
    return emit()
  }

  const open = (group: string, page = 0): TestTablePage | null => {
    const top = context.top()
    if (!itemsOf(group).length || !top) return null
    return lay(group, page, top)
  }

  const find = (itemId: string): TestTablePage | null => {
    const top = context.top()
    const group = [...context.groups()].find(([, items]) => items.some((i) => i.id === itemId))?.[0]
    if (group === undefined || !top) return null
    const index = itemsOf(group).findIndex((i) => i.id === itemId)
    // only the widths are measured on the way: nothing is laid until the page that holds the item
    const known = boundsUntil(group, lengthOf(top), (b) => b[b.length - 1] > index)
    lay(group, known.findIndex((bound, i) => bound <= index && index < known[i + 1]), top)
    const target = current?.objects.find((o) => o.itemId === itemId)
    if (current && target) current.selected = target.objectId
    return emit()
  }

  const selected = (objectId?: string): string | null => {
    const id = objectId ?? current?.selected ?? null
    return id && context.box(id) ? id : null
  }

  const trial = (kind: TrialKind, objectId?: string): boolean => {
    const id = selected(objectId)
    const box = id ? context.box(id) : null
    if (!id || !box) return false
    const tool = trials[kind]
    if (!context.equip(tool.weapon)) return false
    const view = trialView(tool, kind, box.min, box.max)
    context.look(view.eye, view.target)
    const name = current?.objects.find((o) => o.objectId === id)?.name ?? id
    context.log('trial', context.translate(`act.trial.${kind}`, { name }), { kind, objectId: id, weapon: tool.weapon })
    if (kind === 'blast') {
      const point: Vec3 = [view.target[0], box.min[1] + 0.05, box.min[2] - tool.distance]
      return context.blastAt(tool.weapon, point)
    }
    context.use(tool.hold ?? 0)
    emit()
    return true
  }

  return {
    groups: () => [...context.groups()].filter(([, items]) => items.length > 0).map(([group]) => group),
    items: () => [...context.groups()].flatMap(([group, items]) => items.map((item) => ({ id: item.id, name: item.name, group }))),
    open,
    find,
    next: () => {
      const page = state()
      return page?.hasNext ? open(page.group, page.page + 1) : page
    },
    prev: () => {
      const page = state()
      return page?.hasPrev ? open(page.group, page.page - 1) : page
    },
    relay: () => {
      if (!current) return null
      context.resetAll()
      return open(current.group, current.page)
    },
    state,
    select: (objectId) => {
      if (!current || !current.objects.some((o) => o.objectId === objectId) || !context.box(objectId)) return false
      current.selected = objectId
      emit()
      return true
    },
    trial,
    on: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
