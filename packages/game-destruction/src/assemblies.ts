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

/** Built-in assemblies; `registerAssembly` adds to this list. */
export const ASSEMBLIES: AssemblyDef[] = assembliesJson as unknown as AssemblyDef[]

export const registerAssembly = (def: AssemblyDef): void => {
  const at = ASSEMBLIES.findIndex((a) => a.id === def.id)
  if (at >= 0) ASSEMBLIES[at] = def
  else ASSEMBLIES.push(def)
}

export const getAssembly = (id: string): AssemblyDef | undefined => ASSEMBLIES.find((a) => a.id === id)

const faceCount = (layer: SurfaceLayer): number => (layer.faces === 'both' ? 2 : 1)

/** Physical depth of the wall in metres. */
export const assemblyDepth = (def: AssemblyDef): number => def.depth ?? def.core.thickness + (def.layers ?? []).reduce((sum, l) => sum + l.thickness * faceCount(l), 0)

/**
 * The wall as a box `[width, height, depth]` (thin along local z) with the assembly's layers, units, rebar and breach. Mass is the core (times `fill`)
 * plus the coats; `thickness` is the core's, so each coat adds its own `penetration x thickness` to what a bullet must cross.
 */
export const assemblyPart = (assemblyId: string, options: AssemblyPartOptions): PartSpec => {
  const def = getAssembly(assemblyId)
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
