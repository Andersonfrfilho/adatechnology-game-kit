import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { StaticSolid } from '../src/engine-pieces'
import { fitOrientedBoxes } from '@adatechnology/game-shapes'
import { PieceSystem } from '../src/pieces'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

/** A 4 x 3 m sheet pitched 30 degrees, drawn as a range of a merged mesh (the house's roof mesh): its vertices are in the house's space, the mesh itself square. */
const roofSheet = (): THREE.BufferGeometry => new THREE.PlaneGeometry(4, 3, 4, 4).rotateX(-Math.PI / 2).rotateX(Math.PI / 6).translate(0, 2, 0)

const pointsOf = (g: THREE.BufferGeometry): number[] => Array.from(g.getAttribute('position').array as ArrayLike<number>)

describe.skipIf(process.env.PIECE_SOLVER === 'own')('a piece collides as it is drawn, not as the box around it', () => {
  it('fits a tilted sheet as one thin plate, and a gable (two slopes) as two', () => {
    const sheet = fitOrientedBoxes(pointsOf(roofSheet()))
    expect(sheet.length).toBe(1)
    expect([...sheet[0]!.half].sort((a, b) => a - b)).toEqual([expect.closeTo(0.01, 3), expect.closeTo(1.5, 3), expect.closeTo(2, 3)])
    const left = new THREE.PlaneGeometry(2, 4, 4, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 6).translate(-0.87, 0.5, 0)
    const right = new THREE.PlaneGeometry(2, 4, 4, 4).rotateX(-Math.PI / 2).rotateZ(-Math.PI / 6).translate(0.87, 0.5, 0)
    const gable = fitOrientedBoxes([...pointsOf(left), ...pointsOf(right)])
    expect(gable.length).toBe(2)
    for (const b of gable) expect(Math.min(...b.half)).toBeLessThan(0.02)
  })

  it('a 3 kg roof sheet made a piece pitched 30 degrees falls flat on the ground, not onto the 1.5 m tall box around it', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), eventBudgetMs: Infinity })
    world.addObject('roof', [partState('sheet', 'steel', { mass: 3 })])
    const geo = roofSheet()
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('roof', root, { parts: { sheet: { mesh, range: [0, geo.getAttribute('position').count] } } })
    renderer.makePiece('roof')
    for (let t = 0; t < 4; t += 1 / 60) renderer.update(1 / 60)
    // the highest point of the sheet as drawn
    root.updateMatrixWorld(true)
    const top = new THREE.Box3().setFromObject(root, true).max.y
    expect(top).toBeLessThan(0.15)
  })

  it('a piece made 15 cm inside a fixed shelf is out of it in the update it is made, on its top, and does not rise after', () => {
    const shelf: StaticSolid[] = [{ center: [0, 0.5, 0], half: [0.5, 0.5, 0.5], rotation: [0, 0, 0, 1] }]
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), staticSolids: () => new Map([['shelf', shelf]]) })
    const root = new THREE.Object3D()
    // its bottom at 0.85, the shelf's top at 1
    root.position.set(0.1, 0.95, 0)
    system.create('box', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    system.update(1 / 60)
    expect(root.position.y).toBeGreaterThan(1.09)
    let highest = root.position.y
    for (let i = 0; i < 120; i++) {
      system.update(1 / 60)
      highest = Math.max(highest, root.position.y)
    }
    expect(highest - 1.1).toBeLessThan(0.01)
    expect(root.position.y).toBeCloseTo(1.1, 2)
  })

  it('a piece made wedged between two fixed things (a door between its frame and a car parked against the wall) is out of both after the update it is made', () => {
    // two blocks 16 cm apart; a 20 cm box between them is 2 cm into each, so out of one the shortest way is into the other
    const solids: StaticSolid[] = [
      { center: [-0.58, 0.5, 0], half: [0.5, 0.5, 0.5], rotation: [0, 0, 0, 1] },
      { center: [0.58, 0.5, 0], half: [0.5, 0.5, 0.5], rotation: [0, 0, 0, 1] },
    ]
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), staticSolids: () => new Map([['wall', solids]]) })
    const root = new THREE.Object3D()
    root.position.set(0, 0.5, 0)
    const piece = system.create('door', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    system.update(1 / 60)
    const out = new Float64Array(3)
    const engine = (system as unknown as { engine: { world: { penetration(id: number, out: Float64Array): number }; links: Map<unknown, { id: number }> } }).engine
    expect(engine.world.penetration(engine.links.get(piece)!.id, out)).toBeLessThan(0.006)
  })

  it('a piece made wedged in a doorway under a ceiling is not lifted through the ceiling: it stays, and the engine does not make it climb (spec 008 D5)', () => {
    // the same two blocks 16 cm apart, and a slab 10 cm over their tops: no way up out of them that is not through the slab (the room's doors, lifted 3.6 m into the attic)
    const solids: StaticSolid[] = [
      { center: [-0.58, 0.5, 0], half: [0.5, 0.5, 0.5], rotation: [0, 0, 0, 1] },
      { center: [0.58, 0.5, 0], half: [0.5, 0.5, 0.5], rotation: [0, 0, 0, 1] },
      { center: [0, 1.2, 0], half: [1.5, 0.1, 0.5], rotation: [0, 0, 0, 1] },
    ]
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), staticSolids: () => new Map([['house', solids]]) })
    const root = new THREE.Object3D()
    root.position.set(0, 0.5, 0)
    system.create('door', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    let highest = 0
    let fastest = 0
    let before = root.position.clone()
    for (let i = 0; i < 120; i++) {
      system.update(1 / 60)
      highest = Math.max(highest, root.position.y)
      fastest = Math.max(fastest, root.position.distanceTo(before) * 60)
      before = root.position.clone()
    }
    expect(highest).toBeLessThan(1.0)
    // the engine's own push out of 2 cm of overlap is a few m/s; lifted through the slab the piece left at 100 m/s
    expect(fastest).toBeLessThan(5)
  })

  it("a piece is put out of the host's fixed things only, not out of the ground (the ground has its own lift): bowl seed 39 at 1/60 made 3 mm of C1 when it was", async () => {
    const { createJoltEngine } = await import('@adatechnology/game-physics-jolt')
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20 })
    const asked: Array<ReadonlySet<number> | undefined> = []
    const counted = Object.create(world) as typeof world
    counted.penetration = (id, out, among) => {
      asked.push(among as ReadonlySet<number> | undefined)
      return world.penetration?.(id, out, among) ?? 0
    }
    const shelf: StaticSolid[] = [{ center: [3, 0.5, 0], half: [0.5, 0.5, 0.5], rotation: [0, 0, 0, 1] }]
    const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: counted, staticSolids: () => new Map([['shelf', shelf]]) })
    const root = new THREE.Object3D()
    root.position.set(0, 0.09, 0)
    system.create('plate', root, [0.3, 0.1, 0.3], new THREE.Vector3(), 2)
    system.update(1 / 60)
    expect(asked.length).toBeGreaterThan(0)
    for (const among of asked) {
      expect(among?.size).toBe(1)
    }
    world.dispose()
  })

  it('a kit move that puts a piece into the ground is not refused: the engine is handed the moved pose once and owns the contact from there, it does not fall through', async () => {
    const { createJoltEngine } = await import('@adatechnology/game-physics-jolt')
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20 })
    const poses: number[] = []
    const watched = Object.create(world) as typeof world
    watched.setPose = (id, position, rotation, wake) => {
      poses.push(position[1])
      world.setPose(id, position, rotation, wake)
    }
    const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: watched })
    const root = new THREE.Object3D()
    root.position.set(0, 0.1, 0)
    system.create('crate', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    for (let i = 0; i < 30; i++) system.update(1 / 60)
    const rest = root.position.y
    expect(rest).toBeCloseTo(0.1, 2)
    poses.length = 0
    // the kit's rule pushes it 6 cm down into the floor (as `slideApart` along a slope would)
    root.position.y -= 0.06
    root.updateMatrixWorld(true)
    system.update(1 / 60)
    expect(poses.length).toBe(1)
    expect(poses[0]).toBeCloseTo(rest - 0.06, 3)
    for (let i = 0; i < 120; i++) system.update(1 / 60)
    expect(root.position.y).toBeGreaterThan(rest - 0.05)
    expect((system as unknown as { engine: { fellThrough: number } }).engine.fellThrough).toBe(0)
    world.dispose()
  })

  it('a pair made inside each other is slid apart once, marked at creation and let go when apart; a pair that comes to overlap later is the engine\'s alone', () => {
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
    const make = (id: string, x: number, y = 0.3): THREE.Object3D => {
      const root = new THREE.Object3D()
      root.position.set(x, y, 0)
      system.create(id, root, [0.3, 0.3, 0.3], new THREE.Vector3(), 2)
      return root
    }
    make('a', 0)
    make('b', 0.1)
    const marked = (): number => (system as unknown as { apartKeys: Set<string> }).apartKeys.size
    system.update(1 / 60)
    expect(marked()).toBe(1)
    for (let i = 0; i < 240; i++) system.update(1 / 60)
    expect(marked()).toBe(0)
    // a third dropped onto them later is never marked, though it overlaps them while it lands
    make('c', 0.05, 1.5)
    for (let i = 0; i < 90; i++) {
      system.update(1 / 60)
      expect(marked()).toBe(0)
    }
  })
})
