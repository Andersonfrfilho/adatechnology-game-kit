import type { Condition, Lod, Placement, Season } from '@adatechnology/game-vegetation'
import { shapeGeometries } from '@adatechnology/game-shapes-three'

import type { MaterialsLike, ScatterRulesOptionsLike, SpeciesSdk, VegetationSdk } from './types'

type Three = any

/** The plot of the Viveiro's lot demo, in metres: the corner at (0, 0), the street on the negative z side. */
export const LOT = { W: 12, D: 20 } as const
export const HOUSE = { x0: 2.5, x1: 9.5, z0: 6.5, z1: 13 } as const
/** The walker's route (x, z). */
export const WAY: readonly (readonly [number, number])[] = [[6, 1.2], [6, 5.4], [10.8, 5.4], [10.8, 14.2], [8, 18.6], [3, 18.6], [1.2, 14.2], [1.2, 5.4], [4, 3.2], [8, 3.2]]

type Rect = { rect: { x: number; z: number; w: number; d: number } }
export const EX_HOUSE: Rect = { rect: { x: HOUSE.x0 - 0.7, z: HOUSE.z0 - 0.7, w: HOUSE.x1 - HOUSE.x0 + 1.4, d: HOUSE.z1 - HOUSE.z0 + 1.4 } }
export const EX_PATH: Rect = { rect: { x: 5.1, z: 0, w: 1.8, d: HOUSE.z0 } }
/** Where each kind of planting goes. */
export const AREAS: Readonly<Record<'front_yard' | 'backyard' | 'sides' | 'sidewalk_tree', Rect[]>> = {
  front_yard: [{ rect: { x: 0.5, z: 0.5, w: 11, d: 5.6 } }],
  backyard: [{ rect: { x: 0.5, z: 13.7, w: 11, d: 5.8 } }],
  sides: [{ rect: { x: 0.5, z: 6.2, w: 1.3, d: 7.4 } }, { rect: { x: 10.2, z: 6.2, w: 1.3, d: 7.4 } }],
  sidewalk_tree: [{ rect: { x: 0.8, z: -1.9, w: 10.4, d: 1.2 } }],
}

/** The four plantings of the lot: the context of the regional table, where, how many of each group, and the tag of the scatter seed. */
export type Planting = { context: string; areas: Rect[]; options: ScatterRulesOptionsLike; tag: string }
export const PLANTINGS: readonly Planting[] = [
  { context: 'front_yard', areas: AREAS.front_yard, options: { n: 12, noLarge: true, maxCount: { trees: 1, hedges: 10, mid: 14, ground: 40 } }, tag: 'f' },
  { context: 'backyard', areas: AREAS.backyard, options: { n: 14, maxCount: { trees: 3, hedges: 4, mid: 12, ground: 50 } }, tag: 'b' },
  { context: 'front_yard', areas: AREAS.sides, options: { n: 8, noLarge: true, maxCount: { trees: 0, hedges: 4, mid: 6, ground: 14 } }, tag: 's' },
  { context: 'sidewalk_tree', areas: AREAS.sidewalk_tree, options: { n: 4, treeDensity: 0.3, maxCount: { trees: 2, hedges: 0, mid: 0, ground: 0 } }, tag: 'c' },
]

export type NurserySettings = { seed: number; quality: 'high' | 'game'; lod: Lod; condition: Condition; season: Season }

export type LotStats = { triangles: number; plants: number; colliders: number; meshes: number; lod: [number, number, number]; buildMs: number; species: number }

/**
 * The scatter of the lot: the same picks, rules and placements as the Viveiro's `buildLotVeg`. Every planting draws its species from the regional table of its context, splits
 * them into trees, hedges, middle layer and ground cover, and scatters each group over the areas of the plot without touching the house or the path.
 */
export function scatterLot(sdk: VegetationSdk, species: SpeciesSdk, seedNumber: number, plantings: readonly Planting[] = PLANTINGS): { placements: Placement[]; used: Set<string> } {
  const seed = `quintal-${seedNumber}`
  const placements: Placement[] = []
  const used = new Set<string>()
  for (const planting of plantings) {
    const { rules, picks } = species.scatterRulesFor(species.regions.br, planting.context, seed, planting.options)
    for (const p of picks) used.add(p.id)
    planting.areas.forEach((area, i) => {
      const exclude = [EX_HOUSE, EX_PATH]
      const perArea = rules.map((rule) => ({ ...rule, maxCount: Math.max(1, Math.ceil((rule.maxCount as number) / planting.areas.length)) }))
      placements.push(...sdk.scatter(area as never, perArea as never, { seed: `${seed}:${planting.tag}:${i}`, exclude: exclude as never }))
    })
  }
  return { placements, used }
}

