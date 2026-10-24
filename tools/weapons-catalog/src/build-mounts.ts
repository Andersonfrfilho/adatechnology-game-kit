import type { Decision, Decisions, StockKind } from './decisions'
import type { WeaponRecord } from './build-firearms'
import type { ModelRecord } from './build-models'

type DataSourceId = 'gallery' | 'arsenal' | 'game' | 'lab' | 'sdk' | 'reference' | 'derived'
type MountRecord = { readonly kind: string; readonly interfaces: readonly string[]; readonly sources: readonly DataSourceId[] }
type FittedRecord = { readonly id: string; readonly mount: string; readonly integral?: true }
type StockRecord = { readonly kind: StockKind; readonly foldAxis?: string }

export type WeaponMounts = {
  readonly mounts: readonly MountRecord[]
  readonly fitted: readonly FittedRecord[]
  readonly stock?: StockRecord
  readonly lengthCollapsed?: number
}

const MOUNT_ORDER = ['muzzle', 'rail_top', 'rail_left', 'rail_right', 'rail_bottom', 'underbarrel', 'magazine', 'stock', 'barrel', 'sling', 'feed'] as const
const SCOPES: Readonly<Record<number, string>> = { 1: 'red_dot', 2: 'acog_4x', 3: 'scope_3_9x', 4: 'scope_6_24x' }
const BRAKES: Readonly<Record<number, string>> = { 1: 'muzzle_brake', 2: 'muzzle_brake_heavy' }
const SLUNG_CATEGORIES: ReadonlySet<string> = new Set(['smg', 'rifle', 'carbine', 'sniper', 'dmr', 'hunting', 'machine_gun', 'shotgun'])
const SOURCE_OF: Readonly<Record<string, DataSourceId>> = { arsenal: 'arsenal', reference: 'reference', derived: 'derived', design: 'sdk', gallery: 'gallery' }
const MAGAZINE_FAMILIES: ReadonlySet<string> = new Set(['box', 'curved', 'drum'])

const sourceOf = (decision: Decision<unknown>): DataSourceId => SOURCE_OF[decision.source] ?? 'derived'

/** The places of a weapon, collected by kind with the interfaces each accepts and where that comes from. */
class MountSet {
  private readonly places = new Map<string, { interfaces: Set<string>; sources: Set<DataSourceId> }>()

  add(kind: string, interfaces: readonly string[], source: DataSourceId): void {
    const place = this.places.get(kind) ?? { interfaces: new Set<string>(), sources: new Set<DataSourceId>() }
    for (const name of interfaces) place.interfaces.add(name)
    place.sources.add(source)
    this.places.set(kind, place)
  }

  list(): MountRecord[] {
    return MOUNT_ORDER.filter((kind) => this.places.has(kind)).map((kind) => {
      const place = this.places.get(kind)
      return { kind, interfaces: [...(place?.interfaces ?? [])], sources: [...(place?.sources ?? [])] }
    })
  }
}

const stockOf = (id: string, model: ModelRecord, decisions: Decisions): StockRecord | undefined => {
  const override = decisions.stocks[id]?.value
  const galleryKind = model.options.stock === 'fold' || model.options.stock === 'retract' ? model.options.stock : undefined
  const kind = override?.kind ?? galleryKind
  if (kind === undefined || kind === 'fixed' || kind === 'none') return undefined
  const needsAxis = kind === 'fold' || kind === 'fold_retract'
  if (needsAxis && override?.foldAxis === undefined) throw new Error(`weapons-catalog: "${id}" has a folding stock and no foldAxis in decisions.stocks`)
  return { kind, ...(override?.foldAxis === undefined ? {} : { foldAxis: override.foldAxis }) }
}

const addRails = (mounts: MountSet, model: ModelRecord, hasIntegralOptic: boolean): void => {
  const options = model.options
  if (options.rail) mounts.add('rail_top', ['picatinny'], 'gallery')
  else if (options.scope && !hasIntegralOptic) mounts.add('rail_top', ['dovetail'], 'derived')
  if (options.hg === 'rail') for (const kind of ['rail_bottom', 'rail_left', 'rail_right']) mounts.add(kind, ['picatinny'], 'gallery')
  if (model.builder === 'pistol' && options.rail) mounts.add('rail_bottom', ['picatinny'], 'gallery')
}

const addFeeds = (mounts: MountSet, model: ModelRecord, category: string): void => {
  const options = model.options
  const mag = typeof options.mag === 'string' ? options.mag : undefined
  if (mag !== undefined && MAGAZINE_FAMILIES.has(mag)) mounts.add('magazine', [`mag_${mag}`], 'gallery')
  if (model.builder === 'pistol') mounts.add('magazine', ['mag_pistol'], 'derived')
  if (model.builder === 'bullpup' && !options.shot) mounts.add('magazine', ['mag_box'], 'derived')
  if (mag === 'belt' || model.builder === 'm2') mounts.add('feed', ['belt'], 'derived')
  if (SLUNG_CATEGORIES.has(category)) mounts.add('sling', ['swivel'], 'derived')
  if (category === 'shotgun') mounts.add('barrel', ['barrel_swap'], 'derived')
  if (options.bayo) mounts.add('underbarrel', ['gp25'], 'gallery')
}

/** What a weapon can carry and what it already carries, from the options of its Gallery model and the decisions (threads, notes, stocks, integral parts). */
export const buildMounts = (record: WeaponRecord, model: ModelRecord, decisions: Decisions): WeaponMounts => {
  const { id } = record
  const options = model.options
  const mounts = new MountSet()
  const fitted: FittedRecord[] = []
  const thread = decisions.threads[id]
  if (thread) mounts.add('muzzle', [thread.value.interface], sourceOf(thread))
  const brake = typeof options.brake === 'number' ? BRAKES[options.brake] : undefined
  if (brake) {
    if (!thread) mounts.add('muzzle', ['fixed_muzzle_device'], 'derived')
    fitted.push({ id: brake, mount: 'muzzle' })
  }
  const integral = decisions.integral[id]
  const hasIntegralOptic = integral?.value.some((part) => part.mount === 'rail_top') ?? false
  addRails(mounts, model, hasIntegralOptic)
  const scope = typeof options.scope === 'number' ? SCOPES[options.scope] : undefined
  if (scope && !hasIntegralOptic) fitted.push({ id: scope, mount: 'rail_top' })
  if (options.bipod) {
    mounts.add('rail_bottom', ['bipod_stud'], 'gallery')
    fitted.push({ id: 'bipod', mount: 'rail_bottom' })
  }
  addFeeds(mounts, model, String(record.category))
  for (const part of integral?.value ?? []) {
    mounts.add(part.mount, part.interfaces, sourceOf(integral as Decision<unknown>))
    fitted.push({ id: part.id, mount: part.mount, integral: true })
  }
  for (const note of decisions.mountNotes[id]?.value.mounts ?? []) mounts.add(note.kind, note.interfaces, sourceOf(decisions.mountNotes[id] as Decision<unknown>))
  const stock = stockOf(id, model, decisions)
  const collapsed = decisions.stocks[id]?.value.lengthCollapsed
  return { mounts: mounts.list(), fitted, ...(stock ? { stock } : {}), ...(collapsed === undefined ? {} : { lengthCollapsed: collapsed }) }
}
