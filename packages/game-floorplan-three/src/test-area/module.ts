import { DEFERRED_PRIORITY, DEFERRED_QUEUE_ID } from '@adatechnology/game-contracts'
import { isLightBudget } from '@adatechnology/game-render-three'
import type { BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableItem, TestableModule } from '@adatechnology/game-contracts'

import { create } from '../create.js'
import { planLod } from '../statics.js'
import { createHouseScenarios, SPECIMEN_AT } from './scenarios.js'
import type { AreaContext } from './scenarios.js'
import { buildSpecimenMeshes, DEFAULT_SPECIMENS, specimenSpec } from './specimens.js'
import { fill, TEXT } from './text.js'
import type { AreaText } from './text.js'
import type { FloorplanTestOptions, SpecimenDef, TemplateGroup } from './types.js'

export const FLOORPLAN_AREA_ID = 'floorplan_area'

/** What the Hit button throws at the aimed wall: burst (rounds of `energy` J, caliber), a blow, or a blast (energy, radius). Energies are those of the weapons package (9 mm 486 J, 7.62x51 3300 J, sledge 4 kg at 8 m/s, C4, PG-7V). */
const HITS: Record<string, { kind: 'burst' | 'blow' | 'blast'; rounds?: number; energy: number; caliber?: number; radius?: number }> = {
  burst_9mm: { kind: 'burst', rounds: 9, energy: 486, caliber: 9 },
  burst_762: { kind: 'burst', rounds: 6, energy: 3300, caliber: 7.62 },
  sledge: { kind: 'blow', energy: 128 },
  c4: { kind: 'blast', energy: 345600, radius: 18 },
  rpg: { kind: 'blast', energy: 200000, radius: 16 },
}
const GAP = 4
const EYE = 1.7

/** A template whose storey range starts at this many storeys is a skyscraper. */
const TALL_STOREYS = 10

type Placed = { house: any; plan: any; seed: number; width: number; depth: number }

const bounds = (plan: any): { width: number; depth: number } => ({ width: Number(plan.w) || 10, depth: Number(plan.d) || 10 })

/**
 * The houses test area as a `TestableModule`: any typology of the content packs the page registered (residential, commercial, rural, post-apocalyptic) built with game-floorplan-three from a seed, laid
 * in the room, with the player able to walk in (walls and closed doors stop the walk), use the doors (E), go up and down the floors, see the level of detail (manual, by distance, or shared among a row
 * of houses by a draw-call budget), and hit the walls with what the room throws (its tools, or the bench's hit): the houses register in the room's destruction world, so shots, blows, blasts and fire
 * reach the structure and the room's renderer draws the fracture, the brick courses and the collapse. Dust and sparks are the room's own effects: this module draws no particles.
 * Everything that is a pack of content comes in by option: this package knows no game.
 */
