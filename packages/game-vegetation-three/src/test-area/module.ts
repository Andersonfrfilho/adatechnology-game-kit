import type { BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'
import * as GameVegetationMain from '@adatechnology/game-vegetation'
import * as GameVegetationAdapter from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpeciesMain from '@adatechnology/game-vegetation-species'
import type { Condition, Lod, Season } from '@adatechnology/game-vegetation'

import { createNursery } from './nursery'
import type { Nursery } from './nursery'
import { createPlants, PLANT_DEFS, PLANT_SEED } from './plants'
import type { PieceMeta } from './plants'
import { createScenarios } from './scenarios'
import { fill, TEXT } from './text'
import type { MaterialsLike, SpeciesSdk, VegetationContext, VegetationSdk, VegetationTestOptions } from './types'

export const VEGETATION_AREA_ID = 'vegetation'

/** The 18 item ids of the Viveiro's module, in its order. */
export const VEGETATION_ITEM_IDS: readonly string[] = PLANT_DEFS.map((def) => def.id)

/** The ids of the 13 scenarios (the ids of the Viveiro's page, `veg_*`). */
export const VEGETATION_SCENARIO_IDS: readonly string[] = [
  'veg_axe_fells_crown',
  'veg_axe_fells_30cm',
  'veg_axe_cuts_branch_joint',
  'veg_shot_cannot_fell',
  'veg_saw_cuts_branch',
  'veg_lighter_ignites_foliage',
  'veg_shot_strips_leaves',
  'veg_shot_breaks_pot',
  'veg_machete_arm',
  'veg_pad_pulled',
  'veg_dead_burns_faster',
  'veg_hedge_cut_pieces',
  'veg_walk_on_grass',
]

type Three = any
type Placed = { readonly root: any; helpers: any[] }

const defaultSdk = (): VegetationSdk => ({ ...GameVegetationMain, ...GameVegetationAdapter }) as VegetationSdk
const AXIS_COLOURS: Record<string, number> = { trunk: 0xd9822b, branch: 0xe5c07b, arm: 0x6fcf6f, stem: 0x6fcf97, pad: 0x6fb7cf }

/**
 * The vegetation test area as a `TestableModule`: the 18 plants of the Viveiro (mango trees of three sizes, ipe, palm, banana, araucaria, dead tree, hibiscus, hedge, rose, sunflower, three
 * cacti, two pots, a lawn tuft) as items of the default destruction world, each piece a mesh with its spec (shape from the real wood thickness, joints, anchors, tags, sway clip), and the 13
 * scenarios of that page (literal). The bench plants the nursery lot (12 x 20 m, with house, walls and path, by `scatterRulesFor`) with its seed, quality, detail, condition and season, sets
 * the wind and starts the walker that bends the plants; its layers show the colliders, the boxes of the pieces and the axes of the wood; its metrics read triangles, pieces and draw calls.
 */
export function createVegetationTestModule(options: VegetationTestOptions = {}): TestableModule<VegetationContext> & { readonly placed: ReadonlyMap<string, unknown>; materials(THREE?: unknown): MaterialsLike; tick(t: number): void; readonly itemIds: readonly string[] } {
  const locale = options.locale ?? 'pt-BR'
  const text = TEXT[locale.toLowerCase().startsWith('en') ? 'en' : 'pt-BR'] as (typeof TEXT)[string]
  const sdk: VegetationSdk = options.GameVegetation ?? defaultSdk()
  const species: SpeciesSdk = options.GameVegetationSpecies ?? (GameVegetationSpeciesMain as SpeciesSdk)
  let mats: MaterialsLike | null = options.materials ?? null
  let three: Three = null
  let host: ModuleHost | null = null
  const materials = (THREE?: unknown): MaterialsLike => {
    if (!mats) mats = sdk.createVegetationMaterials((THREE ?? three) as never) as unknown as MaterialsLike
    return mats
  }
  const plants = createPlants(sdk, species, (THREE) => materials(THREE), options.seed ?? PLANT_SEED)
  const placed = new Map<string, Placed>()
  const settings = { seed: 1, quality: 'high' as 'high' | 'game', lod: 0 as Lod, condition: 'healthy' as Condition, season: 'spring' as Season, wind: 0.35, gust: 0.15 }
  let nursery: Nursery | null = null
  let clock = 0
  let helpersShown = ''

  const item = (base: TestableItem): TestableItem => ({
    ...base,
    build: (THREE: unknown) => {
      three = THREE
      const root = base.build(THREE) as any
      placed.set(root.uuid, { root, helpers: [] })
      return root
    },
  })

  // ---- the layers ---------------------------------------------------------------------------------------------------------------------------
  const clearHelpers = (): void => {
    for (const entry of placed.values()) {
      for (const helper of entry.helpers) helper.parent?.remove(helper)
      entry.helpers = []
    }
    helpersShown = ''
  }
  const boxKey = (): string => `${host?.bench?.layer('colliders')}|${host?.bench?.layer('piece_boxes')}|${host?.bench?.layer('wood_axes')}|${placed.size}`
  const refreshLayers = (): void => {
    if (!host?.bench || !three) return
    clearHelpers()
    nursery?.showColliders(host.bench.layer('colliders'))
    for (const entry of placed.values()) {
      const root = entry.root
      if (!root.parent) continue
      const mark = (helper: any): void => {
        helper.userData.helper = true
        root.add(helper)
        entry.helpers.push(helper)
      }
      if (host.bench.layer('colliders') && root.userData.collider && root.userData.collider.kind) {
        const c = root.userData.collider
        const wire = new three.Mesh(new three.CylinderGeometry(c.radius, c.radius, c.height, 14, 1, true), new three.MeshBasicMaterial({ color: root.userData.thorny ? 0xff7a1a : 0xe5251d, wireframe: true }))
        wire.position.set(0, c.height / 2, 0)
        mark(wire)
      }
      for (const mesh of root.children) {
        const v = mesh.userData?.veg as PieceMeta | undefined
        if (!v || !mesh.geometry) continue
        if (host.bench.layer('piece_boxes')) {
          mesh.geometry.computeBoundingBox()
          const box = mesh.geometry.boundingBox.clone().translate(mesh.position)
          mark(new three.Box3Helper(box, 0x66ccff))
        }
        if (host.bench.layer('wood_axes') && v.radius !== undefined && v.length !== undefined && v.axis && !v.sub) {
          // the base of the piece is in plant space; the section of a hedge stands `dx` to the side
          const base = pieceBase(root, v)
          if (base) {
            const from = new three.Vector3(base[0] + v.dx, base[1], base[2])
            const to = from.clone().add(new three.Vector3(v.axis[0], v.axis[1], v.axis[2]).multiplyScalar(v.length))
            const line = new three.Line(new three.BufferGeometry().setFromPoints([from, to]), new three.LineBasicMaterial({ color: AXIS_COLOURS[v.kind] ?? 0xffffff }))
            mark(line)
          }
        }
      }
    }
    helpersShown = boxKey()
  }
  // the `base` of a wood piece is recorded on the destruction part of its mesh by the SDK; the module keeps it in `userData.destructionPart` of the mesh
  const pieceBase = (root: any, v: PieceMeta): Vec3 | null => {
    const mesh = root.children.find((c: any) => c.userData?.veg?.id === v.id)
    const base = mesh?.userData?.destructionPart?.base
    return Array.isArray(base) ? (base as Vec3) : null
  }

  // ---- the nursery ----------------------------------------------------------------------------------------------------------------------------
  const nurseryOf = (): Nursery | null => {
    if (!host || !three) return null
    if (!nursery) nursery = createNursery(sdk, species, three, materials(three), host.scene, options.nurseryOrigin ?? [-6, 14])
    return nursery
  }
  const plantLot = (): void => {
    const n = nurseryOf()
    if (!n || !host) return
    const stats = n.plant(settings)
    n.showColliders(Boolean(host.bench?.layer('colliders')))
    host.log(fill(text.lot.planted, stats.plants, stats.triangles, stats.colliders), { plants: stats.plants, triangles: stats.triangles })
  }
  const replant = (): void => {
    if (nursery?.planted) plantLot()
  }

  // ---- the bench ---------------------------------------------------------------------------------------------------------------------------------
  const applyWind = (): void => {
    if (mats) mats.setWind({ strength: settings.wind, gust: settings.gust })
  }
  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') return refreshLayers()
    if (change.kind === 'action') {
      if (change.id === 'plant_lot') plantLot()
      else if (change.id === 'clear_lot') {
        nursery?.clear()
        host?.log(text.lot.cleared)
      } else if (change.id === 'toggle_walker') {
        const n = nurseryOf()
        if (!n) return
        if (!n.planted) plantLot()
        n.setWalker(!n.walking)
        host?.log(n.walking ? text.lot.walker_on : text.lot.walker_off)
      }
      return
    }
    switch (change.id) {
      case 'seed': settings.seed = Number(change.value); replant(); break
      case 'quality': settings.quality = String(change.value) as 'high' | 'game'; replant(); break
      case 'lod': settings.lod = Number(change.value) as Lod; replant(); break
      case 'condition': settings.condition = String(change.value) as Condition; replant(); break
      case 'season': settings.season = String(change.value) as Season; replant(); break
      case 'wind': settings.wind = Number(change.value); applyWind(); break
      case 'gust': settings.gust = Number(change.value); applyWind(); break
      default: break
    }
  }

  const frame = (dt: number): void => {
    clock += dt
    if (mats) mats.update(clock)
    for (const [id, entry] of placed) if (!entry.root.parent) placed.delete(id)
    if (host?.bench && boxKey() !== helpersShown && (host.bench.layer('colliders') || host.bench.layer('piece_boxes') || host.bench.layer('wood_axes') || helpersShown !== '')) refreshLayers()
    nursery?.step(dt)
  }

  const count = (): { drawCalls: number; triangles: number; pieces: number } => {
    let drawCalls = 0
    let triangles = 0
    let pieces = 0
    for (const entry of placed.values()) {
      entry.root.traverse((mesh: any) => {
        if (!mesh.isMesh || mesh.userData.helper) return
        for (let p = mesh; p; p = p.parent) if (p.visible === false) return
        drawCalls += 1
        if (mesh.userData.veg) pieces += 1
        const g = mesh.geometry
        triangles += (g.index ? g.index.count : g.attributes.position.count) / 3
      })
    }
    return { drawCalls, triangles: Math.round(triangles), pieces }
  }
  const lotCalls = (): number => {
    let calls = 0
    nursery?.group.traverse((o: any) => {
      if (o.isMesh && o.visible) calls += 1
    })
    return calls
  }

  return {
    id: VEGETATION_AREA_ID,
    name: text.name,
    group: text.group,
    get placed() {
      return placed
    },
    itemIds: VEGETATION_ITEM_IDS,
    materials,
    tick: (t: number) => {
      if (mats) mats.update(t)
    },
    items: (loc: string) => plants.items(loc || locale).map(item),
    scenarios: (loc: string): ModuleScenario<VegetationContext>[] => createScenarios(loc || locale),
    area: (): ModuleArea => {
      // three rows by size, each plant given room by its width: the small ones in front, the middle ones behind them, the trees at the back
      const rows: { z: number; ids: readonly string[] }[] = [
        { z: -4, ids: ['hibiscus_shrub', 'rose_bush_red', 'sunflower', 'mandacaru', 'prickly_pear', 'crown_cactus'] },
        { z: -9, ids: ['banana_with_bunch', 'dead_tree', 'boxwood_hedge', 'potted_fern', 'potted_cactus', 'lawn_tuft'] },
        { z: -16, ids: ['mango_tree', 'yellow_ipe', 'coconut_palm', 'araucaria', 'mango_young_30', 'mango_young_15'] },
      ]
      const widths: Record<string, number> = { mango_tree: 5, yellow_ipe: 5, coconut_palm: 4.5, araucaria: 4, mango_young_30: 3, mango_young_15: 2.6, banana_with_bunch: 3.5, dead_tree: 3.5, boxwood_hedge: 5.5, hibiscus_shrub: 2, rose_bush_red: 1.6, sunflower: 1.4, mandacaru: 2.2, prickly_pear: 2, crown_cactus: 1.8, potted_fern: 1.4, potted_cactus: 1.2, lawn_tuft: 1.2 }
      const gap = 1.2
      const placements = rows.flatMap((row) => {
        const total = row.ids.reduce((sum, id) => sum + (widths[id] ?? 2) + gap, -gap)
        let cursor = -total / 2
        return row.ids.map((id) => {
          const width = widths[id] ?? 2
          const x = cursor + width / 2
          cursor += width + gap
          return { item: id, position: [x, 0, row.z] as Vec3, rotationY: 0 }
        })
      })
      return { placements, view: { eye: [0, 6, 8], target: [0, 1.8, -10] } }
    },
    controls: (): ModuleControl[] => [
      { kind: 'number', id: 'seed', name: text.controls.seed, hint: text.hints.seed, min: 0, max: 99999, step: 1, default: 1 },
      { kind: 'choice', id: 'quality', name: text.controls.quality, hint: text.hints.quality, options: (['high', 'game'] as const).map((id) => ({ id, name: text.options.quality[id] as string })), default: 'high' },
      { kind: 'choice', id: 'lod', name: text.controls.lod, hint: text.hints.lod, options: (['0', '1', '2'] as const).map((id) => ({ id, name: text.options.lod[id] as string })), default: '0' },
      { kind: 'choice', id: 'condition', name: text.controls.condition, hint: text.hints.condition, options: (['healthy', 'dry', 'dead', 'overgrown'] as const).map((id) => ({ id, name: text.options.condition[id] as string })), default: 'healthy' },
      { kind: 'choice', id: 'season', name: text.controls.season, hint: text.hints.season, options: (['spring', 'summer', 'autumn', 'winter'] as const).map((id) => ({ id, name: text.options.season[id] as string })), default: 'spring' },
      { kind: 'number', id: 'wind', name: text.controls.wind, hint: text.hints.wind, min: 0, max: 1, step: 0.05, default: 0.35 },
      { kind: 'number', id: 'gust', name: text.controls.gust, hint: text.hints.gust, min: 0, max: 1, step: 0.05, default: 0.15 },
      { kind: 'action', id: 'plant_lot', name: text.actions.plant_lot },
      { kind: 'action', id: 'clear_lot', name: text.actions.clear_lot },
      { kind: 'action', id: 'toggle_walker', name: text.actions.toggle_walker },
    ],
    layers: (): ModuleLayer[] => (['colliders', 'piece_boxes', 'wood_axes'] as const).map((id) => ({ id, name: text.layers[id], default: false })),
    metrics: (): ModuleMetric[] => [
      { id: 'plants', name: text.metrics.plants, read: () => placed.size },
      { id: 'pieces', name: text.metrics.pieces, read: () => count().pieces },
      { id: 'triangles', name: text.metrics.triangles, read: () => count().triangles },
      { id: 'draw_calls', name: text.metrics.draw_calls, read: () => count().drawCalls + lotCalls() },
      { id: 'lot_triangles', name: text.metrics.lot_triangles, read: () => nursery?.stats?.triangles ?? 0 },
      { id: 'lot_plants', name: text.metrics.lot_plants, read: () => nursery?.stats?.plants ?? 0 },
      { id: 'lot_colliders', name: text.metrics.lot_colliders, read: () => nursery?.stats?.colliders ?? 0 },
      { id: 'lot_lod0', name: text.metrics.lot_lod0, read: () => nursery?.stats?.lod[0] ?? 0 },
      { id: 'lot_lod1', name: text.metrics.lot_lod1, read: () => nursery?.stats?.lod[1] ?? 0 },
      { id: 'lot_lod2', name: text.metrics.lot_lod2, read: () => nursery?.stats?.lod[2] ?? 0 },
      { id: 'lot_ms', name: text.metrics.lot_ms, unit: 'ms', read: () => nursery?.stats?.buildMs ?? 0 },
    ],
    attach(lent) {
      host = lent
      three = lent.THREE
      const stopChange = lent.bench?.onChange(onChange)
      const stopFrame = lent.onFrame(frame)
      applyWind()
      return () => {
        stopChange?.()
        stopFrame()
        clearHelpers()
        nursery?.clear()
        nursery = null
        host = null
      }
    },
  }
}

/** What `loadVegetationTestModule` needs of a room: `TestRoom.loadModule` has it. */
export type ModuleRoomLike = { loadModule(module: never): unknown }

/** Loads the vegetation module into a room. */
export function loadVegetationTestModule<Room extends ModuleRoomLike>(room: Room, options: VegetationTestOptions = {}): ReturnType<Room['loadModule']> {
  return room.loadModule(createVegetationTestModule(options) as never) as ReturnType<Room['loadModule']>
}
