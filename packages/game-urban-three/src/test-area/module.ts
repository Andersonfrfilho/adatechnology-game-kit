import type { BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'
import { createPlantProvider, createUrban, createVehicleProvider, SAMPLE_CELLS } from '@adatechnology/game-urban'
import type { Locale, Providers, TerrainOptions, UrbanBuilder, UrbanKit, UrbanOptions } from '@adatechnology/game-urban'
import { shapeGeometries } from '@adatechnology/game-shapes-three'

import { createUrbanThree } from '../draw'
import type { DrawnUrban } from '../draw'
import { createPlantResolver, createVehicleResolver } from '../resolvers'
import type { PlacementResolver } from '../resolvers'
import { createScenarios } from './scenarios'
import { fill, TEXT } from './text'
import type { UrbanContext, UrbanTestOptions } from './types'
import type { CanvasFactory } from '../text'

export const URBAN_AREA_ID = 'urban'

/** The default terrain patch of the area: a rolling plain 96 m wide with a river across it and a round lake. A game passes its own through `terrain`. */
export const DEFAULT_TEST_TERRAIN: TerrainOptions = {
  world: { size: 96, scale: 1, origin: -48, segments: 48 },
  base: {
    level: 1.2,
    waves: [
      { kind: 'product', x: ['sin', 0.09], y: ['cos', 0.07], amplitude: 1.1 },
      { kind: 'diagonal', kx: 0.05, ky: 0.04, amplitude: 0.5 },
    ],
  },
  layers: [],
  flatten: [],
  rivers: [{ id: 'river', points: [[-48, -30], [-20, -24], [10, -30], [48, -22]], width: [3, 9], bed: { fixed: -1.2 } }],
  lakes: [{ id: 'lake', center: [24, 24], radius: [12, 12], level: -0.9, edge: [0.55, 1], reach: 1.4 }],
  forest: { zones: [{ mask: [{ axis: 'x', from: -48, to: -20, fullUntil: -40 }] }] },
  colors: [
    { kind: 'below', height: 0.1, color: 0x6b7a5a },
    { kind: 'forest', above: 0.5, color: 0x3e5a35 },
  ],
  fields: { colors: [0x7a8c55, 0x8a9a5e, 0x6f8450], cell: [8, 8] },
  water: { level: -0.35, color: 0x2b4452, roughness: 0.3, metalness: 0.25 },
}

const FLOOR_Y = 0
const POLE_ROW_Z = -26
const POLE_GAP = 6
const SHEET_SHIFT_Z = -200
const VIEW_FAR = 600
const GRID = { block: 36, count: 2, width: 10 }
const LAMP_SHARES: Record<string, number | undefined> = { pattern: undefined, all: 1, half: 0.5, none: 0 }

type Three = any
type Placed = { root: any; drawn: DrawnUrban }

/**
 * The urban test area as a `TestableModule`: the five poles of the Galeria in a row, a street grid with a filled block, a patch of terrain and the ten neighbourhoods of the
 * sample sheet in its cells, each drawn by the kit and `game-urban-three` (so a game that patches the catalogues sees its own). The bench draws any neighbourhood in front of the player with
 * a seed, a share of lamps on, a light budget and, when asked, the vehicles of the fleet and the species of the region; its layers show the reach of the real lights and the box of each sample.
 */
export function createUrbanTestModule(options: UrbanTestOptions = {}): TestableModule<UrbanContext> & { readonly placed: ReadonlyMap<string, unknown>; tick(t: number): void; readonly itemIds: readonly string[] } {
  const locale: Locale = (options.locale ?? 'pt-BR').toLowerCase().startsWith('en') ? 'en' : 'pt-BR'
  const text = TEXT[locale] as (typeof TEXT)[string]
  const terrain = options.terrain ?? DEFAULT_TEST_TERRAIN
  const seed = options.seed ?? 7
  const benchOrigin = options.benchOrigin ?? [0, -60]
  const settings = { pattern: 'downtown', seed, lamps: 'pattern', budget: 16, providers: 'none' }
  let host: ModuleHost | null = null
  let three: Three = null
  let clock = 0
  let helpersShown = ''
  let bench: (Placed & { plan: ReturnType<ReturnType<UrbanKit['neighbourhoods']['get']>['compose']> }) | null = null
  const placed = new Map<string, Placed>()
  let helpers: any[] = []
  const resolvers: { plant?: PlacementResolver; vehicle?: PlacementResolver } = {}

  const baseKit = createUrban(options.urban)
  const poleIds = baseKit.poles.ids()
  const patternIds = baseKit.neighbourhoods.ids()
  const itemIds = [...poleIds.map((id) => `pole_${id}`), 'street_grid', 'terrain_patch', ...patternIds]

  const kitWith = (overrides: { lamps?: string; budget?: number } = {}): UrbanKit => {
    const share = LAMP_SHARES[overrides.lamps ?? 'pattern']
    const urban: UrbanOptions = options.urban ?? {}
    const patch = share === undefined ? urban.patch : { ...urban.patch, neighbourhoods: { ...urban.patch?.neighbourhoods, ...Object.fromEntries(patternIds.map((id) => [id, { ...(urban.patch?.neighbourhoods?.[id] ?? {}), lit: share }])) } }
    return createUrban({ ...urban, ...(patch ? { patch } : {}), lights: { budget: overrides.budget ?? urban.lights?.budget } })
  }

  const resolversFor = (THREE: Three): { plant?: PlacementResolver; vehicle?: PlacementResolver } => {
    if (!resolvers.plant) resolvers.plant = createPlantResolver(THREE, { lod: 1 })
    if (!resolvers.vehicle && options.vehicles) resolvers.vehicle = createVehicleResolver(options.vehicles(THREE), { quality: 'lite' })
    return resolvers
  }
  const providersOf = (choice: string): Providers => {
    const providers: Providers = {}
    if (choice === 'plants' || choice === 'both') providers.plant = createPlantProvider()
    if ((choice === 'vehicles' || choice === 'both') && options.vehicles) providers.vehicle = createVehicleProvider()
    return providers
  }

  const draw = (THREE: Three, build: (b: UrbanBuilder, kit: UrbanKit) => void, kit: UrbanKit, buildSeed: number): Placed => {
    const b = kit.builder({ seed: buildSeed })
    build(b, kit)
    const document = options.document ?? (globalThis as unknown as { document?: CanvasFactory }).document
    const drawn = createUrbanThree(THREE, { ...(document ? { document } : {}), resolvers: resolversFor(THREE) }).draw(b.scene())
    return { root: drawn.root, drawn }
  }

  const sample = (THREE: Three, key: string): Placed => {
    const kit = kitWith()
    if (key.startsWith('pole_')) return draw(THREE, (b, k) => k.poles.get(key.slice(5)).build(b, { x: 0, z: 0 }), kit, seed)
    if (key === 'street_grid') {
      return draw(THREE, (b, k) => {
        k.streets.grid(b, GRID)
        const inner = GRID.block - GRID.width
        k.block.fill(b, { cx: GRID.block / 2, cz: GRID.block / 2, size: inner - 4, minHeight: 10, maxHeight: 40, k: 3 })
      }, kit, seed)
    }
    if (key === 'terrain_patch') return draw(THREE, (b, k) => k.drawTerrain(b, k.terrain(terrain)), kit, seed)
    return draw(THREE, (b, k) => { k.neighbourhoods.get(key).compose(b, { x: 0, z: 0 }, { locale }) }, kit, seed)
  }

  const item = (id: string): TestableItem => ({
    id,
    name: text.items[id] ?? id,
    movable: false,
    build: (THREE: unknown) => {
      three = THREE
      const made = sample(THREE as Three, id)
      made.root.userData.urbanItem = id
      placed.set(made.root.uuid, made)
      return made.root
    },
    spec: (root: unknown) => {
      // an urban sample is scenery: one anchored slab of concrete as large as the sample, so the room has a body to put it on and a box to aim at
      const THREE_ = three
      const box = new THREE_.Box3().setFromObject(root as never)
      const size = box.getSize(new THREE_.Vector3())
      const centre = box.getCenter(new THREE_.Vector3())
      return { name: id, tags: ['structure'], parts: [{ id: 'ground', material: 'concrete', shape: { kind: 'box', size: [Math.max(size.x, 0.1), Math.max(size.y, 0.1), Math.max(size.z, 0.1)] }, position: [centre.x, centre.y, centre.z], anchored: true }] }
    },
  })

  // ---- the bench ----------------------------------------------------------------------------------------------------------------------------
  const clearBench = (): void => {
    if (!bench) return
    bench.drawn.dispose()
    bench = null
  }
  const countObjects = (root: any): number => {
    let n = 0
    root.traverse(() => n++)
    return n
  }
  const composeBench = (): void => {
    if (!host || !three) return
    clearBench()
    const kit = kitWith({ lamps: settings.lamps, budget: settings.budget })
    if ((settings.providers === 'vehicles' || settings.providers === 'both') && !options.vehicles) host.log(text.log.no_vehicles)
    const b = kit.builder({ seed: settings.seed })
    const made = kit.neighbourhoods.get(settings.pattern).compose(b, { x: 0, z: 0 }, { locale, providers: providersOf(settings.providers) })
    const document = options.document ?? (globalThis as unknown as { document?: CanvasFactory }).document
    const drawn = createUrbanThree(three, { ...(document ? { document } : {}), resolvers: resolversFor(three) }).draw(b.scene())
    drawn.root.position.set(benchOrigin[0], FLOOR_Y, benchOrigin[1])
    ;(host.scene as any).add(drawn.root)
    bench = { root: drawn.root, drawn, plan: made }
    lightsLeft = b.lights.left
    host.log(fill(text.log.composed, settings.pattern, settings.seed, countObjects(drawn.root), drawn.lights.length), { pattern: settings.pattern, seed: settings.seed })
    helpersShown = ''
  }
  let lightsLeft = settings.budget
  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') return refreshLayers()
    if (change.kind === 'action') {
      if (change.id === 'compose') composeBench()
      else if (change.id === 'clear') {
        clearBench()
        host?.log(text.log.cleared)
      }
      return
    }
    switch (change.id) {
      case 'pattern': settings.pattern = String(change.value); if (bench) composeBench(); break
      case 'seed': settings.seed = Number(change.value); if (bench) composeBench(); break
      case 'lamps': settings.lamps = String(change.value); if (bench) composeBench(); break
      case 'budget': settings.budget = Number(change.value); if (bench) composeBench(); break
      case 'providers': settings.providers = String(change.value); if (bench) composeBench(); break
      default: break
    }
  }

  // ---- the layers -----------------------------------------------------------------------------------------------------------------------------
  // the throwaway builds of the host's contract checks are never added to a scene and do not count
  const roots = (): Placed[] => [...[...placed.values()].filter((entry) => entry.root.parent), ...(bench ? [bench] : [])]
  const clearHelpers = (): void => {
    for (const helper of helpers) helper.parent?.remove(helper)
    helpers = []
    helpersShown = ''
  }
  const boxKey = (): string => `${host?.bench?.layer('light_radius')}|${host?.bench?.layer('bounds')}|${roots().length}|${bench ? bench.root.uuid : ''}`
  const refreshLayers = (): void => {
    if (!host?.bench || !three) return
    clearHelpers()
    const mark = (parent: any, helper: any): void => {
      helper.userData.helper = true
      parent.add(helper)
      helpers.push(helper)
    }
    for (const entry of roots()) {
      if (!entry.root.parent) continue
      entry.root.updateMatrixWorld(true)
      if (host.bench.layer('bounds')) {
        const box = new three.Box3().setFromObject(entry.root)
        const inverse = new three.Matrix4().copy(entry.root.matrixWorld).invert()
        box.applyMatrix4(inverse)
        mark(entry.root, new three.Box3Helper(box, 0x66ccff))
      }
      if (host.bench.layer('light_radius')) {
        for (const light of entry.drawn.lights) {
          if (!light.isPointLight && !light.isSpotLight) continue
          const reach = new three.Mesh(new (shapeGeometries(three) as any).SphereGeometry(Math.min(light.distance || 10, 60), 14, 8), new three.MeshBasicMaterial({ color: light.color ?? 0xffcc66, wireframe: true, transparent: true, opacity: 0.25 }))
          reach.position.copy(light.position)
          mark(light.parent ?? entry.root, reach)
        }
      }
    }
    helpersShown = boxKey()
  }

  const frame = (dt: number): void => {
    clock += dt
    for (const entry of roots()) entry.drawn.animate(clock)
    for (const [id, entry] of placed) if (!entry.root.parent) placed.delete(id)
    if (host?.bench && boxKey() !== helpersShown && (host.bench.layer('light_radius') || host.bench.layer('bounds') || helpersShown !== '')) refreshLayers()
  }

  const count = (): { drawCalls: number; triangles: number; lights: number; instances: number } => {
    let drawCalls = 0
    let triangles = 0
    let lights = 0
    let instances = 0
    for (const entry of roots()) {
      entry.root.traverse((o: any) => {
        if (o.isLight) lights += 1
        if (!o.isMesh || o.userData.helper) return
        for (let p = o; p; p = p.parent) if (p.visible === false) return
        drawCalls += 1
        if (o.isInstancedMesh) instances += o.count
        const g = o.geometry
        const perInstance = (g.index ? g.index.count : g.attributes.position.count) / 3
        triangles += perInstance * (o.isInstancedMesh ? o.count : 1)
      })
    }
    return { drawCalls, triangles: Math.round(triangles), lights, instances }
  }

  // ---- the area ------------------------------------------------------------------------------------------------------------------------------
  const area = (): ModuleArea => {
    const placements: ModuleArea['placements'] = []
    poleIds.forEach((id, index) => placements.push({ item: `pole_${id}`, position: [(index - (poleIds.length - 1) / 2) * POLE_GAP, 0, POLE_ROW_Z] as Vec3, rotationY: 0 }))
    placements.push({ item: 'street_grid', position: [-230, 0, -200], rotationY: 0 })
    placements.push({ item: 'terrain_patch', position: [270, 0, -150], rotationY: 0 })
    for (const id of patternIds) {
      const cell = SAMPLE_CELLS[id]
      if (cell) placements.push({ item: id, position: [cell.x, 0, cell.z + SHEET_SHIFT_Z] as Vec3, rotationY: 0 })
    }
    const extra = patternIds.filter((id) => !SAMPLE_CELLS[id])
    extra.forEach((id, index) => placements.push({ item: id, position: [-80 + index * 80, 0, SHEET_SHIFT_Z - 112] as Vec3, rotationY: 0 }))
    return { placements, view: { eye: [20, 190, -20] as Vec3, target: [20, 0, -190] as Vec3 } }
  }

  return {
    id: URBAN_AREA_ID,
    name: text.name,
    group: text.group,
    get placed() {
      return placed
    },
    itemIds,
    tick: (t: number) => {
      for (const entry of roots()) entry.drawn.animate(t)
    },
    items: () => itemIds.map(item),
    scenarios: (): ModuleScenario<UrbanContext>[] => createScenarios({ text: TEXT[locale] as typeof text, urban: options.urban, terrain }),
    area,
    controls: (): ModuleControl[] => [
      { kind: 'choice', id: 'pattern', name: text.controls.pattern, hint: text.hints.pattern, options: patternIds.map((id) => ({ id, name: text.items[id] ?? id })), default: patternIds.includes('downtown') ? 'downtown' : (patternIds[0] as string) },
      { kind: 'number', id: 'seed', name: text.controls.seed, hint: text.hints.seed, min: 0, max: 99999, step: 1, default: seed },
      { kind: 'choice', id: 'lamps', name: text.controls.lamps, hint: text.hints.lamps, options: Object.keys(LAMP_SHARES).map((id) => ({ id, name: text.options.lamps[id] as string })), default: 'pattern' },
      { kind: 'number', id: 'budget', name: text.controls.budget, hint: text.hints.budget, min: 0, max: 64, step: 1, default: 16 },
      { kind: 'choice', id: 'providers', name: text.controls.providers, hint: text.hints.providers, options: (['none', 'plants', 'vehicles', 'both'] as const).map((id) => ({ id, name: text.options.providers[id] as string })), default: 'none' },
      { kind: 'action', id: 'compose', name: text.actions.compose },
      { kind: 'action', id: 'clear', name: text.actions.clear },
    ],
    layers: (): ModuleLayer[] => (['light_radius', 'bounds'] as const).map((id) => ({ id, name: text.layers[id], default: false })),
    metrics: (): ModuleMetric[] => [
      { id: 'samples', name: text.metrics.samples, read: () => [...placed.values()].filter((entry) => entry.root.parent).length },
      { id: 'draw_calls', name: text.metrics.draw_calls, read: () => count().drawCalls },
      { id: 'triangles', name: text.metrics.triangles, read: () => count().triangles },
      { id: 'real_lights', name: text.metrics.real_lights, read: () => count().lights },
      { id: 'instances', name: text.metrics.instances, read: () => count().instances },
      { id: 'bench_objects', name: text.metrics.bench_objects, read: () => (bench ? countObjects(bench.root) : 0) },
      { id: 'light_budget_left', name: text.metrics.light_budget_left, read: () => (bench ? lightsLeft : settings.budget) },
    ],
    attach(lent) {
      host = lent
      three = lent.THREE
      // the sample sheet is 240 m wide: the room's camera sees 140 m, so the module lends it a longer view while it is loaded
      const camera = lent.camera as { far: number; updateProjectionMatrix(): void } | undefined
      const farBefore = camera?.far
      if (camera && camera.far < VIEW_FAR) {
        camera.far = VIEW_FAR
        camera.updateProjectionMatrix()
      }
      const stopChange = lent.bench?.onChange(onChange)
      const stopFrame = lent.onFrame(frame)
      return () => {
        stopChange?.()
        stopFrame()
        clearHelpers()
        clearBench()
        if (camera && farBefore !== undefined) {
          camera.far = farBefore
          camera.updateProjectionMatrix()
        }
        resolvers.plant?.dispose?.()
        resolvers.vehicle?.dispose?.()
        host = null
      }
    },
  }
}

/** What `loadUrbanTestModule` needs of a room: `TestRoom.loadModule` has it. */
export type ModuleRoomLike = { loadModule(module: never): unknown }

/** Loads the urban module into a room. */
export function loadUrbanTestModule<Room extends ModuleRoomLike>(room: Room, options: UrbanTestOptions = {}): ReturnType<Room['loadModule']> {
  return room.loadModule(createUrbanTestModule(options) as never) as ReturnType<Room['loadModule']>
}
