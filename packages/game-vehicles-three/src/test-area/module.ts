import { footprintBlocker } from '@adatechnology/game-contracts'
import type { AnimationClipSpec, Footprint, BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'
import { buildVehicleItem, createVehicleDestructible, createVehicleKit } from '@adatechnology/game-vehicles'
import type { VehicleContext, VehicleItem, VehicleKit } from '@adatechnology/game-vehicles'
import { createArcadeDriver, createSemiSimDriver, createSurfaces, vehicleCorners } from '@adatechnology/game-vehicles-driving'
import { colorFromSeed, fleetDims, installFleet, paintPalettes, paletteOf } from '@adatechnology/game-vehicles-fleet'

import { createVehiclesThree, primaryPaint } from '../build'
import { createScenarios } from './scenarios'
import { fill, TEXT } from './text'
import { LIBRARY_BANK } from '@adatechnology/game-audio'
import { DEFAULT_TEST_WRECKS, defaultEffectIds, defaultSoundIds } from './types'
import type { EffectsLike, VehiclesContext, VehiclesTestOptions } from './types'

export const VEHICLES_AREA_ID = 'vehicles_area'

/** The eight vehicles of the Frota test page, in its order, and the item id each one has in the area. */
export const DEFAULT_TEST_VEHICLES: readonly string[] = ['compact_hatch', 'midsize_sedan', 'midsize_pickup', 'sport_bike', 'box_truck', 'city_bus', 'battle_tank', 'attack_helicopter']
const ITEM_OF: Readonly<Record<string, string>> = { compact_hatch: 'hatch', midsize_sedan: 'sedan', midsize_pickup: 'pickup', sport_bike: 'sport_bike', box_truck: 'box_truck', city_bus: 'city_bus', battle_tank: 'battle_tank', attack_helicopter: 'attack_helicopter' }
const itemId = (key: string): string => ITEM_OF[key] ?? key

/** One item of the area: the fleet vehicle it is built from, its item id and, for a wreck, the scenario built into it. */
type Entry = { readonly key: string; readonly id: string; readonly scenario?: string }

const LANE = { z: 11, from: -12, wall: 13 }
const MATERIAL_COLOURS: Record<string, number> = { metal: 0xcccccc, glass: 0x44aaff, rubber: 0xff9900, fuel: 0xff3300 }
const ZONE_COLOURS: Record<string, number> = { door: 0x55dd55, hood: 0xdddd33, lid: 0xdd9933, bumper: 0xdd55dd, glass: 0x44aaff, light: 0xffffff, wheel: 0xff7733 }

type Three = any
/** Parts whose bottom is above this (m, from the ground) are overhead: the player walks under them (the helicopter's rotor, the tank's gun). */
const BODY_HEIGHT = 1.7
type Placed = {
  readonly root: any
  readonly key: string
  /** The damage scenario built into a wreck (its size is not the design size, so it is left out of the size error). */
  readonly scenario?: string
  readonly item: VehicleItem
  readonly index: number
  paint?: any
  size?: { length: number; width: number; height: number }
  /** What the walking player bumps into, in the root's own space: the box of the parts low enough to hit a body (a rotor overhead is walked under). */
  footprint?: Footprint
  helpers: any[]
}

/**
 * The vehicles test area as a `TestableModule`: the vehicles of the Frota test (hatch, sedan, pickup, sport bike, box truck, city bus, battle tank, attack helicopter), each with its own
 * `DestructibleImpl` and its door, hood and trunk clips, the eleven scenarios of that page (literal) and two for the drivers. The bench sets the quality (full or light mode), the paint
 * by seed and palette, the driving mode and the surface, and shows the damageable boxes by material, the zones by type and the axes of the output frame. Effects (fire, glass, sparks,
 * exhaust) are requested by id through `host.effects` when the host has it; this module draws none.
 */
export function createVehiclesTestModule(options: VehiclesTestOptions = {}): TestableModule<VehiclesContext> & { readonly placed: ReadonlyMap<string, unknown> } {
  const locale = options.locale ?? 'pt-BR'
  const text = TEXT[locale] ?? (TEXT['pt-BR'] as (typeof TEXT)[string])
  const keys = options.vehicles ?? DEFAULT_TEST_VEHICLES
  const wrecks = options.wrecks ?? DEFAULT_TEST_WRECKS
  const entries: Entry[] = [...keys.map((key): Entry => ({ key, id: itemId(key) })), ...wrecks.map((w): Entry => ({ key: w.vehicle, id: w.key, scenario: w.scenario }))]
  const effectIds = { ...defaultEffectIds, ...options.effects }
  const soundIds = { ...defaultSoundIds, ...options.sounds }
  const settings = { quality: 'high', paint: false, seed: 1, palette: 'auto', driving: 'arcade', surface: 'dry_asphalt' }
  const kits = new WeakMap<object, VehicleKit>()
  const placed = new Map<string, Placed>()
  let host: ModuleHost | null = null
  let three: Three = null
  let counter = 0
  let helpersShown = ''
  let axes: any[] = []
  let lane: Lane | null = null

  type Lane = { car: any; group: any; wall: any; mode: 'arcade' | 'semi'; step(dt: number): void; speed(): number; distance(): number; done: boolean; stopped: number }

  const effects = (): EffectsLike | undefined => host?.effects
  // the sounds are asked of the host's shared engine by id (the sink may be absent, and then the module is silent)
  const audio = () => host?.audio
  let engineLoop: { set(state: { volume?: number; frequency?: number; position?: Vec3 }): void; stop(): void } | undefined
  const stopEngine = (): void => {
    engineLoop?.stop()
    engineLoop = undefined
  }

  const kitFor = (THREE: Three): VehicleKit => {
    three = THREE
    let kit = kits.get(THREE)
    if (!kit) {
      if (options.createKit) kit = options.createKit(THREE)
      else {
        kit = createVehicleKit({ THREE, locale, ...(options.document ? { document: options.document as never } : {}) })
        installFleet(kit)
      }
      kits.set(THREE, kit)
    }
    return kit
  }

  const paletteFor = (key: string) => (settings.palette === 'civil' ? paintPalettes.civil : settings.palette === 'military' ? paintPalettes.military : paletteOf(key))
  const paintOf = (entry: Placed): void => {
    if (!settings.paint) return
    const color = colorFromSeed(settings.seed + entry.index, paletteFor(entry.key))
    if (!entry.paint) {
      const vehicle = entry.item.vehicle as unknown as { vehicle: any }
      const primary = primaryPaint(entry.item.vehicle)
      if (!primary) return
      entry.paint = primary.clone()
      vehicle.vehicle.traverse((mesh: any) => {
        if (!mesh.isMesh) return
        if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m: any) => (m === primary ? entry.paint : m))
        else if (mesh.material === primary) mesh.material = entry.paint
      })
    }
    entry.paint.color.set(color)
  }

  const item = ({ key, id: itemKey, scenario }: Entry): TestableItem => ({
    id: itemKey,
    name: text.items[itemKey] ?? key,
    movable: false,
    // the first build of a vehicle takes most of a second
    slow: true,
    build: (THREE: unknown) => {
      const kit = kitFor(THREE as Three)
      const built = buildVehicleItem(kit, key, { lod: settings.quality === 'lite', ...(scenario ? { scenario } : {}) })
      built.root.userData.kit = kit
      const entry: Placed = { root: built.root, key, ...(scenario ? { scenario } : {}), item: built, index: counter++, helpers: [] }
      placed.set(built.root.uuid, entry)
      // measured now, before the destructible adds its own plates and mirrors: this is the size the fleet records
      measure(entry)
      paintOf(entry)
      return built.root
    },
    impl: (root: unknown, id: string) => {
      const r = root as { userData: Record<string, unknown> }
      const kit = r.userData.kit as VehicleKit
      const d = createVehicleDestructible(kit, r.userData.vehicle as VehicleContext, { id, frame: root, name: text.items[itemKey] ?? key })
      tapEffects(d)
      r.userData.destructible = d
      return d
    },
    ...(clipsOf(key) ? { animations: clipsOf(key) as AnimationClipSpec[] } : {}),
  })

  // the clips are numbers (rotations of the door, hood and lid parts), so any three.js namespace computes them: the one in the options, else the global one
  const clipCache = new Map<string, AnimationClipSpec[]>()
  const clipsOf = (key: string): AnimationClipSpec[] | undefined => {
    const THREE = options.three ?? (globalThis as { THREE?: unknown }).THREE
    if (!THREE) return undefined
    if (!clipCache.has(key)) {
      const kit = kitFor(THREE as Three)
      const built = buildVehicleItem(kit, key)
      const d = createVehicleDestructible(kit, built.vehicle, { id: `${itemId(key)}_clips`, frame: built.root, headless: true })
      clipCache.set(key, d.animations())
      kit.dispose(built.vehicle)
    }
    return clipCache.get(key)
  }

  // events of the vehicle become effect requests: the module owns no particle code
  const tapEffects = (d: { hit(h: never): unknown[]; update?(dt: number): unknown[] }): void => {
    const request = (events: unknown[]): void => {
      const fx = effects()
      if (!fx) return
      for (const e of events as { type: string; part?: string; point?: Vec3; worldPoint?: Vec3 }[]) {
        const position = e.point ?? e.worldPoint
        if (!position) continue
        // a pierced tank only leaks; when the leak catches fire the whole sequence plays (the fire runs to the tank, then the blast)
        if (e.type === 'ignite') fx.play({ effect: /fuel_tank|tank/.test(e.part ?? '') ? effectIds.leakIgnited : effectIds.ignite, point: position })
        else if (e.type === 'explode') fx.play({ effect: effectIds.explode, point: position })
        else if (e.type === 'leak') fx.play({ effect: effectIds.leak, point: position })
        else if (e.type === 'fracture' && /glass|window|windshield/.test(e.part ?? '')) fx.play({ effect: effectIds.glass, point: position })
        else if (e.type === 'hole') fx.play({ effect: /glass|window|windshield/.test(e.part ?? '') ? effectIds.glass : effectIds.sparks, point: position })
      }
    }
    const hit = d.hit.bind(d)
    d.hit = (h) => {
      const events = hit(h)
      request(events)
      return events
    }
    if (d.update) {
      const update = d.update.bind(d)
      d.update = (dt) => {
        const events = update(dt)
        request(events)
        return events
      }
    }
  }

  // ---- measuring and the layers ----------------------------------------------------------------------------------------------------------
  const rootMatrix = (entry: Placed): any => {
    const m = new three.Matrix4().copy(entry.root.matrixWorld).invert()
    return m.multiply((entry.item.vehicle as unknown as { vehicle: any }).vehicle.matrixWorld)
  }
  const measure = (entry: Placed): { length: number; width: number; height: number } => {
    if (entry.size) return entry.size
    entry.root.updateMatrixWorld(true)
    const inverse = new three.Matrix4().copy(entry.root.matrixWorld).invert()
    const bounds = new three.Box3()
    const low = new three.Box3()
    const piece = new three.Box3()
    const matrix = new three.Matrix4()
    entry.root.traverse((mesh: any) => {
      if (!mesh.isMesh || !mesh.geometry || mesh.userData.ghost) return
      for (let p = mesh; p; p = p.parent) if (p.visible === false) return
      if (mesh.userData.helper) return
      mesh.geometry.computeBoundingBox()
      piece.copy(mesh.geometry.boundingBox).applyMatrix4(matrix.multiplyMatrices(inverse, mesh.matrixWorld))
      bounds.union(piece)
      if (piece.min.y < BODY_HEIGHT) low.union(piece)
    })
    const size = bounds.getSize(new three.Vector3())
    entry.size = { length: size.z, width: size.x, height: size.y }
    if (!low.isEmpty()) entry.footprint = { minX: low.min.x, maxX: low.max.x, minZ: low.min.z, maxZ: low.max.z }
    return entry.size
  }
  const clearHelpers = (): void => {
    for (const entry of placed.values()) {
      for (const helper of entry.helpers) helper.parent?.remove(helper)
      entry.helpers = []
    }
    for (const axis of axes) axis.parent?.remove(axis)
    axes = []
    helpersShown = ''
  }
  const boxKey = (): string => `${host?.bench?.layer('damageables')}|${host?.bench?.layer('zones')}|${host?.bench?.layer('axes')}|${placed.size}`
  const refreshLayers = (): void => {
    if (!host?.bench || !three) return
    clearHelpers()
    const kit = [...placed.values()][0] && ((([...placed.values()][0] as Placed).root.userData.kit as VehicleKit | undefined) ?? undefined)
    const mark = (entry: Placed, box: any, color: number): void => {
      const helper = new three.Box3Helper(box, color)
      helper.userData.helper = true
      entry.root.add(helper)
      entry.helpers.push(helper)
    }
    if (kit) {
      for (const entry of placed.values()) {
        if (!entry.root.parent) continue
        entry.root.updateMatrixWorld(true)
        const matrix = rootMatrix(entry)
        if (host.bench.layer('damageables')) for (const d of kit.damageables(entry.item.vehicle, matrix) as { material: string; box: any }[]) mark(entry, d.box, MATERIAL_COLOURS[d.material] ?? 0xffffff)
        if (host.bench.layer('zones')) {
          for (const zone of (entry.item.vehicle as unknown as { zones: { type: string; box?: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number } }[] }).zones ?? []) {
            if (!zone.box || zone.type === 'internal') continue
            const box = new three.Box3(new three.Vector3(zone.box.x0, zone.box.y0, zone.box.z0), new three.Vector3(zone.box.x1, zone.box.y1, zone.box.z1)).applyMatrix4(matrix)
            mark(entry, box, ZONE_COLOURS[zone.type] ?? 0xffffff)
          }
        }
      }
    }
    if (host.bench.layer('axes')) {
      const front = new three.ArrowHelper(new three.Vector3(0, 0, 1), new three.Vector3(0, 0.05, 0), 3, 0x3366ff)
      const right = new three.ArrowHelper(new three.Vector3(-1, 0, 0), new three.Vector3(0, 0.05, 0), 3, 0xff3333)
      const up = new three.ArrowHelper(new three.Vector3(0, 1, 0), new three.Vector3(0, 0.05, 0), 3, 0x33cc33)
      for (const arrow of [front, right, up]) {
        ;(host.scene as any).add(arrow)
        axes.push(arrow)
      }
    }
    helpersShown = boxKey()
  }

  // ---- the walking player ------------------------------------------------------------------------------------------------------------------
  // every vehicle on the floor (and the car on the lane) is solid: the point is taken into the vehicle's own space, so a turned vehicle blocks by its turned footprint
  const laneBlocked = footprintBlocker(
    () => lane?.group,
    () => (lane ? { minX: -lane.car.width / 2, maxX: lane.car.width / 2, minZ: -lane.car.length / 2, maxZ: lane.car.length / 2 } : null),
  )
  const blocked = (x: number, z: number, radius: number): boolean => {
    for (const entry of placed.values()) if (entry.footprint && footprintBlocker(entry.root, entry.footprint)(x, z, radius)) return true
    return laneBlocked(x, z, radius)
  }

  // ---- the lane ---------------------------------------------------------------------------------------------------------------------------
  const clearLane = (): void => {
    stopEngine()
    if (!lane) return
    lane.group.parent?.remove(lane.group)
    lane.wall.parent?.remove(lane.wall)
    lane = null
  }
  const startLane = (): void => {
    if (!host || !three) return
    clearLane()
    const kit = kitFor(three)
    const vehicles = createVehiclesThree(three, { kit })
    const built = vehicles.build('compact_hatch', { quality: 'lite', seed: settings.seed })
    const wall = new three.Mesh(new three.BoxGeometry(0.6, 2, 6), new three.MeshStandardMaterial({ color: 0x777777 }))
    wall.position.set(LANE.wall + 0.3, 1, LANE.z)
    const scene = host.scene as any
    scene.add(built.group, wall)
    const mode = settings.driving === 'semi' ? 'semi' : 'arcade'
    const surfaces = createSurfaces()
    const idle = { throttle: 0, brake: 0, steer: 0, handbrake: false }
    const state = { time: 0, exhaust: 0, ended: false, wasBlocked: false }
    const arcade = createArcadeDriver({ length: built.length, width: built.width })
    const semi = createSemiSimDriver({}, { surfaces })
    const driver = mode === 'semi' ? semi : arcade
    driver.place(LANE.from, LANE.z, 0)
    const gap = (): number => LANE.wall - (driver.state.x + built.length / 2)
    // brakes when the stopping distance (at the rule's deceleration, the surface's grip in the semi mode) plus a margin reaches the wall
    const decel = (): number => (mode === 'semi' ? 9 * surfaces.get(settings.surface).grip : arcade.spec.brakeAgainstMotion)
    const brakeAt = (): number => (lane ? (lane.speed() * lane.speed()) / (2 * decel()) + 3 : 3)
    const pose = (): void => {
      built.group.position.set(driver.state.x, 0, driver.state.z)
      built.group.rotation.y = driver.state.yaw + Math.PI / 2
    }
    pose()
    engineLoop = audio()?.loop?.(soundIds.engine, { position: [driver.state.x, 0.5, driver.state.z] })
    const log = (key: 'crash' | 'end', value: number): void => host?.log(fill(text, locale, text.lane[key], value.toFixed(1)))
    lane = {
      car: built,
      group: built.group,
      wall,
      mode,
      done: false,
      stopped: 0,
      speed: () => ('u' in driver.state ? (driver.state as { u: number }).u : (driver.state as { v: number }).v),
      distance: () => driver.state.x - LANE.from,
      step(dt) {
        if (state.ended) return
        state.time += dt
        const braking = gap() < brakeAt() && state.time > 0.5
        const input = { ...idle, throttle: braking ? 0 : 1, brake: braking ? 1 : 0, steer: Math.sin(state.time * 1.4) * 0.15 }
        if (mode === 'arcade') {
          const { events } = arcade.step(input, dt, { blocked: (x, z, yaw) => vehicleCorners(arcade.spec, x, z, yaw).some(([px]) => px >= LANE.wall) })
          for (const e of events) {
            if (e.type !== 'crash') continue
            log('crash', e.speed)
            audio()?.play({ sound: soundIds.crash, position: [driver.state.x, 0.5, driver.state.z], volume: Math.min(1, e.speed / 15) })
          }
        } else {
          semi.step(input, dt, { ground: () => ({ surface: settings.surface }) })
          if (gap() <= 0) {
            state.ended = true
            log('crash', Math.abs((semi.state as { u: number }).u))
            audio()?.play({ sound: soundIds.crash, position: [driver.state.x, 0.5, driver.state.z], volume: Math.min(1, Math.abs((semi.state as { u: number }).u) / 15) })
          }
        }
        pose()
        {
          const speed = Math.abs(lane?.speed() ?? 0)
          // the game's engine (jogo L70421): level 0.035 + speed x 0.003, frequency 38 + speed x 7
          engineLoop?.set({ volume: state.ended ? 0 : 0.035 + speed * 0.003, frequency: 38 + speed * 7, position: [driver.state.x, 0.5, driver.state.z] })
        }
        state.exhaust -= dt
        const fx = effects()
        if (fx && state.exhaust <= 0 && Math.abs(lane?.speed() ?? 0) > 0.5) {
          state.exhaust = 0.4
          fx.play({ effect: effectIds.exhaust, point: [driver.state.x - Math.cos(driver.state.yaw) * (built.length / 2), 0.3, driver.state.z + Math.sin(driver.state.yaw) * (built.length / 2)], scale: Math.min(1, Math.abs(lane?.speed() ?? 0) / 17) })
        }
        if (!state.ended && state.time > 1 && Math.abs(lane?.speed() ?? 0) < 0.05) {
          state.ended = true
          log('end', Math.max(0, gap()))
        }
      },
    }
  }

  // ---- the bench ----------------------------------------------------------------------------------------------------------------------------
  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') return refreshLayers()
    if (change.kind === 'action') {
      if (change.id === 'repaint') for (const entry of placed.values()) paintOf(entry)
      else if (change.id === 'drive_lane') startLane()
      else if (change.id === 'clear_lane') clearLane()
      else if (change.id === 'honk') audio()?.play({ sound: soundIds.horn, position: lane ? [lane.group.position.x, 1, lane.group.position.z] : undefined })
      return
    }
    switch (change.id) {
      case 'quality': settings.quality = String(change.value); break
      case 'paint_by_seed': settings.paint = Boolean(change.value); for (const entry of placed.values()) paintOf(entry); break
      case 'color_seed': settings.seed = Number(change.value); for (const entry of placed.values()) paintOf(entry); break
      case 'palette': settings.palette = String(change.value); for (const entry of placed.values()) paintOf(entry); break
      case 'driving': settings.driving = String(change.value); break
      case 'surface': settings.surface = String(change.value); break
      default: break
    }
  }

  const frame = (dt: number): void => {
    for (const [id, entry] of placed) {
      if (!entry.root.parent) {
        placed.delete(id)
        continue
      }
      measure(entry)
    }
    if (host?.bench && boxKey() !== helpersShown && (host.bench.layer('damageables') || host.bench.layer('zones') || helpersShown !== '')) refreshLayers()
    lane?.step(dt)
  }

  const count = (): { drawCalls: number; triangles: number } => {
    let drawCalls = 0
    let triangles = 0
    for (const entry of placed.values()) {
      entry.root.traverse((mesh: any) => {
        if (!mesh.isMesh || mesh.userData.helper) return
        for (let p = mesh; p; p = p.parent) if (p.visible === false) return
        drawCalls += 1
        const g = mesh.geometry
        triangles += (g.index ? g.index.count : g.attributes.position.count) / 3
      })
    }
    return { drawCalls, triangles: Math.round(triangles) }
  }
  const boxesOf = (material: string): number => {
    let total = 0
    for (const entry of placed.values()) {
      const kit = entry.root.userData.kit as VehicleKit | undefined
      if (kit) total += (kit.damageables(entry.item.vehicle) as { material: string }[]).filter((d) => d.material === material).length
    }
    return total
  }
  const sizeError = (): number => {
    let worst = 0
    for (const entry of placed.values()) {
      const want = fleetDims(entry.key)
      const got = entry.size
      if (!want || !got || entry.scenario) continue
      worst = Math.max(worst, Math.abs(got.length - want.length), Math.abs(got.width - want.width), Math.abs(got.height - want.height))
    }
    return Math.round(worst * 1000)
  }

  return {
    id: VEHICLES_AREA_ID,
    name: text.name,
    group: text.group,
    get placed() {
      return placed
    },
    items: () => entries.map(item),
    area: (): ModuleArea => {
      // the front row, each vehicle given room by its width, the front to +z; what is wider than a street (a helicopter with its rotor) stands alone in a row behind
      const gap = 1.6
      const WIDE = 6
      const rowOf = (list: readonly Entry[], z: number) => {
        let cursor = 0
        const spots = list.map((entry) => {
          const width = fleetDims(entry.key)?.width ?? 2
          const x = cursor + width / 2
          cursor += width + gap
          return { id: entry.id, x }
        })
        return { spots, z, width: Math.max(0, cursor - gap) }
      }
      const front = rowOf(entries.filter((e) => (fleetDims(e.key)?.width ?? 2) <= WIDE), 0)
      const back = rowOf(entries.filter((e) => (fleetDims(e.key)?.width ?? 2) > WIDE), -16)
      const placements = [front, back].flatMap((row) => row.spots.map(({ id, x }) => ({ item: id, position: [x - row.width / 2, 0, row.z] as Vec3, rotationY: 0 })))
      return { placements, view: { eye: [0, 5, Math.max(14, front.width * 0.6)], target: [0, 1, -2] } }
    },
    controls: (): ModuleControl[] => {
      const surfaceIds = createSurfaces().surfaces.map((s) => s.id)
      return [
        { kind: 'choice', id: 'quality', name: text.controls.quality, hint: text.hints.quality, options: (['high', 'lite'] as const).map((id) => ({ id, name: text.options.quality[id] as string })), default: 'high' },
        { kind: 'boolean', id: 'paint_by_seed', name: text.controls.paint_by_seed, hint: text.hints.paint_by_seed, default: false },
        { kind: 'number', id: 'color_seed', name: text.controls.color_seed, min: 0, max: 999, step: 1, default: 1 },
        { kind: 'choice', id: 'palette', name: text.controls.palette, hint: text.hints.palette, options: (['auto', 'civil', 'military'] as const).map((id) => ({ id, name: text.options.palette[id] as string })), default: 'auto' },
        { kind: 'choice', id: 'driving', name: text.controls.driving, hint: text.hints.driving, options: (['arcade', 'semi'] as const).map((id) => ({ id, name: text.options.driving[id] as string })), default: 'arcade' },
        { kind: 'choice', id: 'surface', name: text.controls.surface, hint: text.hints.surface, options: surfaceIds.map((id) => ({ id, name: text.options.surface[id] ?? id })), default: 'dry_asphalt' },
        { kind: 'action', id: 'repaint', name: text.actions.repaint },
        { kind: 'action', id: 'drive_lane', name: text.actions.drive_lane },
        { kind: 'action', id: 'clear_lane', name: text.actions.clear_lane },
        { kind: 'action', id: 'honk', name: text.actions.honk },
      ]
    },
    layers: (): ModuleLayer[] => (['damageables', 'zones', 'axes'] as const).map((id) => ({ id, name: text.layers[id], default: false })),
    metrics: (): ModuleMetric[] => [
      { id: 'vehicles', name: text.metrics.vehicles, read: () => placed.size },
      { id: 'triangles', name: text.metrics.triangles, read: () => count().triangles },
      { id: 'draw_calls', name: text.metrics.draw_calls, read: () => count().drawCalls },
      { id: 'size_error_mm', name: text.metrics.size_error_mm, unit: 'mm', read: sizeError },
      { id: 'metal', name: text.metrics.metal, read: () => boxesOf('metal') },
      { id: 'glass', name: text.metrics.glass, read: () => boxesOf('glass') },
      { id: 'rubber', name: text.metrics.rubber, read: () => boxesOf('rubber') },
      { id: 'fuel', name: text.metrics.fuel, read: () => boxesOf('fuel') },
      { id: 'speed', name: text.metrics.speed, unit: 'km/h', digits: 0, read: () => Math.round(Math.abs(lane?.speed() ?? 0) * 3.6) },
      { id: 'lane', name: text.metrics.lane, unit: 'm', digits: 1, read: () => lane?.distance() ?? 0 },
    ],
    scenarios: (): ModuleScenario<VehiclesContext>[] => createScenarios({ text, locale }),
    attach(lent) {
      host = lent
      three = lent.THREE
      const stopChange = lent.bench?.onChange(onChange)
      const stopFrame = lent.onFrame(frame)
      const stopBlocker = lent.addBlocker?.(blocked)
      // the engine loop and the horn live in the library bank of game-audio, which the room's engine does not carry on its own
      lent.audio?.register?.(LIBRARY_BANK)
      return () => {
        stopChange?.()
        stopFrame()
        stopBlocker?.()
        clearHelpers()
        clearLane()
        host = null
      }
    },
  }
}

/** What `loadVehiclesTestModule` needs of a room: `TestRoom.loadModule` has it. */
export type ModuleRoomLike = { loadModule(module: never): unknown }

/**
 * Loads the vehicles module into a room. The door, hood and trunk clips of the items are computed when the room reads the items, before the module is lent the room's three.js
 * (`attach`), so this first lends an empty module to learn the namespace and then loads the real one with it. Pass `three` to skip that.
 */
export function loadVehiclesTestModule<Room extends ModuleRoomLike>(room: Room, options: VehiclesTestOptions = {}): ReturnType<Room['loadModule']> {
  let three = options.three
  if (!three) {
    room.loadModule({ id: 'vehicles_probe', name: 'Vehicles probe', group: 'Vehicles', items: () => [], attach: (lent: ModuleHost) => { three = lent.THREE; return () => undefined } } as never)
  }
  return room.loadModule(createVehiclesTestModule({ ...options, three }) as never) as ReturnType<Room['loadModule']>
}