/** The static scenery of the plot: ground, street, sidewalk, path, house and walls. Simple boxes; the room's own floor is under it. */
function buildScenery(THREE: Three): any {
  const g = new THREE.Group()
  g.name = 'nursery-scenery'
  const material = (color: number, roughness = 0.9): any => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })
  const mats = { ground: material(0x5f7d45), asphalt: material(0x3a3d42), concrete: material(0xb7b3a8), house: material(0xe3d6bd), roof: material(0x9a4d38), door: material(0x6b4a2f), glass: material(0x9fc7dd, 0.2), wall: material(0xc9c2b2) }
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number): any => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    g.add(mesh)
    return mesh
  }
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(LOT.W, LOT.D), mats.ground)
  yard.rotation.x = -Math.PI / 2
  yard.position.set(6, 0.01, 10)
  yard.receiveShadow = true
  g.add(yard)
  box(30, 0.04, 4.6, mats.asphalt, 6, 0.0, -4.6) // street
  box(30, 0.1, 2.2, mats.concrete, 6, 0.04, -1.1) // sidewalk
  box(1.6, 0.03, 6.6, mats.concrete, 6, 0.02, 3.2) // path to the door
  const hw = HOUSE.x1 - HOUSE.x0
  const hd = HOUSE.z1 - HOUSE.z0
  const hcx = (HOUSE.x0 + HOUSE.x1) / 2
  const hcz = (HOUSE.z0 + HOUSE.z1) / 2
  box(hw, 2.8, hd, mats.house, hcx, 1.4, hcz)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1.5, 4), mats.roof)
  roof.rotation.y = Math.PI / 4
  roof.scale.set((hw + 1.2) / Math.SQRT2, 1, (hd + 1.2) / Math.SQRT2)
  roof.position.set(hcx, 2.8 + 0.75, hcz)
  roof.castShadow = roof.receiveShadow = true
  g.add(roof)
  box(1.1, 2.1, 0.08, mats.door, 6, 1.05, HOUSE.z0 - 0.04)
  box(1.6, 1.1, 0.08, mats.glass, 3.8, 1.5, HOUSE.z0 - 0.04)
  box(1.6, 1.1, 0.08, mats.glass, 8.2, 1.5, HOUSE.z0 - 0.04)
  // walls
  box(5, 1.4, 0.2, mats.wall, 2.5, 0.7, 0)
  box(5, 1.4, 0.2, mats.wall, 9.5, 0.7, 0)
  box(0.2, 1.8, LOT.D, mats.wall, 0, 0.9, 10)
  box(0.2, 1.8, LOT.D, mats.wall, LOT.W, 0.9, 10)
  box(LOT.W, 1.8, 0.2, mats.wall, 6, 0.9, LOT.D)
  return g
}

/**
 * The nursery: the 12 x 20 m plot of the Viveiro's lot demo (house, walls, street, path) planted by `scatterRulesFor` + `scatter` + `buildLot`, and the walker that crosses it and bends
 * the plants (the wind shader's actors). The module owns it; `plant` builds it, `clear` takes it away.
 */
