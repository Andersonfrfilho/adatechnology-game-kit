import type { DestructionEvent } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import { fakeRoom } from './helpers/area-room'
import { TEMPLATES, THREE, houseOf, planOf } from './helpers/houses'

/** A house of the room, built as the area builds it, with every event of its destruction world recorded. */
const roomHouse = (template: string, seed: number) => {
  const room = fakeRoom()
  room.set('template', template)
  room.set('seed', seed)
  room.act('build')
  room.frame(0.2)
  const { house } = room.module.houses[0]!
  const events: DestructionEvent[] = []
  room.world.on('*', (event) => events.push(event))
  return { room, house, id: house.destruction.id!, events }
}
type Scene = ReturnType<typeof roomHouse>

/** A charge of `energy` joules at the house-local point, then three seconds of the world. */
function blastAt({ room, house }: Scene, local: [number, number, number], energy: number): void {
  const at = house.group.localToWorld(new THREE.Vector3(...local))
  room.world.explode([at.x, at.y, at.z], energy, 15)
  room.frame(3, 0.05)
}

/** The box a stretch is drawn in (it is a loose group of the house, not a range of a merged mesh), in world space. */
const drawnBox = (house: House, id: string): THREE.Box3 => {
  house.group.updateMatrixWorld(true)
  return house.structure.meshesOf(id).reduce((all, item) => (item.obj ? all.union(new THREE.Box3().setFromObject(item.obj)) : all), new THREE.Box3())
}

const stretchesOf = (house: House, pattern: RegExp) => house.destruction.spec!.parts.filter((part) => pattern.test(part.id))
const isDrawn = (house: House, id: string): boolean => house.structure.meshesOf(id).some((item) => item.obj?.visible === true)
const hostedBy = (house: House, pattern: RegExp, host: string): string[] => stretchesOf(house, pattern).filter((part) => part.hostedIn === host).map((part) => part.id)
const revealed = (events: readonly DestructionEvent[]): string[] => events.filter((event) => event.type === 'reveal').map((event) => (event as { part: string }).part)
/** The stretch is still part of the house (not a loose piece) and its joint to its host is closed. */
const isHeld = ({ room, id }: Scene, stretch: string, host: string): boolean => {
  const state = room.world.state(id)!
  return state.parts.some((part) => part.id === stretch && part.status !== 'broken') && state.joints.some((joint) => joint.id === `${stretch}~${host}` && !joint.open)
}

describe('the drain runs of a finished house are pieces, hidden in the walls and slabs they run through', () => {
  it('lays the sewer of a bathroom inside its wall, in stretches held by it, and hides what is embedded', () => {
    const scene = roomHouse('single_storey_a', 1)
    const shower = hostedBy(scene.house, /^drain:sewer_pt4/, 'wall_0_10')
    expect(shower.length).toBeGreaterThan(0)
    for (const stretch of shower) {
      expect(isDrawn(scene.house, stretch), stretch).toBe(false)
      expect(scene.room.world.part(scene.id, stretch)!.exposed, stretch).toBeUndefined()
      expect(isHeld(scene, stretch, 'wall_0_10'), stretch).toBe(true)
    }
    // the stub from the fixture to the wall is in the room, in the open: drawn, and not hosted by anything
    const stub = stretchesOf(scene.house, /^drain:sewer_pt4/).filter((part) => part.hostedIn === undefined)
    expect(stub.length).toBeGreaterThan(0)
    expect(isDrawn(scene.house, stub[0]!.id)).toBe(true)
  })

  it('buries them again when the house is put back', () => {
    const scene = roomHouse('single_storey_a', 1)
    const embedded = hostedBy(scene.house, /^drain:sewer_pt4/, 'wall_0_10')
    blastAt(scene, [10.55, 0.1, 6.64], 30000)
    for (const stretch of embedded) expect(isDrawn(scene.house, stretch), stretch).toBe(true)
    scene.house.destruction.restore()
    for (const stretch of embedded) expect(isDrawn(scene.house, stretch), stretch).toBe(false)
  })

  it('a house drawn as the team drew it (every visor flag) has none of them', () => {
    const { house } = houseOf(planOf('casaA', 1), {}, { gutters: 'visor', eave: 'visor', wallCorners: 'visor', ceilings: 'visor', windows: 'visor', segmentLimits: { pipe: Infinity, wiring: Infinity } })
    expect(house.structure.parts.filter((part) => part.id.startsWith('drain:'))).toEqual([])
  })
})

