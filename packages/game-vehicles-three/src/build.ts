import { markKitOrigin } from '@adatechnology/game-contracts'
import type { Damageable, VehicleContext, VehicleKit } from '@adatechnology/game-vehicles'
import type * as THREE_NS from 'three'
import type { Group, Material, Mesh, MeshStandardMaterial, Object3D } from 'three'

import { colorFromSeed as defaultColorFromSeed, fleetDims as defaultFleetDims, paintPalettes as defaultPaintPalettes, paletteOf as defaultPaletteOf } from '@adatechnology/game-vehicles-fleet'

import { fuse, liteMaterials, liteMeshes } from './lite'

export type VehicleQuality = 'high' | 'lite'

/** The measured size of a fleet vehicle in metres (the shape of `FleetDims` of `game-vehicles-fleet`). */
export interface FleetDims {
  length: number
  width: number
  height: number
}

/**
 * The fleet content the builder reads: the paint palettes, the size the team measured and the colour a seed picks. It is the shape of what
 * `game-vehicles-fleet` exports (`defaultVehicleFleet()` of `game-kit-defaults` hands it over), so this adapter imports no content.
 */
export interface VehicleFleetContent {
  readonly paintPalettes: { readonly civil: unknown; readonly military: unknown }
  paletteOf(group: string): unknown
  colorFromSeed(seed: number | string, palette: unknown): string
  fleetDims(id: string): FleetDims | undefined
}

export interface BuildVehicleOptions {
  /** `high`: the kit's vehicle at full detail. `lite`: fused into six meshes. Default `high`. */
  quality?: VehicleQuality
  /** Body colour as a CSS colour. Wins over `seed`. */
  color?: string
  /** Picks the body colour from the palette of the vehicle's group. */
  seed?: number | string
  /** State of the vehicle. Default `intact`. */
  state?: 'intact' | 'damaged' | 'modified'
}

export interface BuiltVehicle {
  key: string
  quality: VehicleQuality
  /** The colour the body ended up with, or null when the vehicle keeps its own paint. */
  color: string | null
  seed: number | string | null
  /** Group in the game frame: front on +z, right on -x, centred on x and z, wheels on y = 0. */
  group: Group
  /** Damageable boxes in the game frame. */
  damageables: Damageable[]
  triangles: number
  drawCalls: number
  /** Measured size of the group in metres: length along z, width along x, height along y. */
  length: number
  width: number
  height: number
  /** Pieces dropped for being smaller than 3 cm (lite only). */
  pruned: number
  /** The measured size the team recorded for this vehicle, when the fleet knows it. */
  expected: FleetDims | undefined
  /** The kit's context, for damage and animation (full detail only). */
  context: VehicleContext | null
  /**
   * The driver's eyes in the group frame: over the front seat on the driver's side (+x, left-hand drive), a seated person's eye height above the cushion.
   * Null when the vehicle has no seats drawn (lite detail, a boat deck).
   */
  driverEye: [number, number, number] | null
  dispose(): void
}

export interface VehiclesThree {
  readonly THREE: typeof THREE_NS
  readonly kit: VehicleKit
  build(key: string, options?: BuildVehicleOptions): BuiltVehicle
}

export interface VehiclesThreeOptions {
  kit: VehicleKit
  /**
   * The fleet's palettes and measured sizes (`defaultVehicleFleet()` of `game-kit-defaults`, or the game's own). Default the ones of `game-vehicles-fleet`.
   * @deprecated pass `fleet`; the default is removed in the next major.
   */
  fleet?: VehicleFleetContent
  /** Vehicle id to the group id whose palette paints it. Defaults to the fleet group of the vehicle (`military` for the military ones). */
  groupOf?: (key: string) => string
}

