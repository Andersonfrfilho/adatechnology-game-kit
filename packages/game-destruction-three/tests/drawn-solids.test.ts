import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { SeamWorld } from '@adatechnology/game-physics'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

// every drawn fixed thing is a body of the engine: a mode of the engine only (the kit's own solver lands pieces on what it measures itself)
const engineOnly = describe

type Statics = { bodies: Map<string, { held: Map<string, { solid: { mesh?: unknown; half: number[]; center: number[] } }> }> }

const stage = (extra: { groundAt?: (x: number, z: number) => number; terrainAt?: (x: number, z: number) => number } = {}) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const physics = physicsOption() as SeamWorld
  const renderer = createDestructionRenderer(THREE, { physics, scene, world: world.asWorld(), ...extra })
  const statics = (): Statics => (renderer as unknown as { pieceSys: { engine: { statics: Statics } } }).pieceSys.engine.statics
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
  }
  return { scene, world, physics, renderer, statics, run }
}

type Stage = ReturnType<typeof stage>

/** A small block of wood, a piece, held up at `at`. */
const drop = (s: Stage, id: string, at: [number, number, number], half = 0.1) => {
  s.world.addObject(id, [partState('body', 'wood', { mass: 2 })])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(half * 2, half * 2, half * 2))
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(...at)
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.renderer.bind(id, root, { parts: { body: mesh } })
  const piece = s.renderer.makePiece(id)
  return { root, piece, bottom: (): number => root.position.y - half }
}

/** Geometries joined into one, as the house joins its walls: the vertex range of each is the part that draws it. */
const merge = (geometries: THREE.BufferGeometry[]): { geometry: THREE.BufferGeometry; ranges: Array<[number, number]> } => {
  const position: number[] = []
  const normal: number[] = []
  const index: number[] = []
  const ranges: Array<[number, number]> = []
  for (const g of geometries) {
    const base = position.length / 3
    position.push(...(g.getAttribute('position').array as Float32Array))
    normal.push(...(g.getAttribute('normal').array as Float32Array))
    for (const i of g.getIndex()!.array as Uint16Array) index.push(base + i)
    ranges.push([base, position.length / 3])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  geometry.setIndex(index)
  return { geometry, ranges }
}

const placed = (g: THREE.BufferGeometry, at: [number, number, number], turn = 0): THREE.BufferGeometry => {
  g.rotateZ(turn)
  g.translate(...at)
  return g
}

/** A table four metres long (wider than the 3 m the kit's own landing rule gives up on): a top and four legs, a mesh each. */
const wideTable = (s: Stage) => {
  const legIds = ['leg_0', 'leg_1', 'leg_2', 'leg_3']
  s.world.addObject('table', [partState('top', 'wood', { mass: 20 }), ...legIds.map((id) => partState(id, 'wood', { mass: 2 }))])
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.05, 1.2))
  top.position.y = 0.75
  const legs = legIds.map((_, i) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 0.06))
    leg.position.set(i & 1 ? 1.95 : -1.95, 0.37, i & 2 ? 0.5 : -0.5)
    return leg
  })
  const root = new THREE.Group()
  root.add(top, ...legs)
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.renderer.bind('table', root, { parts: { top, ...Object.fromEntries(legIds.map((id, i) => [id, legs[i]!])) } })
  return { top, legs, legIds }
}

/** A floor slab, a roof sheet lying askew and a round column, in one mesh as a house joins its parts. */
// the roof sheet is fibre cement: a drawn fixed part grips by its own material (wood on a 17 degree wooden sheet slides on, dynamic 0.3 against tan 17 = 0.31), and the test is about where the piece lands
const joinedHouse = (s: Stage) => {
  const { geometry, ranges } = merge([
    placed(new THREE.BoxGeometry(3, 0.2, 3), [0, 0.1, 10]),
    placed(new THREE.BoxGeometry(2, 0.04, 2), [0, 2, 20], 0.3),
    placed(new THREE.CylinderGeometry(0.3, 0.3, 1, 16), [0, 0.5, 30]),
  ])
  const mesh = new THREE.Mesh(geometry)
  const root = new THREE.Group()
  root.add(mesh)
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.world.addObject('joined', [partState('slab', 'concrete', { mass: 200 }), partState('sheet', 'concrete', { mass: 20 }), partState('column', 'concrete', { mass: 50 })])
  s.renderer.bind('joined', root, { parts: { slab: { mesh, range: ranges[0]! }, sheet: { mesh, range: ranges[1]! }, column: { mesh, range: ranges[2]! } } })
  return { mesh, ranges }
}

