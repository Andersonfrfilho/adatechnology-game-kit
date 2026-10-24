import type { Damageable, VehicleContext, VehicleKit } from '@adatechnology/game-vehicles'
import { colorFromSeed, fleetDims, paintPalettes, paletteOf } from '@adatechnology/game-vehicles-fleet'
import type { FleetDims } from '@adatechnology/game-vehicles-fleet'

import { fuse, liteMaterials, liteMeshes } from './lite'

export type VehicleQuality = 'high' | 'lite'

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
  group: any
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
  dispose(): void
}

export interface VehiclesThree {
  readonly THREE: any
  readonly kit: VehicleKit
  build(key: string, options?: BuildVehicleOptions): BuiltVehicle
}

export interface VehiclesThreeOptions {
  kit: VehicleKit
  /** Vehicle id to the group id whose palette paints it. Defaults to the fleet group of the vehicle (`military` for the military ones). */
  groupOf?: (key: string) => string
}

/** Triangles and draw calls of the visible meshes of an object (a multi-material mesh costs one call per group). */
function count(root: any): { triangles: number; drawCalls: number } {
  let triangles = 0
  let drawCalls = 0
  root.traverse((o: any) => {
    if (!o.isMesh || !o.geometry) return
    for (let p = o; p; p = p.parent) if (p.visible === false) return
    const g = o.geometry
    const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0
    if (Array.isArray(o.material) && g.groups.length) drawCalls += g.groups.length
    else drawCalls++
    triangles += n / 3
  })
  return { triangles: Math.round(triangles), drawCalls }
}

/** The material most triangles are painted with: the body colour. */
export function primaryPaint(c: any): any {
  let best: any = null
  let bestCount = -1
  const counts = new Map<any, number>()
  c.vehicle.traverse((o: any) => {
    if (!o.isMesh || !o.geometry) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const g = o.geometry
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3
    for (const m of mats) if (c.paints.has(m)) counts.set(m, (counts.get(m) || 0) + n)
  })
  counts.forEach((n, m) => {
    if (n > bestCount) {
      bestCount = n
      best = m
    }
  })
  return best
}

/**
 * Builds vehicles in a game frame. Port of `FrotaLeve.criar(...).construir` (frota-leve.js 14311-14442): the kit builds with +x to the front
 * and +z to the right; the game wants +z to the front and -x to the right, the vehicle centred on x and z and standing on y = 0.
 */
export function createVehiclesThree(THREE: any, options: VehiclesThreeOptions): VehiclesThree {
  const kit = options.kit
  const groupOf = options.groupOf || ((key: string) => (kit.find(key)?.group === kit.config.defaultGroup ? 'cars' : String(kit.find(key)?.group)))
  const militaryKeys = new Set<string>()
  const isMilitary = (key: string): boolean => militaryKeys.has(key) || paletteOf(groupOf(key)) === paintPalettes.military

  const build = (key: string, o: BuildVehicleOptions = {}): BuiltVehicle => {
    const quality: VehicleQuality = o.quality === 'lite' ? 'lite' : 'high'
    const spec = kit.find(key)
    if (!spec) throw new Error(`createVehiclesThree: unknown vehicle "${key}"`)
    const seed = o.seed == null ? null : o.seed
    const color = o.color || (seed != null ? colorFromSeed(seed, isMilitary(key) ? paintPalettes.military : paintPalettes.civil) : null)
    const c: any = kit.build(key, o.state || 'intact', undefined, { lod: quality === 'lite' })
    c.root.updateMatrixWorld(true)
    const primary = primaryPaint(c)
    const rotation = new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    const bounds = new THREE.Box3()
    const piece = new THREE.Box3()
    const turned = new THREE.Matrix4()
    c.vehicle.traverse((m: any) => {
      if (!m.isMesh || !m.geometry || m.userData.ghost) return
      for (let p = m; p; p = p.parent) if (p.visible === false) return
      m.geometry.computeBoundingBox()
      piece.copy(m.geometry.boundingBox).applyMatrix4(turned.multiplyMatrices(rotation, m.matrixWorld))
      bounds.union(piece)
    })
    const cx = (bounds.min.x + bounds.max.x) / 2
    const cz = (bounds.min.z + bounds.max.z) / 2
    const pivotMatrix = new THREE.Matrix4().makeTranslation(-cx, -bounds.min.y, -cz).multiply(rotation)
    const group = new THREE.Group()
    group.name = `vehicle:${key}`
    const damageables = kit.damageables(c, pivotMatrix)
    let pruned = 0
    if (quality === 'high') {
      const pivot = new THREE.Group()
      pivot.name = 'vehicle'
      pivot.matrixAutoUpdate = false
      pivot.matrix.copy(pivotMatrix)
      pivot.matrixWorldNeedsUpdate = true
      c.vehicle.matrixAutoUpdate = true
      pivot.add(c.vehicle)
      group.add(pivot)
      if (color && primary) {
        const repainted = primary.clone()
        repainted.color.set(color)
        c.vehicle.traverse((m: any) => {
          if (!m.isMesh) return
          if (Array.isArray(m.material)) m.material = m.material.map((x: any) => (x === primary ? repainted : x))
          else if (m.material === primary) m.material = repainted
        })
      }
      markDamageables(c, damageables)
      group.updateMatrixWorld(true)
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
      dispose() {
        group.traverse((m: any) => {
          if (m.geometry) m.geometry.dispose()
        })
      },
    }
  }

  return { THREE, kit, build }
}

/** Tags the meshes of each damageable zone (and the tyres) so a hit test can tell what it hit. */
function markDamageables(c: any, damageables: Damageable[]): void {
  const byZone: Record<string, Damageable> = {}
  for (const d of damageables) byZone[d.zone] = d
  for (const z of c.zones || []) {
    const d = byZone[z.id]
    if (!d) continue
    for (const o of z.objs || z.meshes || []) if (o && o.userData) o.userData.damageable = { material: d.material, zone: d.zone }
  }
  for (const w of c.wheels || []) {
    const z = (c.zones || []).find((zz: any) => zz.type === 'wheel' && zz.objs && zz.objs.indexOf(w) >= 0)
    w.userData.damageable = { material: 'rubber', zone: z ? z.id : 'wheel' }
  }
}
