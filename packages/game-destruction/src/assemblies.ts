import { applyPatches, mergeById, removeIds } from '@adatechnology/game-contracts'
import type { DeepPartial } from '@adatechnology/game-contracts'

import assembliesJson from './data/assemblies.json'
import { MATERIALS } from './materials'
import type { MaterialDef, MaterialId, PartBreach, PartSpec, PartUnits, Reinforcement, SurfaceLayer, Vec3 } from './types'

/**
 * A wall as a builder builds it: a core with coats, the masonry unit it is laid in, its rebar and when it breaches. Dimensions are metres (data in
 * `src/data/assemblies.json`); `assemblyPart` turns one into a `PartSpec`. Extend or override with `registerAssembly`.
 */
export interface AssemblyDef {
  id: string
  name: string
  /** `thickness` is the core's, in metres: what a bullet has to get through besides the coats. */
  core: { material: MaterialId; thickness: number }
  /** Coats, outermost first. */
  layers?: readonly SurfaceLayer[]
  /** Physical depth of the wall when it is not core plus coats (a drywall partition is mostly air between the boards). */
  depth?: number
  /** Solid fraction of the core (hollow blocks, round logs): scales its mass and the thickness a bullet crosses. Default 1. */
  fill?: number
  units?: PartUnits
  reinforcement?: Reinforcement
  breach?: PartBreach
}

export interface AssemblyPartOptions {
  id: string
  /** Along the part's x axis. */
  width: number
  /** Along the part's y axis. */
  height: number
  position: Vec3
  rotation?: Vec3
  structure?: PartSpec['structure']
  /** Other `PartSpec` fields (tags, anchored, hp...). */
  extra?: Partial<PartSpec>
  /** Materials to read densities from (default the built-in `MATERIALS`). */
  materials?: ReadonlyMap<MaterialId, MaterialDef>
}

// What the JSON held at load, before any `registerAssembly` changed the shared list.
const SHIPPED: readonly AssemblyDef[] = structuredClone(assembliesJson as unknown as AssemblyDef[])

/**
 * Built-in assemblies; `registerAssembly` adds to this list.
 * @deprecated the list every page shares. Use `createAssemblies({ packs, patch, remove })`, or `defaultAssemblies()` for this one.
 */
export const ASSEMBLIES: AssemblyDef[] = assembliesJson as unknown as AssemblyDef[]

export interface AssembliesOptions {
  /** Assemblies added to the built-in ones; one with the id of a built-in replaces it. */
  readonly packs?: readonly (readonly AssemblyDef[])[]
  /** Changes by id, merged field by field over what is there. */
  readonly patch?: Readonly<Record<string, DeepPartial<AssemblyDef>>>
  /** Ids taken out. */
  readonly remove?: readonly string[]
}

export interface Assemblies {
  list(): readonly AssemblyDef[]
  get(id: string): AssemblyDef | undefined
  /** Adds an assembly, or replaces the one with the same id. */
  register(def: AssemblyDef): void
  /** The wall as a `PartSpec`; throws for an id this set does not have. */
  part(assemblyId: string, options: AssemblyPartOptions): PartSpec
}

const assembliesOver = (defs: AssemblyDef[]): Assemblies => {
  const get = (id: string): AssemblyDef | undefined => defs.find((a) => a.id === id)
  return {
    list: () => defs,
    get,
    register(def) {
      const at = defs.findIndex((a) => a.id === def.id)
      if (at >= 0) defs[at] = def
      else defs.push(def)
    },
    part: (assemblyId, options) => buildAssemblyPart(get(assemblyId), assemblyId, options),
  }
}

/** A set of assemblies of its own: the built-in ones (copied) plus `packs`, `patch` and `remove`. Nothing is shared with any other set on the page. */
export const createAssemblies = (options: AssembliesOptions = {}): Assemblies => {
  const entries = mergeById(SHIPPED.map((def) => structuredClone(def)), (options.packs ?? []).flat())
  applyPatches(entries, options.patch)
  removeIds(entries, options.remove)
  return assembliesOver([...entries.values()])
}

let defaultSet: Assemblies | undefined

/** The set behind `ASSEMBLIES`, `registerAssembly`, `getAssembly` and `assemblyPart`, created on first use. */
export const defaultAssemblies = (): Assemblies => (defaultSet ??= assembliesOver(ASSEMBLIES))

/** @deprecated use `createAssemblies(...).register`. */
export const registerAssembly = (def: AssemblyDef): void => defaultAssemblies().register(def)

/** @deprecated use `createAssemblies(...).get`. */
export const getAssembly = (id: string): AssemblyDef | undefined => defaultAssemblies().get(id)

const faceCount = (layer: SurfaceLayer): number => (layer.faces === 'both' ? 2 : 1)

/** Physical depth of the wall in metres. */
export const assemblyDepth = (def: AssemblyDef): number => def.depth ?? def.core.thickness + (def.layers ?? []).reduce((sum, l) => sum + l.thickness * faceCount(l), 0)

/**
 * The wall as a box `[width, height, depth]` (thin along local z) with the assembly's layers, units, rebar and breach. Mass is the core (times `fill`)
 * plus the coats; `thickness` is the core's, so each coat adds its own `penetration x thickness` to what a bullet must cross.
 */
const buildAssemblyPart = (def: AssemblyDef | undefined, assemblyId: string, options: AssemblyPartOptions): PartSpec => {
  if (!def) throw new Error(`unknown assembly "${assemblyId}"`)
  const densityOf = (id: MaterialId): number => {
    const m = options.materials?.get(id) ?? MATERIALS.find((x) => x.id === id)
    if (!m) throw new Error(`unknown material "${id}" in assembly "${assemblyId}"`)
    return m.density
  }
  const fill = def.fill ?? 1
  const area = options.width * options.height
  const coreMass = area * def.core.thickness * fill * densityOf(def.core.material)
  const layerMass = (def.layers ?? []).reduce((sum, l) => sum + area * l.thickness * faceCount(l) * densityOf(l.material), 0)
  return {
    id: options.id,
    material: def.core.material,
    shape: { kind: 'box', size: [options.width, options.height, assemblyDepth(def)] },
    position: options.position,
    ...(options.rotation ? { rotation: options.rotation } : {}),
    mass: coreMass + layerMass,
    thickness: def.core.thickness * fill,
    ...(def.layers ? { layers: def.layers.map((l) => ({ ...l })) } : {}),
    ...(def.units ? { units: { ...def.units, size: [...def.units.size] as Vec3 } } : {}),
    ...(def.reinforcement ? { reinforcement: { ...def.reinforcement } } : {}),
    ...(def.breach ? { breach: { ...def.breach } } : {}),
    ...(options.structure ? { structure: options.structure } : {}),
    ...options.extra,
  }
}

/** @deprecated use `createAssemblies(...).part`. */
export const assemblyPart = (assemblyId: string, options: AssemblyPartOptions): PartSpec => defaultAssemblies().part(assemblyId, options)