/** A door frame as a house draws it: two posts and a lintel, three boxes in one part, one vertex range. The opening is 0.9 m wide and 2.05 m high. */
const doorFrame = (s: Stage) => {
  const { geometry, ranges } = merge([
    placed(new THREE.BoxGeometry(0.05, 2.1, 0.17), [-0.475, 1.05, 40]),
    placed(new THREE.BoxGeometry(0.05, 2.1, 0.17), [0.475, 1.05, 40]),
    placed(new THREE.BoxGeometry(0.9, 0.05, 0.17), [0, 2.075, 40]),
  ])
  const mesh = new THREE.Mesh(geometry)
  const root = new THREE.Group()
  root.add(mesh)
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.world.addObject('frame', [partState('frame', 'wood', { mass: 12 })])
  s.renderer.bind('frame', root, { parts: { frame: { mesh, range: [ranges[0]![0], ranges[2]![1]] } } })
}

/**
 * A kennel as the household draws it: a floor, a back, two sides, a front with a doorway (two jambs and a lintel) and a flat top, eight boxes in one part. The box around
 * it has a vertex at each corner and its six faces covered, and is air inside: 0.7 x 0.6 x 0.7 m out, boards 3 cm thick, the doorway 0.36 m wide and 0.4 m high.
 */
const kennel = (s: Stage, how: 'ranged' | 'plain' = 'ranged') => {
  const { geometry, ranges } = merge([
    placed(new THREE.BoxGeometry(0.7, 0.03, 0.7), [0, 0.015, 60]),
    placed(new THREE.BoxGeometry(0.7, 0.03, 0.7), [0, 0.585, 60]),
    placed(new THREE.BoxGeometry(0.7, 0.54, 0.03), [0, 0.3, 59.665]),
    placed(new THREE.BoxGeometry(0.03, 0.54, 0.64), [-0.335, 0.3, 60]),
    placed(new THREE.BoxGeometry(0.03, 0.54, 0.64), [0.335, 0.3, 60]),
    placed(new THREE.BoxGeometry(0.17, 0.54, 0.03), [-0.265, 0.3, 60.335]),
    placed(new THREE.BoxGeometry(0.17, 0.54, 0.03), [0.265, 0.3, 60.335]),
    placed(new THREE.BoxGeometry(0.36, 0.14, 0.03), [0, 0.5, 60.335]),
  ])
  const mesh = new THREE.Mesh(geometry)
  const root = new THREE.Group()
  root.add(mesh)
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.world.addObject('kennel', [partState('body', 'wood', { mass: 9 })])
  // a part of a merged mesh (a house's) or a mesh of its own (a piece of furniture): the same boards either way
  s.renderer.bind('kennel', root, { parts: { body: how === 'plain' ? mesh : { mesh, range: [ranges[0]![0], ranges[7]![1]] } } })
}

/**
 * A stool as the mesh api of game-interactables-three hands it over (spec 019): one mesh of a round seat on four round legs, with the solids it was built from in
 * `userData.solids`, each the box of one primitive. The seat is 0.4 m across and 3 cm thick at 0.4 m; the legs are 4 cm across, 0.15 m from the middle each way.
 */
