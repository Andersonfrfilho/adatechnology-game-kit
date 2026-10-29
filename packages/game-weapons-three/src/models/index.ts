import { markKitOrigin } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'
import { WEAPONS } from '@adatechnology/game-weapons'
import data from '../data/models.json'
import { buildBreakAction } from './break-action'
import { deriveFrames } from './attachments/mount-frames'
import { buildBullpup } from './bullpup'
import { modelKit } from './kit'
import type { ModelKit } from './kit'
import { buildLauncher } from './launcher'
import { buildM134 } from './m134'
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
  readonly builder: 'pistol' | 'revolver' | 'rifle' | 'bullpup' | 'p90' | 'break' | 'm2' | 'm134' | 'launcher'
  readonly caliber: string
  readonly length: number
  readonly barrel: number
  readonly options: ModelOptions
  readonly variantOf?: string
}

export const MODEL_ENTRIES: Readonly<Record<string, ModelEntry>> = data as Record<string, ModelEntry>

/**
 * The model each generic archetype wears: the one of the first brand weapon (lowest id) that points to it with `archetype` and fires the same way (a rocket launcher that points to
 * `shotgun_pump_12` does not lend its tube to the shotgun). An archetype nothing points to, the melee weapons and the bow keep their simple prop.
 */
export const ARCHETYPE_MODELS: Readonly<Record<string, string>> = (() => {
  const actionOf = new Map(WEAPONS.map((def) => [def.id, def.action.kind]))
  const chosen: Record<string, string> = {}
  for (const def of [...WEAPONS].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const { archetype } = def
    if (!archetype || !(def.id in MODEL_ENTRIES) || archetype in MODEL_ENTRIES || archetype in chosen) continue
    if (actionOf.get(archetype) === def.action.kind) chosen[archetype] = def.id
  }
  return chosen
})()

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
  m134: (kit) => buildM134(kit),
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

export const hasWeaponModel = (id: string): boolean => id in MODEL_ENTRIES || id in ARCHETYPE_MODELS

/** The gallery model of a weapon (or of the brand weapon an archetype wears, see `ARCHETYPE_MODELS`), long axis along +x, rear at the origin; undefined for melee, throwables and what nothing drew. */
export function buildWeaponModelById(THREE: typeof THREE_NS, id: string): WeaponModel | undefined {
  const entry = MODEL_ENTRIES[ARCHETYPE_MODELS[id] ?? id]
  if (!entry) return undefined
  const kit = modelKit(THREE)
  const options: ModelOptions = { L: entry.length, B: entry.barrel, cal: entry.caliber, ...entry.options }
  if (id in ARCHETYPE_MODELS) delete options.chambers // a generic weapon holds the default six, not the brand's capacity
  const built = BUILDERS[entry.builder](kit, options)
  nameParts(built.parts)
  let root: THREE_NS.Group
  if (entry.builder === 'launcher') {
    root = kit.group()
    root.add(built.group)
    built.group.position.x = -new THREE.Box3().setFromObject(built.group).min.x
  } else root = fitLength(kit, built.group, entry.length / 1000)
  root.name = id
  markKitOrigin(root, { owner: 'game-weapons-three', kind: 'weapon', id })
  const model: WeaponModel = { id, root, inner: built.group, parts: built.parts }
  if (!built.parts.frames) built.parts.frames = deriveFrames(THREE, model)
  return model
}