export function createFloorplanTestModule(options: FloorplanTestOptions = {}): TestableModule<AreaContext> & { readonly houses: readonly Placed[]; build(): void; clear(): void; groups(): readonly TemplateGroup[] } {
  const locale = options.locale ?? 'pt-BR'
  const text: AreaText = TEXT[locale] ?? (TEXT['pt-BR'] as AreaText)
  const engine = options.engine
  const arenaSize = options.arenaSize ?? 14

  const known = new Set((engine?.listTemplates() ?? []).map((t) => t.id))
  const groups: TemplateGroup[] = (options.groups ?? [{ id: 'all', templates: [...known] }]).map((g) => ({ ...g, templates: g.templates.filter((id) => known.has(id)) })).filter((g) => g.templates.length > 0)
  const states = (options.states ?? engine?.listStates() ?? ['normal']).filter((id) => typeof id === 'string')
  const groupName = (g: TemplateGroup): string => g.name?.[locale] ?? g.name?.en ?? g.id
  const templateName = (id: string): string => (engine?.translate ? engine.translate('templates', id, locale) : id)
  const stateName = (id: string): string => text.options.state[id] ?? id
  const firstTemplate = options.template && known.has(options.template) ? options.template : (groups[0]?.templates[0] ?? '')
  const groupOf = (template: string): TemplateGroup | undefined => groups.find((g) => g.templates.includes(template))

  const settings = {
    group: groupOf(firstTemplate)?.id ?? groups[0]?.id ?? 'all',
    template: firstTemplate,
    state: states.includes('normal') ? 'normal' : (states[0] ?? 'normal'),
    seed: options.seed ?? 1,
    quality: 'game',
    lod: 'auto',
    houses: 1,
    budget: 400,
    floorView: 'all',
    hit: 'burst_9mm',
  }

  let host: ModuleHost | null = null
  let THREE: any = null
  let houseRenderer: any = null
  let houseRendererKey = ''
  // the breach paint of the current house renderer, run by the host's frame budget when it has one
  let stopPaintQueue: (() => void) | undefined
  // the room lights of the `room_lights` layer: the house's own lamps, masked by the walls, leased from the host's light budget
  let roomLights: any = null
  const placed: Placed[] = []
  let time = 0
  let dirty = false
  let dirtyAt = 0
  let sinceSheet = 0
  let lastSheet = ''
  let planned = 0
  let lastPlan = 0
  let floorNow = 0
  let aimText = ''
  const removers: Array<() => void> = []

  const specimens: readonly SpecimenDef[] = (options.specimens ?? DEFAULT_SPECIMENS).filter((def) => known.has(def.template))
  const specimenItem = (def: SpecimenDef): TestableItem => ({
    id: def.id,
    name: def.name?.[locale] ?? text.specimens[def.id] ?? def.id,
    movable: false,
    build: (T: unknown) => {
      const { spec } = specimenSpec(T, engine as NonNullable<typeof engine>, def, options.house)
      const root = buildSpecimenMeshes(T, spec)
      root.userData.floorplanSpec = spec
      return root
    },
    spec: (root: unknown) => JSON.parse(JSON.stringify((root as any).userData.floorplanSpec)),
  })

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Houses
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const rendererFor = (): any => {
    const key = `${settings.quality}|${locale}`
    if (!houseRenderer || houseRendererKey !== key) {
      stopPaintQueue?.()
      dropRoomLights()
      houseRenderer?.dispose?.()
      houseRenderer = create(THREE, {
        locale,
        lod: { interior: 10, hide: 40 },
        breachPaintBudgetMs: 4,
        ...options.house,
        ...(options.house?.interactives ? { interactives: { effectSink: () => host?.effects, ...options.house.interactives } } : {}),
        quality: settings.quality as 'game',
        ...(options.world ? { destruction: options.world } : {}),
        ...(options.renderer ? { destructionRenderer: options.renderer } : {}),
      })
      houseRendererKey = key
      const paintQueue = houseRenderer.deferredQueue?.()
      stopPaintQueue = paintQueue ? host?.defer?.(paintQueue, DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_PAINT]) : undefined
    }
    return houseRenderer
  }

  const dropRoomLights = (): void => {
    roomLights?.dispose()
    roomLights = null
  }

  const clearHouses = (): void => {
    for (const p of placed) p.house.dispose()
    placed.length = 0
    lastSheet = ''
  }

  const showAll = (): void => {
    const sel = settings.floorView === 'all' ? -1 : Number(settings.floorView)
    const roof = host?.bench?.layer('roof') ?? true
    const lot = host?.bench?.layer('lot') ?? false
    for (const p of placed) p.house.show({ floor: sel, cut: !roof, lot })
  }

  const applyLod = (): void => {
    if (settings.lod === 'auto') return
    for (const p of placed) p.house.setLod(Number(settings.lod))
  }

  const layout = (): void => {
    const total = placed.reduce((sum, p) => sum + p.width, 0) + GAP * Math.max(0, placed.length - 1)
    const depth = Math.max(...placed.map((p) => p.depth))
    // the houses face the player's side of the room (+z): turned half a circle, so the front of the plan looks at +z; x runs against u
    let x = total / 2
    for (const p of placed) {
      p.house.group.rotation.y = Math.PI
      p.house.group.position.set(x, 0, depth / 2)
      x -= p.width + GAP
      p.house.group.updateMatrixWorld(true)
    }
  }

  const build = (): void => {
    if (!host || !engine || !THREE) {
      host?.log(text.steps.no_engine as string)
      return
    }
    clearHouses()
    const renderer = rendererFor()
    const lot = host.bench?.layer('lot') ?? false
    const night = host.bench?.layer('night') ?? false
    const scene = host.scene as any
    for (let i = 0; i < settings.houses; i++) {
      const seed = settings.seed + i
      const plan = engine.generate(settings.template, { seed, state: settings.state })
      const house = renderer.build(plan, { quality: settings.quality, night, terrain: lot, noPerimeter: !lot })
      scene.add(house.group)
      placed.push({ house, plan, seed, ...bounds(plan) })
    }
    layout()
    for (const p of placed) if (options.world) p.house.destruction.activate()
    showAll()
    applyLod()
    floorNow = 0
    const first = placed[0] as Placed
    host.log(fill(text.steps.built as string, { template: templateName(settings.template), seed: settings.seed, state: stateName(settings.state), parts: first.house.structure.parts.length, floors: first.plan.floors.length }), { template: settings.template, seed: settings.seed, houses: placed.length })
    overview()
  }

  const overview = (): void => {
    if (!host?.bench || placed.length === 0) return
    const depth = Math.max(...placed.map((p) => p.depth))
    const span = placed.reduce((sum, p) => sum + p.width, 0) + GAP * (placed.length - 1)
    const back = Math.min(arenaSize - 0.7, depth / 2 + Math.max(10, span * 0.8))
    host.bench.look([0, 4.5, back], [0, 1.6, 0])
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // The player in the houses
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const cameraWorld = (): { x: number; y: number; z: number } => (host?.camera as any).position
  const floorOf = (p: Placed, y: number): number => {
    let floor = 0
    for (let f = 0; f < p.plan.floors.length; f++) if (p.house.y0(f) <= y - 0.9) floor = f
    return floor
  }
  const toLocal = (p: Placed, x: number, y: number, z: number): { x: number; y: number; z: number } => {
    const v = new THREE.Vector3(x, y, z)
    p.house.group.worldToLocal(v)
    return v
  }
  const nearest = (): Placed | null => {
    if (placed.length === 0 || !host) return null
    const c = cameraWorld()
    let best: Placed | null = null
    let bestD = Infinity
    for (const p of placed) {
      const d = p.house.distance({ x: c.x, y: c.y, z: c.z })
      if (d < bestD) {
        best = p
        bestD = d
      }
    }
    return best
  }
  const eyeOf = (p: Placed): any => {
    const camera = host?.camera as any
    const at = toLocal(p, camera.position.x, camera.position.y, camera.position.z)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).transformDirection(new THREE.Matrix4().copy(p.house.group.matrixWorld).invert())
    return { x: at.x, y: at.y, z: at.z, floor: floorOf(p, camera.position.y), yaw: Math.atan2(forward.x, forward.z), pitch: Math.asin(Math.max(-1, Math.min(1, forward.y))) }
  }
  const blocked = (x: number, z: number, radius: number): boolean => {
    for (const p of placed) {
      const c = toLocal(p, x, 0.5, z)
      const lot = host?.bench?.layer('lot') ?? false
      const pad = lot ? 12 : 1.5
      if (c.x < -pad || c.x > p.width + pad || c.z < -pad || c.z > p.depth + pad) continue
      if (p.house.collide(c.x, c.z, floorOf(p, cameraWorld().y), { radius })) return true
    }
    return false
  }
  const standAt = (p: Placed, u: number, v: number, floor: number, lookU: number, lookV: number): void => {
    if (!host?.bench) return
    const y = p.house.y0(floor) + EYE
    const eye = p.house.group.localToWorld(new THREE.Vector3(u, y, v))
    const target = p.house.group.localToWorld(new THREE.Vector3(lookU, y - 0.1, lookV))
    host.bench.look([eye.x, eye.y, eye.z], [target.x, target.y, target.z])
    floorNow = floor
  }
  const roomsOf = (p: Placed, floor: number): any[] => p.plan.rooms.filter((r: any) => r.floor === floor)
  const centreOf = (r: any): [number, number] => [(r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2]
  const enter = (): void => {
    const p = placed[0]
    if (!p) return
    const door = p.plan.doors.find((d: any) => d.exterior && d.floor === 0) ?? p.plan.doors[0]
    const inside = door ? p.plan.rooms.find((r: any) => r.id === door.opensTo) : roomsOf(p, 0)[0]
    if (!inside) return
    const [u, v] = centreOf(inside)
    standAt(p, u, v, 0, door ? door.u : u, door ? door.v : v + 3)
    host?.log(fill(text.steps.entered as string, { floor: 0 }))
  }
  const goFloor = (delta: number): void => {
    const p = nearest()
    if (!p) return
    const next = floorNow + delta
    if (next < 0 || next >= p.plan.floors.length) {
      host?.log(fill(text.steps.no_floor as string, { floor: next }))
      return
    }
    const rooms = roomsOf(p, next).sort((a, b) => (b.u1 - b.u0) * (b.v1 - b.v0) - (a.u1 - a.u0) * (a.v1 - a.v0))
    const room = rooms[0]
    if (!room) return
    const [u, v] = centreOf(room)
    standAt(p, u, v, next, u, v + 3)
    host?.log(fill(text.steps.floor as string, { floor: next }))
  }
  const useNearest = (): void => {
    const p = nearest()
    if (!p) {
      host?.log(text.steps.no_door as string)
      return
    }
    const target = p.house.target(eyeOf(p))
    if (!target) {
      host?.log(text.steps.no_door as string)
      return
    }
    const fo = target.target
    const reach = fo && host?.reachFor && fo.type === 'swing' && fo.gs?.[0] && fo.handles?.[0] ? doorReach(p, fo) : null
    if (reach && host?.reachFor) {
      // the hand goes to the handle first; the door turns its handle and swings when the hand is on it
      host.reachFor({ ...reach, onGrip: () => void p.house.toggleDoor(fo) })
    } else p.house.interact(eyeOf(p))
    host?.log(fill(text.steps.door as string, { text: String(target.text) }))
  }
  /** The handle of a door leaf of the house in the world (on the player's side of the leaf), and whether opening brings it toward the player. */
  const doorReach = (p: Placed, fo: any): { handle: () => [number, number, number]; hinge: () => [number, number, number]; seconds: number; pull: boolean; locked: boolean } => {
    const g = fo.gs[0]
    const pivot = fo.handles[0].pivot as [number, number, number]
    const at = (angle: number): any => {
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      const v = new THREE.Vector3(pivot[0] * c + pivot[2] * s, pivot[1], -pivot[0] * s + pivot[2] * c).add(g.position)
      return g.parent ? g.parent.localToWorld(v) : v
    }
    const camera = host?.camera as any
    const eye = new THREE.Vector3(camera.position.x, 0, camera.position.z)
    const flat = (v: any): number => Math.hypot(v.x - eye.x, v.z - eye.z)
    const closed = at(0)
    const open = at(fo.rot)
    const opening = !fo.open
    return {
      handle: () => {
        g.updateMatrixWorld(true)
        return g.localToWorld(new THREE.Vector3(pivot[0], pivot[1], pivot[2])).toArray() as [number, number, number]
      },
      hinge: () => g.getWorldPosition(new THREE.Vector3()).toArray() as [number, number, number],
      seconds: fo.locked || fo.blockedFlag ? 0.6 : 0.55,
      pull: opening ? flat(open) <= flat(closed) : flat(closed) <= flat(open),
      locked: !!(fo.locked || fo.blockedFlag),
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Hitting the walls
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const strike = (): void => {
    const world = options.world
    if (!world || !host) return
    const camera = host.camera as any
    const origin = [camera.position.x, camera.position.y, camera.position.z] as [number, number, number]
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const direction = [f.x, f.y, f.z] as [number, number, number]
    const hit = world.raycast(origin, direction, 80)
    if (!hit) {
      host.log(text.steps.no_aim as string)
      return
    }
    const preset = HITS[settings.hit] as (typeof HITS)[string]
    if (preset.kind === 'burst') for (let i = 0; i < (preset.rounds ?? 1); i++) world.hitPart(hit.object, hit.part, { type: 'ballistic', point: hit.point, direction, energy: preset.energy, caliber: preset.caliber ?? 9, source: 'bench' })
    else if (preset.kind === 'blow') world.hitPart(hit.object, hit.part, { type: 'blunt', point: hit.point, energy: preset.energy, radius: 0.05, source: 'bench' })
    else world.explode(hit.point, preset.energy, preset.radius ?? 10, 'bench')
    host.log(fill(text.steps.strike as string, { hit: text.options.hit[settings.hit] ?? settings.hit, part: hit.part }), { object: hit.object, part: hit.part })
  }
  const resetWalls = (): void => {
    for (const p of placed) p.house.destruction.reset()
    host?.log(text.steps.reset as string)
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Bench
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const geometryControls = new Set(['template', 'state', 'seed', 'quality', 'houses'])
  const onChange = (change: BenchChange): void => {
    if (change.kind === 'action') {
      switch (change.id) {
        case 'build': build(); break
        case 'enter': enter(); break
        case 'up': goFloor(1); break
        case 'down': goFloor(-1); break
        case 'door': useNearest(); break
        case 'strike': strike(); break
        case 'reset': resetWalls(); break
        case 'clear': clearHouses(); host?.log(text.steps.cleared as string); break
        default: break
      }
      return
    }
    if (change.kind === 'layer') {
      if (change.id === 'roof') showAll()
      else if (change.id === 'room_lights') dropRoomLights()
      else if (placed.length > 0) {
        dirty = true
        dirtyAt = time
      }
      return
    }
    const value = change.value
    switch (change.id) {
      case 'package': {
        settings.group = String(value)
        const group = groups.find((g) => g.id === settings.group)
        if (group) {
          settings.template = group.templates[0] as string
          host?.bench?.patch('template', { options: group.templates.map((id) => ({ id, name: templateName(id) })), value: settings.template })
        }
        break
      }
      case 'template': settings.template = String(value); break
      case 'state': settings.state = String(value); break
      case 'seed': settings.seed = Number(value); break
      case 'quality': settings.quality = String(value); break
      case 'houses': settings.houses = Number(value); break
      case 'budget': settings.budget = Number(value); break
      case 'lod': settings.lod = String(value); applyLod(); break
      case 'floor_view': settings.floorView = String(value); showAll(); break
      case 'hit': settings.hit = String(value); break
      default: break
    }
    if (geometryControls.has(change.id) && placed.length > 0) {
      dirty = true
      dirtyAt = time
    }
  }

  const choice = (id: keyof AreaText['controls'], ids: readonly string[], fallback: string, names?: Record<string, string>): ModuleControl => ({
    kind: 'choice',
    id,
    name: text.controls[id],
    options: ids.map((optionId) => ({ id: optionId, name: names?.[optionId] ?? optionId })),
    default: fallback,
    ...(id in text.hints ? { hint: text.hints[id as keyof AreaText['hints']] } : {}),
  })

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const stats = (): { parts: number; standing: number; broken: number; holes: number } => {
    const world = options.world
    let parts = 0
    let broken = 0
    let holes = 0
    if (world) {
      for (const p of placed) {
        const state = p.house.destruction.active ? world.state(p.house.destruction.id) : null
        for (const part of state?.parts ?? []) {
          parts++
          if (part.status === 'broken' || part.stripped) broken++
          holes += part.holes?.length ?? 0
        }
      }
    }
    return { parts, standing: parts - broken, broken, holes }
  }
  const sheetOf = (_p: Placed): string => `${settings.template}|${settings.seed}|${settings.state}|${aimText}|${floorNow}`
  const updateSheet = (): void => {
    const p = placed[0]
    if (!host?.bench?.sheet) return
    if (!p) {
      host.bench.sheet(null)
      return
    }
    const key = sheetOf(p)
    if (key === lastSheet) return
    lastSheet = key
    host.bench.sheet({
      kicker: text.sheet.kicker,
      title: templateName(settings.template),
      facts: [
        { label: text.sheet.seed, value: String(settings.seed) },
        { label: text.sheet.state, value: stateName(settings.state) },
        { label: text.sheet.floors, value: String(p.plan.floors.length) },
        { label: text.sheet.size, value: `${p.width} x ${p.depth} m` },
        { label: text.sheet.parts, value: String(p.house.structure.parts.length) },
        { label: text.sheet.look, value: aimText || text.sheet.none },
      ],
    })
  }

  const scenarios = createHouseScenarios(text, options.specimenAt ?? SPECIMEN_AT)
  const typologyScenario: ModuleScenario<AreaContext> = {
    id: 'floorplan_typologies',
    name: locale === 'en' ? 'every typology of every package builds, with structure and floors' : 'toda tipologia de todo pacote constrói, com estrutura e andares',
    run({ expect }) {
      const templates = engine?.listTemplates() ?? []
      // a skyscraper (20 storeys at least) is built at its lowest storey count: the scenario checks that the typology builds, not how tall it can get
      const shortest = (id: string): { floors?: number } => {
        const range = templates.find((t) => t.id === id)?.floorRange
        return range && range[0] >= TALL_STOREYS ? { floors: range[0] } : {}
      }
      for (const group of groups) {
        for (const id of group.templates) {
          const plan = (engine as NonNullable<typeof engine>).generate(id, { seed: 1, ...shortest(id) })
          const house = create(THREE ?? (host?.THREE as any), { locale, ...options.house, destruction: undefined, destructionRenderer: undefined, interactives: undefined, vegetation: undefined, fleet: null }).build(plan, { quality: 'game', terrain: false, noPerimeter: true })
          const ok = house.structure.parts.length > 0 && house.floors.length >= 1 && house.colliders.length > 0
          expect(ok, `${groupName(group)}: ${templateName(id)} (${house.structure.parts.length})`)
          house.dispose()
        }
      }
    },
  }

  return {
    id: FLOORPLAN_AREA_ID,
    name: text.name,
    ground: { surface: 'lawn' },
    group: text.group,
    get houses() {
      return placed
    },
    build,
    clear: clearHouses,
    groups: () => groups,
    items: (): TestableItem[] => (engine ? specimens.map(specimenItem) : []),
    // the houses are built by the bench; the specimens of the scenarios are spawned by them (or by hand, from the catalogue): nothing is laid here but the camera
    area: (): ModuleArea => ({ placements: [], view: { eye: [0, 7, Math.min(arenaSize - 0.7, 16)], target: [0, 1.5, 0] } }),
    controls: (): ModuleControl[] => {
      const group = groups.find((g) => g.id === settings.group) ?? groups[0]
      const controls: ModuleControl[] = []
      if (groups.length > 1) controls.push({ kind: 'choice', id: 'package', name: text.controls.package, options: groups.map((g) => ({ id: g.id, name: groupName(g) })), default: settings.group })
      controls.push(
        { kind: 'choice', id: 'template', name: text.controls.template, hint: text.hints.template, options: (group?.templates ?? []).map((id) => ({ id, name: templateName(id) })), default: settings.template },
        choice('state', states, settings.state, text.options.state),
        { kind: 'number', id: 'seed', name: text.controls.seed, min: 1, max: 999, step: 1, default: settings.seed },
        choice('quality', ['game', 'high'], 'game', text.options.quality),
        choice('lod', ['auto', '0', '1', '2'], 'auto', text.options.lod),
        { kind: 'number', id: 'houses', name: text.controls.houses, hint: text.hints.houses, min: 1, max: 5, step: 1, default: 1 },
        { kind: 'number', id: 'budget', name: text.controls.budget, hint: text.hints.budget, min: 60, max: 2000, step: 10, default: settings.budget },
        choice('floor_view', ['all', '0', '1', '2'], 'all', text.options.floor_view),
        choice('hit', Object.keys(HITS), 'burst_9mm', text.options.hit),
        { kind: 'action', id: 'build', name: text.actions.build, slow: true },
        { kind: 'action', id: 'enter', name: text.actions.enter },
        { kind: 'action', id: 'up', name: text.actions.up },
        { kind: 'action', id: 'down', name: text.actions.down },
        { kind: 'action', id: 'door', name: text.actions.door },
        { kind: 'action', id: 'strike', name: text.actions.strike },
        { kind: 'action', id: 'reset', name: text.actions.reset },
        { kind: 'action', id: 'clear', name: text.actions.clear },
      )
      return controls
    },
    layers: (): ModuleLayer[] => [
      { id: 'roof', name: text.layers.roof, default: true },
      { id: 'lot', name: text.layers.lot, default: false },
      { id: 'night', name: text.layers.night, default: false },
      { id: 'room_lights', name: text.layers.room_lights, default: false },
    ],
    metrics: (): ModuleMetric[] => [
      { id: 'houses_built', name: text.metrics.houses, read: () => placed.length },
      { id: 'parts', name: text.metrics.parts, read: () => stats().parts },
      { id: 'standing', name: text.metrics.standing, read: () => stats().standing },
      { id: 'broken', name: text.metrics.broken, read: () => stats().broken },
      { id: 'holes', name: text.metrics.holes, read: () => stats().holes },
      { id: 'draw_calls', name: text.metrics.draw_calls, max: 2000, read: () => placed.reduce((sum, p) => sum + (p.house.lod === 0 ? p.house.stats.drawCalls : p.house.lod === 1 ? p.house.stats.drawCallsLOD1 : 0), 0) },
      { id: 'triangles', name: text.metrics.triangles, read: () => placed.reduce((sum, p) => sum + (p.house.lod === 0 ? p.house.stats.triangles : p.house.lod === 1 ? p.house.stats.trianglesLod1 : 0), 0) },
      { id: 'lod_nearest', name: text.metrics.lod, read: () => nearest()?.house.lod ?? 0 },
      { id: 'floor', name: text.metrics.floor, read: () => floorNow },
      { id: 'doors_open', name: text.metrics.doors_open, read: () => placed.reduce((sum, p) => sum + p.house.doors.filter((d: any) => d.open).length, 0) },
      { id: 'target', name: text.metrics.target, read: () => aimText || text.sheet.none },
      { id: 'planned', name: text.metrics.planned, read: () => planned },
    ],
    scenarios: (): Array<ModuleScenario<AreaContext>> => [...scenarios, typologyScenario],
    attach(lent) {
      host = lent
      THREE = lent.THREE
      removers.push(lent.addBlocker?.(blocked) ?? (() => undefined))
      removers.push(lent.onClear?.(clearHouses) ?? (() => undefined))
      const stopChange = lent.bench?.onChange(onChange)
      const stopFrame = lent.onFrame((dt) => {
        time += dt
        if (dirty && time - dirtyAt > 0.4) {
          dirty = false
          // a rebuild takes a good part of a second: behind the host's loading indicator when it has one
          if (lent.loading) void lent.loading.busy(text.actions.build, () => build())
          else build()
        }
        const c = cameraWorld()
        const auto = settings.lod === 'auto'
        for (const p of placed) p.house.update(dt, time, auto && placed.length === 1 ? { x: c.x, y: c.y, z: c.z } : undefined)
        if (auto && placed.length > 1 && time - lastPlan > 0.25) {
          lastPlan = time
          planned = planLod(placed.map((p) => p.house), { x: c.x, y: c.y, z: c.z }, settings.budget).total
        }
        sinceSheet += dt
        if (sinceSheet > 0.25) {
          sinceSheet = 0
          const p = nearest()
          const target = p ? p.house.target(eyeOf(p)) : null
          aimText = target ? String(target.text) : ''
          updateSheet()
        }
      })
      // after the host's light budget placed this frame's lights: a blast in a room lights that room, not the walls of the next one
      const stopEffectLights = lent.onFrame(
        () => {
          const budget = lent.lights
          if (!isLightBudget(budget) || placed.length === 0 || !houseRenderer) return
          const houses = placed.map((p) => p.house)
          if (lent.bench?.layer('room_lights') ?? false) {
            roomLights ??= houseRenderer.lighting({ scene: lent.scene, n: 3, shadows: 0, budget })
            roomLights.update(houses, cameraWorld(), {})
            return
          }
          dropRoomLights()
          houseRenderer.effectLights?.({ budget })?.update(houses)
        },
        { phase: 'present', order: 20 },
      )
      // E uses the door or the fixture in reach, like the game
      const onKey = (event: KeyboardEvent): void => {
        if (event.code === 'KeyE' && !event.repeat && placed.length > 0) useNearest()
      }
      globalThis.addEventListener?.('keydown', onKey)
      return () => {
        stopChange?.()
        stopFrame()
        stopEffectLights()
        dropRoomLights()
        globalThis.removeEventListener?.('keydown', onKey)
        for (const remove of removers.splice(0)) remove()
        clearHouses()
        stopPaintQueue?.()
        stopPaintQueue = undefined
        houseRenderer?.dispose?.()
        houseRenderer = null
        host = null
      }
    },
  }
}