const stool = (s: Stage, at: number, how: 'fixed' | 'loose' = 'fixed') => {
  const legs = [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]] as const
  const { geometry } = merge([...legs.map(([x, z]) => placed(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 12), [x, 0.2, z])), placed(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), [0, 0.415, 0])])
  const mesh = new THREE.Mesh(geometry)
  mesh.userData.solids = [...legs.map(([x, z]) => ({ kind: 'cylinder', center: [x, 0.2, z], half: [0.02, 0.2, 0.02], rotation: [0, 0, 0, 1] })), { kind: 'cylinder', center: [0, 0.415, 0], half: [0.2, 0.015, 0.2], rotation: [0, 0, 0, 1] }]
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(0, 0, at)
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.world.addObject('stool', [partState('body', 'wood', { mass: 4 })])
  s.renderer.bind('stool', root, { parts: { body: mesh } })
  return how === 'loose' ? (s.renderer.makePiece('stool') as unknown as { sleeping: boolean; partBoxes?: Array<{ half: number[] }> }) : null
}

/** The height of the first thing the engine has under (x, z) looking down from 50 m: the drawn top, in the engine's own world. */
const topUnder = (s: Stage, x: number, z: number): number => {
  const hit = s.physics.rayFirst([x, 50, z], [0, -1, 0], 100)
  return hit ? 50 - hit.distance : -Infinity
}