describe('a blast hole in a wall exposes the drain pipe that runs through it', () => {
  // 30 kJ against the east wall of the bathroom of single_storey_a (x 10.92 to 11.09, z 4.92 to 7.29), at the height of the shower's drain
  const AT_SHOWER: [number, number, number] = [10.55, 0.1, 6.64]

  it('shows the stretch in the hole, drawn and no longer hidden, and brings it off the wall', () => {
    const scene = roomHouse('single_storey_a', 1)
    const embedded = hostedBy(scene.house, /^drain:sewer_pt4/, 'wall_0_10')
    blastAt(scene, AT_SHOWER, 30000)
    const shown = revealed(scene.events)
    for (const stretch of embedded) {
      expect(shown, stretch).toContain(stretch)
      expect(isDrawn(scene.house, stretch), stretch).toBe(true)
    }
    const wall = scene.room.world.state(scene.id)!.parts.find((part) => part.id === 'wall_0_10')!
    expect(wall.status).not.toBe('broken')
    expect(wall.chipped?.length).toBeGreaterThan(0)
    // the wall opened under it: its stretch is off the wall (a loose piece, or held by the stretches beside it)
    const joints = scene.events.filter((event) => event.type === 'detach').map((event) => (event as { joint: string }).joint)
    for (const stretch of embedded) expect(joints, stretch).toContain(`${stretch}~wall_0_10`)
  })

  it('exposes only the stretches inside or crossing the hole: the rest of the run stays hidden, embedded and held', () => {
    // 10 kJ in the bathroom upstairs of townhouse: the hole in its wall takes the stretches of the run there, not the ones that go on down through the floor and the wall below
    const scene = roomHouse('townhouse', 3)
    const run = stretchesOf(scene.house, /^drain:sewer_pt6:/).filter((part) => part.hostedIn !== undefined).map((part) => part.id)
    expect(run.length).toBeGreaterThan(6)
    blastAt(scene, [5.75, 2.95, 10.9], 10000)
    const shown = revealed(scene.events).filter((id) => run.includes(id))
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(run.length)
    const hostOf = (id: string): string => stretchesOf(scene.house, new RegExp(`^${id}$`))[0]!.hostedIn!
    for (const stretch of run) {
      if (shown.includes(stretch)) {
        expect(isDrawn(scene.house, stretch), stretch).toBe(true)
        continue
      }
      expect(isDrawn(scene.house, stretch), `${stretch} stays hidden`).toBe(false)
      expect(scene.room.world.part(scene.id, stretch)!.exposed, stretch).toBeUndefined()
      expect(isHeld(scene, stretch, hostOf(stretch)), `${stretch} stays held`).toBe(true)
    }
    // every stretch the hole took lies in a part of the wall that opened (a part it took nothing from keeps its stretches)
    const opened = new Set(scene.room.world.state(scene.id)!.parts.filter((part) => (part.chipped?.length ?? 0) > 0 || part.opening || part.status === 'broken').map((part) => part.id))
    for (const stretch of shown) expect(opened.has(hostOf(stretch)) || !scene.room.world.state(scene.id)!.parts.some((part) => part.id === hostOf(stretch)), stretch).toBe(true)
  })

  it('a hole in the slab over a sewer run exposes it; without the hole it stays hidden', () => {
    // the drain of the bathroom upstairs of townhouse crosses the floor slab (panel slab_1_p6) at its east wall
    const through = (scene: Scene): string[] => hostedBy(scene.house, /^drain:sewer_pt8:/, 'slab_1_p6')
    const calm = roomHouse('townhouse', 3)
    const crossing = through(calm)
    expect(crossing.length).toBeGreaterThan(0)
    blastAt(calm, [7.7, 2.92, 11.35], 40000)
    expect(calm.room.world.state(calm.id)!.parts.find((part) => part.id === 'slab_1_p6')!.opening).toBeUndefined()
    for (const stretch of crossing) expect(isDrawn(calm.house, stretch), `${stretch} before the slab opens`).toBe(false)

    const holed = roomHouse('townhouse', 3)
    blastAt(holed, [7.7, 2.92, 11.35], 120000)
    expect(holed.room.world.state(holed.id)!.parts.find((part) => part.id === 'slab_1_p6')!.opening).toBeDefined()
    for (const stretch of crossing) {
      expect(revealed(holed.events), stretch).toContain(stretch)
      expect(isDrawn(holed.house, stretch), stretch).toBe(true)
    }
    // the run goes on down in the wall of the ground floor, out of the hole's reach, and stays hidden
    const below = hostedBy(holed.house, /^drain:sewer_pt8:/, 'wall_0_12').filter((stretch) => !revealed(holed.events).includes(stretch))
    expect(below.length).toBeGreaterThan(0)
    for (const stretch of below) expect(isDrawn(holed.house, stretch), stretch).toBe(false)
  })
})

describe('a blast at a gutter downpipe', () => {
  it('detaches only stretches the hole reached, and the ones clear of it stay clamped to the wall', () => {
    const scene = roomHouse('single_storey_a', 1)
    const stretches = stretchesOf(scene.house, /^drain:downpipe_0:/).map((part) => part.id)
    expect(stretches.length).toBeGreaterThan(2)
    // 60 kJ at the corner of the front wall, at the height of the top stretch of the downpipe there
    blastAt(scene, [10.9, 1.8, -0.3], 60000)
    const shown = revealed(scene.events).filter((id) => stretches.includes(id))
    const state = scene.room.world.state(scene.id)!
    const detached = stretches.filter((stretch) => !state.parts.some((part) => part.id === stretch) || state.parts.find((part) => part.id === stretch)!.status === 'broken')
    expect(detached.length).toBeGreaterThan(0)
    expect(detached.length).toBeLessThan(stretches.length)
    for (const stretch of detached) expect(shown, `${stretch} came off the wall without a hole at it`).toContain(stretch)
    const clear = stretches.filter((stretch) => !shown.includes(stretch))
    expect(clear.length).toBeGreaterThan(0)
    for (const stretch of clear) expect(isHeld(scene, stretch, 'wall_0_1'), `${stretch} stays clamped`).toBe(true)
  })
})

