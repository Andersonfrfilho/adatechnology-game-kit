import { checkSpec } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { wallPiece, wallPlan } from '../src'
import { THREE } from './helpers/houses'
import { fakeDocument } from './helpers/fake-document'

/** What the tests read of a part of the structure. */
type StructurePiece = { id: string; role: string; aabb: number[]; y0: number; y1: number }

const make = () => wallPiece(THREE, { w: 10, h: 3, house: { document: fakeDocument } })

describe('wallPiece', () => {
  it('stands as a house wall: the wall on its ground beam, its concrete pillars and the bond beam on both, no roof', () => {
    const plan = wallPlan({ w: 10, h: 3 })
    expect(plan.construction.system).toBe('masonry')
    expect(plan.construction.foundation.type).toBe('strip_footing')
    const parts = plan.structure.parts.map((p) => `${p.id}:${p.role}:${p.material}`)
    const pillars = ['wall_column_0_0', 'wall_column_0_1', 'wall_column_0_2', 'wall_column_0_3']
    expect(parts).toEqual(['ground_beam_0:beam:concrete', 'wall_0_0:wall:brick', 'plate_0_0:beam:concrete', ...pillars.map((id) => `${id}:column:concrete`)])
    // one at each end of the 10 m wall, flush with it, and two between them: three spans of 3.2 m, none over 4 m
    const centres = plan.structure.parts.filter((p: StructurePiece) => p.role === 'column').map((p: StructurePiece) => Math.round(((p.aabb[0] + p.aabb[2]) / 2) * 100) / 100)
    expect(centres).toEqual([-4.9, -1.63, 1.63, 4.9])
    for (const pillar of plan.structure.parts.filter((p: StructurePiece) => p.role === 'column')) {
      expect([pillar.y0, pillar.y1]).toEqual([0, plan.structure.parts.find((p: StructurePiece) => p.id === 'wall_0_0')!.y1])
      expect(pillar.aabb[3] - pillar.aabb[1]).toBeCloseTo(0.2)
    }
    expect(plan.structure.supports.map((s) => `${s.part}>${s.on}:${s.joint}`)).toEqual([
      'ground_beam_0>ground:rebar', 'wall_0_0>ground_beam_0:mortar', 'plate_0_0>wall_0_0:mortar', ...pillars.flatMap((id) => [`${id}>ground:rebar`, `plate_0_0>${id}:rebar`]),
    ])
  })

  it('keeps the bond beam up on the pillars when the bricks under it are gone', () => {
    const { spec } = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(spec, { id: 'target' })
    world.hitPart(id, 'wall_0_0', { type: 'blunt', point: [0, 1.5, 0], energy: 5e7, radius: 0.05, source: 'test' })
    for (let t = 0; t < 30; t += 0.1) world.update(0.1)
    const state = world.state(id)!.parts
    const status = (part: string) => state.find((p) => p.id === part)?.status
    expect(status('wall_0_0')).toBe('broken')
    expect(['intact', 'damaged']).toContain(status('plate_0_0'))
    expect(state.filter((p) => p.id.startsWith('wall_column_')).every((p) => p.status === 'intact' || p.status === 'damaged')).toBe(true)
  })

  it('gives the spec a house gives: the plastered brick wall with its units and breach, the bond beam with rebar', () => {
    const { spec } = make()
    const wall = spec.parts.find((p) => p.id === 'wall_0_0')
    expect(wall!.layers!.some((l) => l.material === 'plaster')).toBe(true)
    expect(wall!.units).toBeTruthy()
    expect(wall!.breach).toBeTruthy()
    expect(spec.parts.find((p) => p.id === 'plate_0_0')!.reinforcement).toBeTruthy()
    expect(spec.joints!.map((j) => j.id)).toEqual(expect.arrayContaining(['ground_beam_0~ground', 'wall_0_0~ground_beam_0', 'plate_0_0~wall_0_0']))
    // the ground beam is buried foundation: anchored, it never falls
    expect(spec.parts.find((p: { id: string }) => p.id === 'ground_beam_0')).toMatchObject({ anchored: true, structure: { role: 'foundation' } })
    const report = checkSpec(spec, { materials: createDestruction({ seed: 1 }).materials.keys() })
    expect(report.problems).toEqual([])
  })

  it('draws nothing outside the wall when shots knock the bricks out of its corners and ends', () => {
    const piece = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(piece.spec, { id: 'target' })
    const root = piece.build(THREE)
    const follower = piece.follow(root, world, id)!
    // the drawn wall: 10 m along x centred on the origin, 3 m high, 15 cm thick, 20 cm at its pillars (the structure's part reaches past its ends by half the thickness)
    const wall = new THREE.Box3(new THREE.Vector3(-5, 0, -0.1), new THREE.Vector3(5, 3, 0.1))
    const rifle = (x: number, y: number) => world.shoot([x, y, 5], [0, 0, -1], 2100, 7.62, 'test')
    for (const [x, y] of [[-4.97, 2.97], [-4.9, 2.85], [-4.97, 1.5], [-4.85, 1.5], [4.97, 2.97], [4.95, 0.6]]) for (let i = 0; i < 4; i++) rifle(x!, y!)
    follower.update()
    const units = root.getObjectByName('breach:wall_0_0') as THREE.InstancedMesh
    expect(units.count).toBeGreaterThan(0)
    root.updateMatrixWorld(true)
    const drawn = new THREE.Box3(), cell = new THREE.Box3(), m = new THREE.Matrix4()
    units.geometry.computeBoundingBox()
    for (let i = 0; i < units.count; i++) {
      units.getMatrixAt(i, m)
      drawn.union(cell.copy(units.geometry.boundingBox!).applyMatrix4(m).applyMatrix4(units.matrixWorld))
    }
    expect(drawn.min.x).toBeGreaterThanOrEqual(wall.min.x - 1e-6)
    expect(drawn.max.x).toBeLessThanOrEqual(wall.max.x + 1e-6)
    expect(drawn.max.y).toBeLessThanOrEqual(wall.max.y + 1e-6)
    expect(drawn.min.z).toBeGreaterThanOrEqual(wall.min.z - 1e-6)
    expect(drawn.max.z).toBeLessThanOrEqual(wall.max.z + 1e-6)
    follower.dispose()
  })

  // the frag grenade of the room (M67 of game-weapons: 200 kJ, out to 15 m) going off 40 cm in front of the wall, 30 cm over the floor
  const grenade = (world: ReturnType<typeof createDestruction>, x: number) => world.explode([x, 0.3, 0.4], 200000, 15, 'test')
  const blown = (events: DestructionEvent[]) => events.flatMap((e) => (e.type === 'chip' && e.units ? e.units : []))

  it.each([['at the end', 4.55], ['in the middle', 0]])('a grenade %s of the wall knocks out a ragged hole around it and the rest of the wall stands', (_where, x) => {
    const piece = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(piece.spec, { id: 'target' })
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    grenade(world, x)
    for (let i = 0; i < 20; i++) world.update(0.1)
    // the glazed tiles of the baseboard (and the sidewalk slabs) glued at the foot of the wall are finish, not structure: the ones by the blast break off
    const finish = (part: string): boolean => part.startsWith('baseboard:') || part.startsWith('sidewalk:')
    const structural = events.filter((e) => (e.type === 'collapse' || e.type === 'detach' || e.type === 'fracture') && !(('part' in e && finish(String(e.part))) || ('parts' in e && (e.parts as string[]).some(finish))))
    expect(structural).toEqual([])
    const tiles = world.state(id)!.parts.filter((part) => part.id.startsWith('baseboard:'))
    const near = tiles.filter((tile) => Math.abs((piece.spec.parts.find((p: { id: string }) => p.id === tile.id)?.position[0] ?? 99) - x) < 0.5)
    expect(near.some((tile) => tile.status !== 'intact')).toBe(true)
    const wall = world.part(id, 'wall_0_0')!
    expect(wall.status).toBe('damaged')
    const units = blown(events)
    const area = units.reduce((sum, unit) => sum + unit.size[0] * unit.size[1], 0)
    // about a square metre of a 28 m² wall, around the grenade
    expect(area).toBeGreaterThan(0.6)
    expect(area / (10.15 * 2.8)).toBeLessThan(0.08)
    for (const unit of units) expect(Math.abs(unit.center[0] - x)).toBeLessThan(1.4)
    // the edge follows the bricks and is not a smooth outline: the courses end at different places
    const ends = new Map<number, number>()
    for (const unit of units) {
      const row = Math.round(unit.center[1] / 0.075)
      // the side of the hole toward the middle of the wall (at its end, the other side is the end of the wall)
      ends.set(row, Math.min(ends.get(row) ?? Infinity, unit.center[0]))
    }
    expect(new Set([...ends.values()].map((v) => v.toFixed(2))).size).toBeGreaterThan(3)
  })

  // an AT4 (200 kJ) going off on the face of a bay: the whole bay between its pillars comes out, and every brick drawn at the cut is one the world still has
  it.each([['the middle bay', 0], ['the right bay', 3.27], ['the left bay', -3.27]])('a rocket in %s draws no brick the world knocked out (nothing left hanging at the pillars)', (_bay, x) => {
    const piece = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(piece.spec, { id: 'target' })
    const root = piece.build(THREE)
    const follower = piece.follow(root, world, id)!
    world.explode([x, 1.4, 0.3], 200000, 16, 'test')
    for (let i = 0; i < 20; i++) world.update(0.1)
    follower.update()
    const wall = world.part(id, 'wall_0_0')!
    const at = piece.spec.parts.find((p: { id: string }) => p.id === 'wall_0_0')!.position as number[]
    const gone = (wall.chipped ?? []).map((c) => ({ x0: at[0]! + c.center[0] - c.size[0] / 2, x1: at[0]! + c.center[0] + c.size[0] / 2, y0: at[1]! + c.center[1] - c.size[1] / 2, y1: at[1]! + c.center[1] + c.size[1] / 2 }))
    expect(gone.length).toBeGreaterThan(0)
    // the concrete of the pillars is drawn in the same instances; the wall part runs behind them, so only the bricks between them count
    const pillars = piece.spec.parts.filter((p: { id: string }) => p.id.startsWith('wall_column_')).map((p: { position: number[] }) => p.position[0]!)
    const units = root.getObjectByName('breach:wall_0_0') as THREE.InstancedMesh
    root.updateMatrixWorld(true)
    const m = new THREE.Matrix4(), p = new THREE.Vector3()
    const hanging: number[][] = []
    for (let i = 0; i < units.count; i++) {
      units.getMatrixAt(i, m)
      p.setFromMatrixPosition(m).applyMatrix4(units.matrixWorld)
      if (pillars.some((c: number) => Math.abs(p.x - c) < 0.1 + 1e-4)) continue
      if (gone.some((g) => p.x > g.x0 + 1e-4 && p.x < g.x1 - 1e-4 && p.y > g.y0 + 1e-4 && p.y < g.y1 - 1e-4)) hanging.push([+p.x.toFixed(3), +p.y.toFixed(3)])
    }
    expect(hanging).toEqual([])
    follower.dispose()
  })

  it('a rocket that brings down a bay throws bricks and clumps of a few with flakes of their plaster, not slabs', () => {
    const piece = make()
    const world = createDestruction({ seed: 1 })
    world.add(piece.spec, { id: 'target' })
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    world.explode([0, 1.4, 0.3], 200000, 16, 'test')
    const thrown = events.flatMap((e) => (e.type === 'chip' && e.part === 'wall_0_0' ? e.fragments : []))
    const masonry = thrown.filter((f) => f.material === 'brick'), flakes = thrown.filter((f) => f.material === 'plaster')
    // the bay between the pillars: 3.1 m by 2.8 m, about 400 bricks
    expect(masonry.length).toBeGreaterThan(40)
    // a clump is a brick or a few still held by their mortar (three bricks along, three courses up at most): never a slab of the bay
    for (const f of masonry) {
      expect(Math.max(f.size[0], f.size[1])).toBeLessThan(0.75)
      expect(f.size[0] * f.size[1]).toBeLessThan(0.18)
    }
    expect(flakes.length).toBeGreaterThan(8)
    for (const f of flakes) expect(Math.min(...f.size)).toBeCloseTo(0.02, 3)
    // the mass thrown is the mass of the masonry that came out (2.8 m by 3.1 m by 13 cm of brick at 1900 kg/m³ is about 2 t, less the pillar faces)
    const mass = masonry.reduce((sum, f) => sum + f.mass, 0)
    expect(mass).toBeGreaterThan(800)
    expect(mass).toBeLessThan(2600)
  })

  it('a second grenade somewhere else on the wall cuts a second hole, and shots still knock bricks out beside them', () => {
    const piece = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(piece.spec, { id: 'target' })
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    grenade(world, -3)
    const first = blown(events).length
    grenade(world, 3)
    expect(blown(events).length).toBeGreaterThan(first * 1.5)
    const chipped = world.part(id, 'wall_0_0')!.chipped!.length
    for (let i = 0; i < 4; i++) world.shoot([0, 2, 5], [0, 0, -1], 3500, 7.62, 'test')
    expect(world.part(id, 'wall_0_0')!.chipped!.length).toBeGreaterThan(chipped)
    expect(world.part(id, 'wall_0_0')!.status).toBe('damaged')
  })

  it('a wall that comes down after its holes were drawn is still drawn, whole, by the piece it becomes, where the shots still hit it', () => {
    const piece = make()
    const world = createDestruction({ seed: 7 })
    const scene = new THREE.Scene()
    const renderer = createDestructionRenderer(THREE, { scene, world })
    const id = world.add(piece.spec, { id: 'target', position: [0, 0, -11] })
    const root = piece.build(THREE)
    root.position.set(0, 0, -11)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root)
    const follower = piece.follow(root, world, id)!
    // rifle rounds knock bricks out: the house draws the wall with its holes and takes the plain wall out of the mesh
    for (let i = 0; i < 6; i++) world.shoot([-2 + i * 0.3, 1.6, -5], [0, 0, -1], 2100, 7.62, 'test')
    follower.update()
    // the wall loses its footing and its bond beam (the mortar knocked off with a hammer): it comes down, a piece of its own
    expect(world.disassemble(id, 'wall_0_0~ground_beam_0', 'hammer', 60)).toBe(1)
    expect(world.disassemble(id, 'plate_0_0~wall_0_0', 'hammer', 60)).toBe(1)
    for (let i = 0; i < 120; i++) { world.update(1 / 60); renderer.update(1 / 60); follower.update() }
    scene.updateMatrixWorld(true)
    // the wall itself, not its baseboard or the sidewalk drawn with it
    let wall: THREE.Mesh | undefined
    scene.traverse((o) => { if (o instanceof THREE.Mesh && o.name.endsWith('/wall_0_0') && o.parent?.name.startsWith('destruction-piece-')) wall = o })
    expect(wall).toBeDefined()
    const drawn = new THREE.Box3().setFromObject(wall!, true)
    // whole in the frame of the piece it became (a wall with no footing tips over as it falls: its box in the world leans)
    const own = new THREE.Box3().setFromBufferAttribute(wall!.geometry.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(wall!.matrix)
    expect(own.max.x - own.min.x).toBeGreaterThan(9.9)
    expect(own.max.y - own.min.y).toBeGreaterThan(2.9)
    const hit = world.raycast([0, 1.5, -8], [0, 0, -1], 10)!
    expect(hit.part).toBe('wall_0_0')
    expect(hit.point[1]).toBeGreaterThan(drawn.min.y)
    expect(hit.point[1]).toBeLessThan(drawn.max.y)
    follower.dispose()
  })

  it('shows the concrete of a pillar where shots knock its plaster and cover out, and lays the bricks against it, never across it', () => {
    const piece = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(piece.spec, { id: 'target' })
    const root = piece.build(THREE)
    const follower = piece.follow(root, world, id)!
    // the pillar at x = 1.63 (1.53 to 1.73), and the bricks on both sides of it
    for (const [x, y] of [[1.6, 1.5], [1.65, 1.2], [1.6, 1.8], [1.35, 1.5], [1.9, 1.3]]) for (let i = 0; i < 4; i++) world.shoot([x!, y!, 5], [0, 0, -1], 3500, 7.62, 'test')
    follower.update()
    const units = root.getObjectByName('breach:wall_0_0') as unknown as { count: number; getMatrixAt(i: number, m: InstanceType<typeof THREE.Matrix4>): void; getColorAt(i: number, c: InstanceType<typeof THREE.Color>): void }
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), size = new THREE.Vector3(), colour = new THREE.Color()
    let concrete = 0
    let bricksAcross = 0
    for (let i = 0; i < units.count; i++) {
      units.getMatrixAt(i, m)
      m.decompose(p, q, size)
      if (Math.min(p.x + size.x / 2, 1.73) - Math.max(p.x - size.x / 2, 1.53) <= 1e-3) continue
      units.getColorAt(i, colour)
      if (Math.abs(colour.r - colour.b) < 0.04 && Math.abs(colour.r - colour.g) < 0.04) concrete++
      else bricksAcross++
    }
    expect(concrete).toBeGreaterThan(0)
    expect(bricksAcross).toBe(0)
    // broken down to its cage, the pillar leaves no concrete and no brick takes its place
    let fractured = false
    world.on('fracture', (e) => { if ('part' in e && e.part === 'wall_column_0_2') fractured = true })
    world.hitPart(id, 'wall_column_0_2', { type: 'blunt', point: [1.63, 1.4, 0.1], energy: 5e6, radius: 0.05, source: 'test' })
    world.update(0.1)
    expect(fractured).toBe(true)
    follower.update()
    const repainted = root.getObjectByName('breach:wall_0_0') as unknown as typeof units
    expect(repainted).not.toBe(units)
    let after = 0
    for (let i = 0; i < repainted.count; i++) {
      repainted.getMatrixAt(i, m)
      m.decompose(p, q, size)
      if (Math.min(p.x + size.x / 2, 1.73) - Math.max(p.x - size.x / 2, 1.53) <= 1e-3) continue
      repainted.getColorAt(i, colour)
      if (!(Math.abs(colour.r - colour.b) < 0.04 && Math.abs(colour.r - colour.g) < 0.04)) after++
    }
    expect(after).toBe(0)
    follower.dispose()
  })

  it('is drawn by the house renderer, centred on the origin, with the wall meshes labelled by part', () => {
    const root = make().build(THREE)
    const labelled: string[] = []
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.destructionPart) labelled.push(o.userData.destructionPart) })
    expect(labelled).toContain('wall_0_0')
    const box = new THREE.Box3().setFromObject(root)
    expect(box.min.x).toBeLessThan(-4.9)
    expect(box.max.x).toBeGreaterThan(4.9)
    expect(box.max.y).toBeCloseTo(3, 1)
  })

  it('gives a host the wall with a brick shot out to draw at load: the breach shell and its bare bricks, instanced, so their programs are built before play', () => {
    const probes = make().warmUpProbes(THREE)
    const breach: Array<{ name: string; instanced: boolean }> = []
    ;(probes.group as { traverse(fn: (object: { name?: string; isInstancedMesh?: boolean; isMesh?: boolean }) => void): void }).traverse((object) => {
      if (object.isMesh && object.name?.startsWith('breach')) breach.push({ name: object.name, instanced: object.isInstancedMesh === true })
    })
    expect(breach.some((mesh) => mesh.instanced)).toBe(true)
    expect(breach.some((mesh) => !mesh.instanced)).toBe(true)
    probes.dispose()
  })

  it('a bond beam shot through at one end stays on its wall: the concrete goes there, its bars show there, the rest of it is whole', () => {
    const { spec } = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(spec, { id: 'w' })
    const beam = spec.parts.find((p: { id: string }) => p.id === 'plate_0_0')!
    const [x0, y0, z0] = beam.position
    const end = x0 + (beam.shape as { size: number[] }).size[0]! / 2 - 1
    // two columns of blocks across the whole depth of the beam, a metre from its end: its section is gone there
    for (const x of [end, end - 0.1]) for (const y of [y0 - 0.1, y0, y0 + 0.1]) for (let k = 0; k < 2; k++) {
      world.shoot([x, y, z0 + 5], [0, 0, -1], 3300, 7.62, 'test')
      world.update(1 / 30)
    }
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))
    for (let t = 0; t < 10; t += 1 / 30) world.update(1 / 30)
    const part = world.part(id, 'plate_0_0')!
    expect(part.status).toBe('damaged')
    expect((part as { stripped?: boolean }).stripped).toBeFalsy()
    expect(events.filter((e) => e.type === 'fracture' && e.part === 'plate_0_0')).toEqual([])
  })

  it('a pillar shot through under its top gives there, not as a whole: it stands, and the bond beam rests on the wall and the other pillars', () => {
    const { spec } = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(spec, { id: 'w' })
    const pillar = spec.parts.find((p: { id: string }) => p.id === 'wall_column_0_3')!
    const [x0, y0, z0] = pillar.position
    const top = y0 + (pillar.shape as { size: number[] }).size[1]! / 2
    for (const y of [top - 0.15, top - 0.25]) for (const x of [x0 - 0.05, x0 + 0.05]) for (let k = 0; k < 2; k++) {
      world.shoot([x, y, z0 + 5], [0, 0, -1], 3300, 7.62, 'test')
      world.update(1 / 30)
    }
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))
    for (let t = 0; t < 10; t += 1 / 30) world.update(1 / 30)
    const part = world.part(id, 'wall_column_0_3')!
    expect(part.status).toBe('damaged')
    expect((part as { stripped?: boolean }).stripped).toBeFalsy()
    expect(events.filter((e) => e.type === 'fracture' && e.part === 'wall_column_0_3')).toEqual([])
    expect(['intact', 'damaged']).toContain(world.part(id, 'plate_0_0')!.status)
  })
})