/** Triangles and draw calls of the visible meshes of an object (a multi-material mesh costs one call per group). */
function count(root: Object3D): { triangles: number; drawCalls: number } {
  let triangles = 0
  let drawCalls = 0
  root.traverse((node) => {
    const o = node as Mesh
    if (!o.isMesh || !o.geometry) return
    for (let p: Object3D | null = o; p; p = p.parent) if (p.visible === false) return
    const g = o.geometry
    const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0
    if (Array.isArray(o.material) && g.groups.length) drawCalls += g.groups.length
    else drawCalls++
    triangles += n / 3
  })
  return { triangles: Math.round(triangles), drawCalls }
}

/** The material most triangles are painted with: the body colour. */
export function primaryPaint(c: { vehicle: Object3D; paints: ReadonlySet<Material> }): MeshStandardMaterial | null {
  let best: MeshStandardMaterial | null = null
  let bestCount = -1
  const counts = new Map<Material, number>()
  c.vehicle.traverse((node) => {
    const o = node as Mesh
    if (!o.isMesh || !o.geometry) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const g = o.geometry
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3
    for (const m of mats) if (c.paints.has(m)) counts.set(m, (counts.get(m) || 0) + n)
  })
  counts.forEach((n, m) => {
    if (n > bestCount) {
      bestCount = n
      best = m as MeshStandardMaterial
    }
  })
  return best
}

/**
 * Builds vehicles in a game frame. Port of `FrotaLeve.criar(...).construir` (frota-leve.js 14311-14442): the kit builds with +x to the front
 * and +z to the right; the game wants +z to the front and -x to the right, the vehicle centred on x and z and standing on y = 0.
 */
/** Eyes of a seated driver over the top of the seat cushion and behind its centre, metres: the cushion gives under the body and the hips sit at its back. */
const SEATED_EYE = { up: 0.55, back: 0.28 }

/** The driver's eyes in the group frame (the group sits at the origin while it is built): the frontmost seat, on the driver's side. */
type Point = { x: number; y: number; z: number }
function eyeOf(THREE: { Vector3: new (x: number, y: number, z: number) => Point }, c: { seatTops?: Point[]; vehicle: { localToWorld(v: Point): Point } }): [number, number, number] | null {
  const tops = c.seatTops ?? []
  if (!tops.length) return null
  const points = tops.map((t) => c.vehicle.localToWorld(new THREE.Vector3(t.x, t.y, t.z)))
  const front = Math.max(...points.map((p) => p.z))
  const row = points.filter((p) => p.z > front - 0.25)
  const seat = row.reduce((a, b) => (b.x > a.x ? b : a))
  return [+seat.x.toFixed(3), +(seat.y + SEATED_EYE.up).toFixed(3), +(seat.z - SEATED_EYE.back).toFixed(3)]
}

