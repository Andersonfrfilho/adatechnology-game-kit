import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { SeamWorld } from '@adatechnology/game-physics'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { IS_JOLT, physicsOption } from './setup-physics'

// every drawn fixed thing is a body of the engine: a mode of the engine only (the kit's own solver lands pieces on what it measures itself)
const engineOnly = IS_JOLT ? describe : describe.skip

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
    expect(s.statics().bodies.get('table')!.held.has('leg_1:0')).toBe(false)
    expect(s.statics().bodies.get('table')!.held.has('leg_0:0')).toBe(true)
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