export function createNursery(sdk: VegetationSdk, species: SpeciesSdk, THREE: Three, materials: MaterialsLike, parent: any, origin: readonly [number, number]) {
  // three with its primitive geometries made by game-shapes (bit-identical, cached by parameters)
  const T = shapeGeometries(THREE) as Three
  const group = new THREE.Group()
  group.name = 'nursery'
  group.position.set(origin[0], 0, origin[1])
  const dynamic = new THREE.Group()
  const colliders = new THREE.Group()
  colliders.visible = false
  let scenery: any = null
  let lotObject: any = null
  let data: ReturnType<VegetationSdk['buildLot']> | null = null
  let stats: LotStats | null = null
  let actor: any = null
  const walker = { x: WAY[0]![0], z: WAY[0]![1], waypoint: 0, on: false }
  const actors = [{ x: 0, y: 0.8, z: 0, radius: 1.5 }]
  let attached = false

  const disposeObject = (object: any): void => {
    object.traverse((child: any) => {
      child.geometry?.dispose?.()
    })
  }
  const clearGroup = (g: any): void => {
    for (const child of [...g.children]) {
      g.remove(child)
      disposeObject(child)
      child.material?.dispose?.()
    }
  }
  const ensure = (): void => {
    if (attached) return
    attached = true
    scenery = buildScenery(T)
    // a capsule where this three.js has one (r139+), else a cylinder of the same size
    const body = T.CapsuleGeometry ? new T.CapsuleGeometry(0.28, 1.0, 4, 10) : new T.CylinderGeometry(0.28, 0.28, 1.56, 10)
    actor = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.7 }))
    actor.castShadow = true
    actor.position.set(walker.x, 0.78, walker.z)
    actor.visible = false
    group.add(scenery, dynamic, colliders, actor)
    parent.add(group)
  }

  const blocked = (x: number, z: number): boolean => {
    if (x < 0.55 || x > LOT.W - 0.55 || z < 0.55 || z > LOT.D - 0.55) return true
    if (x > HOUSE.x0 - 0.4 && x < HOUSE.x1 + 0.4 && z > HOUSE.z0 - 0.4 && z < HOUSE.z1 + 0.4) return true
    if (data) {
      for (const c of data.colliders) {
        const dx = x - c.x
        const dz = z - c.z
        const r = c.r + 0.3
        if (dx * dx + dz * dz < r * r) return true
      }
    }
    return false
  }

  return {
    group,
    get stats(): LotStats | null {
      return stats
    },
    get planted(): boolean {
      return lotObject !== null
    },
    get walking(): boolean {
      return walker.on
    },
    get position(): { x: number; z: number } {
      return { x: walker.x, z: walker.z }
    },
    /** Plants the lot with the settings (replaces the one standing). */
    plant(settings: NurserySettings): LotStats {
      ensure()
      if (lotObject) {
        dynamic.remove(lotObject)
        disposeObject(lotObject)
        lotObject = null
      }
      clearGroup(colliders)
      const { placements, used } = scatterLot(sdk, species, settings.seed)
      const t0 = Date.now()
      data = sdk.buildLot(placements, (id) => species.toSpec(id), { seed: `quintal-${settings.seed}`, quality: settings.quality, lod: settings.lod, condition: settings.condition, season: settings.season })
      const buildMs = Date.now() - t0
      lotObject = sdk.createLotObject(THREE, data, materials as never)
      lotObject.traverse((c: any) => {
        if (c.isMesh) {
          c.castShadow = true
          c.receiveShadow = true
        }
      })
      dynamic.add(lotObject)
      for (const c of data.colliders) {
        const m = new THREE.Mesh(new T.CylinderGeometry(c.r, c.r, c.h, 14, 1, true), new THREE.MeshBasicMaterial({ color: c.damage ? 0xff7a1a : 0xe5251d, wireframe: true }))
        m.position.set(c.x, c.h / 2, c.z)
        colliders.add(m)
      }
      stats = { triangles: data.triangleCount, plants: data.plantCount, colliders: data.colliders.length, meshes: Object.keys(data.meshes).length, lod: data.lodCounts, buildMs, species: used.size }
      return stats
    },
    /** The colliders of the lot as wire cylinders. */
    showColliders(on: boolean): void {
      colliders.visible = on
    },
    /** Starts or stops the walker that crosses the lot along `WAY`, bending the plants. */
    setWalker(on: boolean): void {
      ensure()
      walker.on = on
      actor.visible = on
      if (!on) {
        actors[0]!.radius = 0
        materials.setActors(actors)
      } else actors[0]!.radius = 1.5
    },
    step(dt: number): void {
      if (!attached || !walker.on) return
      const target = WAY[walker.waypoint]!
      const ddx = target[0] - walker.x
      const ddz = target[1] - walker.z
      const d = Math.hypot(ddx, ddz)
      let dx = 0
      let dz = 0
      if (d < 0.25) walker.waypoint = (walker.waypoint + 1) % WAY.length
      else {
        dx = ddx / d
        dz = ddz / d
      }
      if (dx || dz) {
        const sp = 2.0 * dt
        const nx = walker.x + dx * sp
        const nz = walker.z + dz * sp
        if (!blocked(nx, walker.z)) walker.x = nx
        if (!blocked(walker.x, nz)) walker.z = nz
        if (blocked(nx, nz)) walker.waypoint = (walker.waypoint + 1) % WAY.length
        actor.rotation.y = Math.atan2(dx, dz)
      }
      actor.position.set(walker.x, 0.78, walker.z)
      const a = actors[0]!
      a.x = origin[0] + walker.x
      a.z = origin[1] + walker.z
      a.y = 0.8
      materials.setActors(actors)
    },
    /** Takes the lot, the walker and the scenery away. */
    clear(): void {
      if (walker.on) this.setWalker(false)
      if (lotObject) {
        dynamic.remove(lotObject)
        disposeObject(lotObject)
        lotObject = null
      }
      clearGroup(colliders)
      if (attached) {
        parent.remove(group)
        clearGroup(group)
        attached = false
        scenery = null
        actor = null
      }
      data = null
      stats = null
      walker.x = WAY[0]![0]
      walker.z = WAY[0]![1]
      walker.waypoint = 0
    },
  }
}

export type Nursery = ReturnType<typeof createNursery>