const CASES = Object.keys(TEMPLATES).flatMap((template) => [1, 2].map((seed) => [template, seed] as const))
const SLEEVE = 0.05
/** Overlap with a solid deeper than this (m) is a stretch inside it: the cap of a slanted pipe cut at a face reaches one pipe radius (2.5 cm of a 50 mm drain) past it, and the stretch in the open goes 2 mm into the solid. */
const OVERLAP = 0.03
const SOLID_ROLES = ['slab', 'wall', 'partition']

describe('the drain runs hold, nothing floats, nothing is a collider without geometry', () => {
  it.each(CASES)('%s, seed %i: every stretch is drawn, is held by a piece that exists (or the ground) and no chain of holds loops', (template, seed) => {
    const { house } = houseOf(planOf(template, seed))
    const stretches = house.structure.parts.filter((part) => part.id.startsWith('drain:'))
    const ids = new Set(house.structure.parts.map((part) => part.id))
    const holds = new Map<string, string[]>()
    for (const support of house.structure.supports) holds.set(support.part, [...(holds.get(support.part) ?? []), support.on])
    const floating: string[] = []
    for (const { id } of stretches) {
      expect(drawnBox(house, id).isEmpty(), `${id} has geometry`).toBe(false)
      // a stretch is held when some chain of holds reaches the ground or a part of the structure that is not itself a drain stretch
      const seen = new Set<string>()
      const reaches = (at: string): boolean => {
        if (at === 'ground') return true
        if (!ids.has(at)) return false
        if (!at.startsWith('drain:')) return true
        if (seen.has(at)) return false
        seen.add(at)
        return (holds.get(at) ?? []).some(reaches)
      }
      if (!reaches(id)) floating.push(id)
    }
    expect(floating).toEqual([])
  })

  it.each(CASES)('%s, seed %i: no sewer stretch crosses a slab or wall: each is clear of it, or inside it and hosted by it', (template, seed) => {
    const { house } = houseOf(planOf(template, seed))
    const solids = house.structure.parts.filter((part) => SOLID_ROLES.includes(part.role)).map((part) => ({ id: part.id, box: new THREE.Box3(new THREE.Vector3(part.aabb[0], part.y0, part.aabb[1]), new THREE.Vector3(part.aabb[2], part.y1, part.aabb[3])) }))
    const hosted = new Map(house.structure.parts.map((part) => [part.id, part.hostedIn as string | undefined]))
    const crossing: string[] = []
    for (const part of house.structure.parts.filter((entry) => /^drain:sewer/.test(entry.id))) {
      const box = drawnBox(house, part.id)
      const lyingIn: string[] = []
      for (const solid of solids) {
        const depth = Math.min(box.max.x - solid.box.min.x, solid.box.max.x - box.min.x, box.max.y - solid.box.min.y, solid.box.max.y - box.min.y, box.max.z - solid.box.min.z, solid.box.max.z - box.min.z)
        if (depth <= OVERLAP) continue
        if (solid.box.clone().expandByScalar(SLEEVE).containsBox(box)) lyingIn.push(solid.id)
        else crossing.push(`${part.id} crosses ${solid.id}`)
      }
      // (a wall over a door goes up into the slab: a stretch there lies in both, and is hosted by one of them)
      if (lyingIn.length && !lyingIn.includes(hosted.get(part.id) ?? '')) crossing.push(`${part.id} lies in ${lyingIn.join(', ')} without being hosted by one of them`)
    }
    expect(crossing).toEqual([])
  })

  it('every loose drain piece the blast leaves has colliders that hug its drawing: boxes, and none without a stretch drawn', () => {
    const scene = roomHouse('single_storey_a', 1)
    blastAt(scene, [10.55, 0.1, 6.64], 30000)
    const loose = scene.room.renderer.pieces().filter((piece) => scene.room.world.state(piece.objectId)?.parts.some((part) => part.id.startsWith('drain:')))
    expect(loose.length).toBeGreaterThan(0)
    for (const piece of loose) {
      const boxes = (piece as unknown as { partBoxes?: ReadonlyArray<{ half: readonly number[] }> }).partBoxes ?? []
      expect(boxes.length, `piece ${piece.objectId}`).toBeGreaterThan(0)
      for (const box of boxes) expect(Math.min(...box.half), `piece ${piece.objectId}`).toBeGreaterThan(0)
      for (const part of scene.room.world.state(piece.objectId)!.parts) expect(isDrawn(scene.house, part.id) || part.status === 'broken', `${part.id} of piece ${piece.objectId} is drawn`).toBe(true)
    }
  })
})