engineOnly('every drawn fixed thing collides in the engine', () => {
  it('a table wider than 3 m has a body for each of its meshes, its top where it is drawn, and a piece lands on it', () => {
    const s = stage()
    wideTable(s)
    s.run(0.2)
    const held = s.statics().bodies.get('table')!.held
    expect([...held.keys()].sort()).toEqual(['leg_0:0', 'leg_1:0', 'leg_2:0', 'leg_3:0', 'top:0'])
    expect(topUnder(s, 0, 0)).toBeCloseTo(0.775, 2)
    expect(topUnder(s, 1.9, 0)).toBeCloseTo(0.775, 2)
    const block = drop(s, 'block', [1.2, 1, 0.1])
    s.run(3)
    expect(block.piece.sleeping).toBe(true)
    expect(block.bottom()).toBeGreaterThan(0.76)
    expect(block.bottom()).toBeLessThan(0.8)
  })

  it('the parts of a merged mesh each have a body: a slab and a sheet lying askew as one box each, a round column as triangles, within 1 cm of the drawing', () => {
    const s = stage()
    joinedHouse(s)
    s.run(0.2)
    const held = s.statics().bodies.get('joined')!.held
    expect(held.size).toBe(3)
    expect(held.get('slab:0')!.solid.mesh).toBeUndefined()
    expect(held.get('sheet:0')!.solid.mesh).toBeUndefined()
    expect(held.get('column:0')!.solid.mesh).toBeDefined()
    expect(topUnder(s, 0, 10)).toBeCloseTo(0.2, 2)
    expect(topUnder(s, 0, 30)).toBeCloseTo(1, 2)
    // the sheet's upper face at its middle: the half thickness over the centre, along the way the sheet is turned
    expect(Math.abs(topUnder(s, 0, 20) - (2 + 0.02 / Math.cos(0.3)))).toBeLessThan(0.01)
  })

  it('a piece dropped on a floor slab, on a roof sheet and on a round column of a merged mesh lands on each, not on the terrain under it', () => {
    const s = stage()
    joinedHouse(s)
    s.run(0.2)
    const onSlab = drop(s, 'on_slab', [0.3, 1, 10.2])
    const onSheet = drop(s, 'on_sheet', [0, 3, 20.1], 0.05)
    const onColumn = drop(s, 'on_column', [0, 2, 30], 0.05)
    s.run(3)
    expect(onSlab.bottom()).toBeGreaterThan(0.19)
    expect(onSlab.bottom()).toBeLessThan(0.23)
    expect(onSheet.bottom()).toBeGreaterThan(1.9)
    expect(onColumn.bottom()).toBeGreaterThan(0.98)
    expect(onColumn.bottom()).toBeLessThan(1.05)
  })

  it('a door frame (two posts and a lintel in one part) is its triangles, not the box around the opening: a block put in the doorway falls to the floor', () => {
    const s = stage()
    doorFrame(s)
    s.run(0.2)
    const held = s.statics().bodies.get('frame')!.held
    expect(held.get('frame:0')!.solid.mesh).toBeDefined()
    const block = drop(s, 'in_doorway', [0, 1, 40], 0.1)
    s.run(3)
    expect(block.piece.sleeping).toBe(true)
    expect(block.bottom()).toBeLessThan(0.03)
    expect(block.bottom()).toBeGreaterThan(-0.03)
  })

  it('a hollow thing drawn as one part (a kennel: boards round the air, a doorway in the front) is its boards, not the box around the air: what is inside lies on its floor and a ray goes in by the doorway', () => {
    const s = stage()
    kennel(s)
    s.run(0.2)
    const held = s.statics().bodies.get('kennel')!.held
    expect(held.get('body:0')!.solid.mesh).toBeDefined()
    // by the doorway to the back board, 0.65 m in from the front face
    const through = s.physics.rayFirst([0, 0.2, 62], [0, 0, -1], 4)
    expect(through?.distance).toBeCloseTo(2 + 0.32, 2)
    const chip = drop(s, 'chip_inside', [0, 0.3, 60], 0.04)
    s.run(3)
    expect(chip.piece.sleeping).toBe(true)
    expect(chip.bottom()).toBeGreaterThan(0.02)
    expect(chip.bottom()).toBeLessThan(0.05)
    expect(Math.hypot(chip.root.position.x, chip.root.position.z - 60)).toBeLessThan(0.2)
  })

  it('a door frame made a piece collides as its two posts and its lintel, not as the slab filling the doorway', () => {
    const s = stage()
    doorFrame(s)
    s.run(0.2)
    const piece = s.renderer.makePiece('frame') as unknown as { partBoxes?: Array<{ half: number[] }> }
    expect(piece.partBoxes).toHaveLength(3)
    const volume = piece.partBoxes!.reduce((sum, box) => sum + 8 * box.half[0]! * box.half[1]! * box.half[2]!, 0)
    // the box around the frame is 1 x 2.1 x 0.17 m = 0.357 m3: the three boxes hold about an eighth of it
    expect(volume).toBeLessThan(0.1)
  })

  it.each(['ranged', 'plain'] as const)('a kennel made a piece (%s mesh) collides as its eight boards, not as the box around the air in it: a chip let go inside it lies on its floor', (how) => {
    const s = stage()
    kennel(s, how)
    s.run(0.2)
    const piece = s.renderer.makePiece('kennel') as unknown as { sleeping: boolean; partBoxes?: Array<{ half: number[] }> }
    expect(piece.partBoxes).toHaveLength(8)
    const volume = piece.partBoxes!.reduce((sum, box) => sum + 8 * box.half[0]! * box.half[1]! * box.half[2]!, 0)
    // the box around the kennel is 0.7 x 0.6 x 0.7 m = 0.294 m3: its boards hold about a fifth of it
    expect(volume).toBeLessThan(0.08)
    s.run(1)
    const chip = drop(s, 'chip_in_piece', [0, 0.3, 60], 0.04)
    s.run(3)
    expect(chip.piece.sleeping).toBe(true)
    expect(chip.bottom()).toBeGreaterThan(0.02)
    expect(chip.bottom()).toBeLessThan(0.06)
    expect(Math.hypot(chip.root.position.x, chip.root.position.z - 60)).toBeLessThan(0.2)
  })

  it('a mesh that says what it was built from (userData.solids) is held by that, fixed: a stool is its four legs and its seat, and a block put under the seat lies on the floor', () => {
    const s = stage()
    stool(s, 80)
    s.run(0.2)
    const held = s.statics().bodies.get('stool')!.held
    expect(held.size).toBe(5)
    expect([...held.values()].every((entry) => entry.solid.mesh === undefined)).toBe(true)
    // the seat from above, the floor between the legs from the side
    expect(topUnder(s, 0, 80)).toBeCloseTo(0.43, 2)
    expect(s.physics.rayFirst([-1, 0.2, 80], [1, 0, 0], 2)).toBeNull()
    expect(s.physics.rayFirst([-1, 0.2, 79.85], [1, 0, 0], 2)?.distance).toBeCloseTo(1 - 0.17, 2)
    const block = drop(s, 'under_seat', [0, 0.2, 80], 0.05)
    s.run(3)
    expect(block.piece.sleeping).toBe(true)
    expect(block.bottom()).toBeLessThan(0.03)
    expect(Math.hypot(block.root.position.x, block.root.position.z - 80)).toBeLessThan(0.1)
  })

  it('and let go: the piece is those five boxes, not the box around the legs and the air between them', () => {
    const s = stage()
    const piece = stool(s, 90, 'loose')!
    expect(piece.partBoxes).toHaveLength(5)
    const volume = piece.partBoxes!.reduce((sum, box) => sum + 8 * box.half[0]! * box.half[1]! * box.half[2]!, 0)
    // the box around the stool is 0.4 x 0.43 x 0.4 m = 0.069 m3; its legs and seat as boxes are 0.0074 m3
    expect(volume).toBeLessThan(0.01)
    s.run(2)
    expect(piece.sleeping).toBe(true)
    const block = drop(s, 'under_loose_seat', [0, 0.15, 90], 0.05)
    s.run(3)
    expect(block.piece.sleeping).toBe(true)
    expect(block.bottom()).toBeLessThan(0.03)
    expect(Math.hypot(block.root.position.x, block.root.position.z - 90)).toBeLessThan(0.1)
  })

  it('a list that is not solids is not used: the mesh is measured from what is drawn', () => {
    const s = stage()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1))
    mesh.userData.solids = [{ center: [0, 0, 0], half: [9, 9, 'nine'], rotation: [0, 0, 0, 1] }]
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(0, 0.1, 100)
    s.scene.add(root)
    root.updateMatrixWorld(true)
    s.world.addObject('slab', [partState('body', 'concrete', { mass: 400 })])
    s.renderer.bind('slab', root, { parts: { body: mesh } })
    s.run(0.2)
    expect(topUnder(s, 0, 100)).toBeCloseTo(0.2, 2)
    expect(topUnder(s, 3, 100)).toBe(-Infinity)
  })

  it('a part that breaks has no body any more: nothing collides where nothing is drawn', () => {
    const s = stage()
    const { legs, legIds } = wideTable(s)
    s.run(0.2)
    const held = s.statics().bodies.get('table')!.held
    expect(held.has('leg_1:0')).toBe(true)
    const part = s.world.part('table', legIds[1]!)
    if (part) part.status = 'broken'
    s.world.emit({ type: 'fracture', object: 'table', part: legIds[1]!, point: [legs[1]!.position.x, 0.3, legs[1]!.position.z], style: 'splinter', fragments: [] })
    s.run(0.5)
    // on three legs it is balanced on the line between two of them and goes over (`loosenIfFootless`): a loose piece, no fixed body left at all
    const body = s.statics().bodies.get('table')
    expect(body?.held.has('leg_1:0') ?? false).toBe(false)
    if (body) expect(body.held.has('leg_0:0')).toBe(true)
    else expect(s.renderer.piece('table')).not.toBeNull()
  })
})

engineOnly('the engine ground is the terrain alone', () => {
  it('a top the host adds to groundAt is not ground in the engine: a piece under a table lies on the floor, with the table top its own body', () => {
    const tableTop = (x: number, z: number): boolean => Math.abs(x) < 2.1 && Math.abs(z) < 0.6
    const s = stage({ groundAt: (x, z) => (tableTop(x, z) ? 0.775 : 0), terrainAt: () => 0 })
    wideTable(s)
    s.run(0.2)
    const under = drop(s, 'under', [0, 0.3, 0], 0.1)
    s.run(3)
    expect(under.bottom()).toBeGreaterThan(-0.02)
    expect(under.bottom()).toBeLessThan(0.03)
    // and what is above it is the drawn top, found as a body
    expect(topUnder(s, 0.5, 0.2)).toBeCloseTo(0.775, 2)
  })
})