export function createVehiclesThree(THREE: typeof THREE_NS, options: VehiclesThreeOptions): VehiclesThree {
  const kit = options.kit
  const fleet: VehicleFleetContent = options.fleet ?? { colorFromSeed: defaultColorFromSeed, fleetDims: defaultFleetDims, paintPalettes: defaultPaintPalettes, paletteOf: defaultPaletteOf }
  const { colorFromSeed, fleetDims, paintPalettes, paletteOf } = fleet
  const groupOf = options.groupOf || ((key: string) => (kit.find(key)?.group === kit.config.defaultGroup ? 'cars' : String(kit.find(key)?.group)))
  const militaryKeys = new Set<string>()
  const isMilitary = (key: string): boolean => militaryKeys.has(key) || paletteOf(groupOf(key)) === paintPalettes.military

  const build = (key: string, o: BuildVehicleOptions = {}): BuiltVehicle => {
    const quality: VehicleQuality = o.quality === 'lite' ? 'lite' : 'high'
    const spec = kit.find(key)
    if (!spec) throw new Error(`createVehiclesThree: unknown vehicle "${key}"`)
    const seed = o.seed == null ? null : o.seed
    const color = o.color || (seed != null ? colorFromSeed(seed, isMilitary(key) ? paintPalettes.military : paintPalettes.civil) : null)
    const c = kit.build(key, o.state || 'intact', undefined, { lod: quality === 'lite' })
    c.root.updateMatrixWorld(true)
    const primary = primaryPaint(c)
    const rotation = new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    const bounds = new THREE.Box3()
    const piece = new THREE.Box3()
    const turned = new THREE.Matrix4()
    c.vehicle.traverse((node: Object3D) => {
      const m = node as Mesh
      if (!m.isMesh || !m.geometry || m.userData.ghost) return
      for (let p: Object3D | null = m; p; p = p.parent) if (p.visible === false) return
      m.geometry.computeBoundingBox()
      piece.copy(m.geometry.boundingBox!).applyMatrix4(turned.multiplyMatrices(rotation, m.matrixWorld))
      bounds.union(piece)
    })
    const cx = (bounds.min.x + bounds.max.x) / 2
    const cz = (bounds.min.z + bounds.max.z) / 2
    const pivotMatrix = new THREE.Matrix4().makeTranslation(-cx, -bounds.min.y, -cz).multiply(rotation)
    const group = new THREE.Group()
    group.name = `vehicle:${key}`
    markKitOrigin(group, { owner: 'game-vehicles-three', kind: 'vehicle', id: key })
    const damageables = kit.damageables(c, pivotMatrix)
    let pruned = 0
    let driverEye: [number, number, number] | null = null
    if (quality === 'high') {
      const pivot = new THREE.Group()
      pivot.name = 'vehicle'
      pivot.matrixAutoUpdate = false
      pivot.matrix.copy(pivotMatrix)
      pivot.matrixWorldNeedsUpdate = true
      c.vehicle.matrixAutoUpdate = true
      pivot.add(c.vehicle)
      group.add(pivot)
      // the kit refreshes the matrices of what it deforms from c.root: it has to be the group that now carries the vehicle
      c.root = group
      if (color && primary) {
        const repainted = primary.clone()
        repainted.color.set(color)
        c.vehicle.traverse((node: Object3D) => {
          const m = node as Mesh
          if (!m.isMesh) return
          if (Array.isArray(m.material)) m.material = m.material.map((x) => (x === primary ? repainted : x))
          else if (m.material === primary) m.material = repainted
        })
      }
      markDamageables(c, damageables)
      group.updateMatrixWorld(true)
      driverEye = eyeOf(THREE, c)
    } else {
      const fusion = fuse(THREE, c, pivotMatrix, color ? new THREE.Color(color) : null, primary, kit.lodHiddenMaterials())
      for (const mesh of liteMeshes(THREE, fusion, liteMaterials(THREE, kit.studioEnvironment()))) group.add(mesh)
      pruned = fusion.pruned
    }
    const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
    const counted = count(group)
    group.userData.damageables = damageables
    group.userData.key = key
    group.userData.quality = quality
    return {
      key,
      quality,
      color,
      seed,
      group,
      damageables,
      triangles: counted.triangles,
      drawCalls: counted.drawCalls,
      length: +size.z.toFixed(3),
      width: +size.x.toFixed(3),
      height: +size.y.toFixed(3),
      pruned,
      expected: fleetDims(key),
      context: quality === 'high' ? c : null,
      driverEye,
      dispose() {
        group.traverse((node) => {
          const m = node as Mesh
          if (m.geometry) m.geometry.dispose()
        })
      },
    }
  }

  return { THREE, kit, build }
}

/** Tags the meshes of each damageable zone (and the tyres) so a hit test can tell what it hit. */
function markDamageables(c: VehicleContext, damageables: Damageable[]): void {
  const byZone: Record<string, Damageable> = {}
  for (const d of damageables) byZone[d.zone] = d
  for (const z of c.zones || []) {
    const d = byZone[z.id]
    if (!d) continue
    for (const o of z.objs || z.meshes || []) if (o && o.userData) o.userData.damageable = { material: d.material, zone: d.zone }
  }
  for (const w of c.wheels || []) {
    const z = (c.zones || []).find((zz) => zz.type === 'wheel' && zz.objs && zz.objs.indexOf(w) >= 0)
    w.userData.damageable = { material: 'rubber', zone: z ? z.id : 'wheel' }
  }
}
