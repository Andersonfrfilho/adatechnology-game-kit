import type * as THREE_NS from 'three'
import data from '../data/models.json'
import { buildBreakAction } from './break-action'
import { buildBullpup } from './bullpup'
import { modelKit } from './kit'
import type { ModelKit } from './kit'
import { buildLauncher } from './launcher'
import { buildM2 } from './m2'
import { buildP90 } from './p90'
import { partRegistry } from './part-registry'
import { buildPistol } from './pistol'
import { buildRevolver } from './revolver'
import { buildRifle } from './rifle'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

export type { ModelFamily, ModelOptions, ModelParts } from './types'

/** One weapon of the gallery as `data/models.json` keeps it: the builder, the measures in mm and the builder's options. */
export interface ModelEntry {
  readonly builder: 'pistol' | 'revolver' | 'rifle' | 'bullpup' | 'p90' | 'break' | 'm2' | 'launcher'
  readonly caliber: string
  readonly length: number
  readonly barrel: number
  readonly options: ModelOptions
  readonly variantOf?: string
}

export const MODEL_ENTRIES: Readonly<Record<string, ModelEntry>> = data as Record<string, ModelEntry>

/** A weapon model: `root` (the page's `wr`) holds `inner` (what the builder made, fitted to the real length); `parts` are pivots and marks inside `inner`. */
export interface WeaponModel {
  readonly id: string
  readonly root: THREE_NS.Group
  readonly inner: THREE_NS.Group
  readonly parts: ModelParts
}

const BUILDERS: Record<ModelEntry['builder'], (kit: ModelKit, options: ModelOptions) => BuiltModel> = {
  pistol: buildPistol,
  revolver: buildRevolver,
  rifle: buildRifle,
  bullpup: buildBullpup,
  p90: (kit) => buildP90(kit),
  break: buildBreakAction,
  m2: (kit) => buildM2(kit),
  launcher: buildLauncher,
}

const nameParts = (parts: ModelParts): void => {
  for (const [name, part] of partRegistry(parts)) part.name = name
}

/** Stretches the model along x to the real length of the weapon (the page's `fitLength`) and puts its rear at the origin. */
const fitLength = (kit: ModelKit, inner: THREE_NS.Group, lengthMetres: number): THREE_NS.Group => {
  const box = new kit.THREE.Box3().setFromObject(inner)
  const factor = lengthMetres / (box.max.x - box.min.x)
  inner.scale.x = factor
  inner.position.x = -box.min.x * factor
  const root = kit.group()
  root.add(inner)
  return root
}

export const hasWeaponModel = (id: string): boolean => id in MODEL_ENTRIES

/** The gallery model of a weapon, long axis along +x, rear at the origin; undefined when the gallery has none (the generic archetypes, melee, throwables). */
export function buildWeaponModelById(THREE: typeof THREE_NS, id: string): WeaponModel | undefined {
  const entry = MODEL_ENTRIES[id]
  if (!entry) return undefined
  const kit = modelKit(THREE)
  const options: ModelOptions = { L: entry.length, B: entry.barrel, cal: entry.caliber, ...entry.options }
  const built = BUILDERS[entry.builder](kit, options)
  nameParts(built.parts)
  let root: THREE_NS.Group
  if (entry.builder === 'launcher') {
    root = kit.group()
    root.add(built.group)
    built.group.position.x = -new THREE.Box3().setFromObject(built.group).min.x
  } else root = fitLength(kit, built.group, entry.length / 1000)
  root.name = id
  return { id, root, inner: built.group, parts: built.parts }
}
