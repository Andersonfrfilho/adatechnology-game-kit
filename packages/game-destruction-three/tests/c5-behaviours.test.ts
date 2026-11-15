import * as THREE from 'three'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { Vec3 } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { PieceSystem } from '../src/pieces'
import type { PieceSweepHit } from '../src/pieces'
import { FakeWorld, mat, partState } from './fake-world'
import { IS_JOLT, physicsOption } from './setup-physics'

// C5 of spec 008: the behaviours of CLAUDE.md §12 named in spec.md 6.1, one test each, on whichever solver the run is (own by default, Jolt with PIECE_SOLVER=jolt)

const STEP = 1 / 60

type Renderer = ReturnType<typeof createDestructionRenderer>

const stage = (): { scene: THREE.Scene; world: FakeWorld; renderer: Renderer } => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  world.materials.set('steel', mat('steel', { density: 7850, tags: ['metal'], fracture: 'none' }))
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  return { scene, world, renderer }
}

const run = (renderer: { update(dt: number): void }, seconds: number): void => {
  for (let t = 0; t < seconds - 1e-9; t += STEP) renderer.update(STEP)
}

const lowestPoint = (object: THREE.Object3D): number => {
  object.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(object).min.y
}

type Parts = Record<string, THREE.Mesh>

const bindGroup = (s: ReturnType<typeof stage>, id: string, parts: Parts, kind?: string): THREE.Group => {
  const root = new THREE.Group()
  root.add(...Object.values(parts))
  if (kind) markKitOrigin(root, { owner: 'test', kind, id })
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.renderer.bind(id, root, { parts })
  return root
}

/** A table of the furniture catalogue: a top on four legs, each its own part, standing on the floor. */
const table = (s: ReturnType<typeof stage>) => {
  const legIds = ['leg_0', 'leg_1', 'leg_2', 'leg_3']
  s.world.addObject('table', [partState('top', 'wood', { mass: 12 }), ...legIds.map((id) => partState(id, 'wood', { mass: 1.5 }))])
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.8))
  top.position.y = 0.76
  const legs = legIds.map((_, i) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.05))
    leg.position.set(i & 1 ? 0.75 : -0.75, 0.37, i & 2 ? 0.35 : -0.35)
    return leg
  })
  const root = bindGroup(s, 'table', { top, ...Object.fromEntries(legIds.map((id, i) => [id, legs[i]!])) }, 'furniture')
  const breakLeg = (i: number): void => {
    const part = s.world.part('table', legIds[i]!)
    if (part) part.status = 'broken'
    s.world.emit({ type: 'fracture', object: 'table', part: legIds[i]!, point: [legs[i]!.position.x, 0.3, legs[i]!.position.z], style: 'splinter', fragments: [] })
  }
  return { top, root, breakLeg }
}

/** A fixed (drawn, bound) board tilted `degrees` about z, its +x end down and its low end on the floor; a sleeping piece under the kit's own solver, a static body under Jolt. */
const ramp = (s: ReturnType<typeof stage>, degrees: number): number => {
  const angle = (degrees * Math.PI) / 180
  s.world.addObject('ramp', [partState('body', 'ceramic', { mass: 200 })])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1))
  const root = bindGroup(s, 'ramp', { body: mesh })
  root.rotation.z = -angle
  root.position.set(0, Math.sin(angle) * 1.5 + 0.03, 0)
  root.updateMatrixWorld(true)
  if (!IS_JOLT) s.renderer.makePiece('ramp').sleeping = true
  return root.position.y
}

/** A 2 kg 20 x 10 x 20 cm box of `material` lying on the middle of that ramp, set down touching it (0.5 mm). */
const boxOnRamp = (s: ReturnType<typeof stage>, rampY: number, degrees: number, material: string): THREE.Group => {
  const angle = (degrees * Math.PI) / 180
  s.world.addObject('box', [partState('body', material, { mass: 2 })])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2))
  const root = bindGroup(s, 'box', { body: mesh })
  root.rotation.z = -angle
  const lift = 0.025 + 0.05 + 0.0005
  root.position.set(Math.sin(angle) * lift, rampY + Math.cos(angle) * lift, 0)
  root.updateMatrixWorld(true)
  s.renderer.makePiece('box')
  return root
}

describe('C5: the behaviours of section 12', () => {
  it('1. support lost: what is left falls and rests on the corners of the parts that remain', () => {
    const s = stage()
    const { top, breakLeg } = table(s)
    // both legs of one end go: the top is left on the other two
    breakLeg(0)
    breakLeg(2)
    run(s.renderer, 6)
    const piece = s.renderer.piece('table')
    expect(piece).not.toBeNull()
    expect(piece?.sleeping).toBe(true)
    // it came down: the top lies on the floor at the broken end and on the ends of the two legs that stayed, nothing of it under the floor
    expect(lowestPoint(top)).toBeLessThan(0.3)
    expect(lowestPoint(top)).toBeGreaterThan(-0.01)
  })

  it('2. tips over when the centre of mass leaves the support: one leg always, two on one side turn until the top hits', () => {
    const one = stage()
    one.world.addObject('table', [partState('leg', 'wood', { mass: 1.4 }), partState('board', 'wood', { mass: 4 })], [['leg'], ['board']])
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.05))
    leg.position.y = 0.37
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.16))
    board.position.y = 0.76
    bindGroup(one, 'table', { leg, board }, 'furniture')
    one.world.emit({ type: 'detach', object: 'table', joint: 'j', parts: ['leg', 'board'] })
    run(one.renderer, 6)
    expect(one.renderer.piece('table')).not.toBeNull()
    // a lone leg does not stay standing: it ends lower than a step
    expect(lowestPoint(leg) + 0.05).toBeLessThan(0.2)
    expect(new THREE.Box3().setFromObject(leg).max.y).toBeLessThan(0.2)

    const two = stage()
    const { top, breakLeg } = table(two)
    breakLeg(0)
    breakLeg(1)
    run(two.renderer, 6)
    const piece = two.renderer.piece('table')
    expect(piece).not.toBeNull()
    expect(lowestPoint(top)).toBeLessThan(0.05)
    expect(piece?.sleeping).toBe(true)
  })

  it('3. what lay on top falls with it, in the same update its support starts to move', () => {
    const s = stage()
    s.world.addObject('crate', [partState('body', 'wood', { mass: 3 })])
    const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4))
    crateMesh.position.y = 0.2
    bindGroup(s, 'crate', { body: crateMesh })
    s.renderer.makePiece('crate')
    run(s.renderer, 2)
    s.world.addObject('can', [partState('body', 'steel', { mass: 0.45 })])
    const canMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11))
    canMesh.position.y = 0.055
    const canRoot = bindGroup(s, 'can', { body: canMesh })
    canRoot.position.set(0, 0.41, 0)
    canRoot.updateMatrixWorld(true)
    const can = s.renderer.makePiece('can')
    run(s.renderer, 3)
    expect(can.sleeping).toBe(true)
    s.renderer.impulse('crate', [8, 0, 0], [0, 0.35, 0])
    s.renderer.update(STEP)
    expect(can.sleeping).toBe(false)
  })

  it('4. Coulomb: a box of mu 0.4 slides at 25 degrees (the distance of g (sin t - mu_d cos t) t^2 / 2), one of mu 0.5 holds', () => {
    const slide = stage()
    const slideBox = boxOnRamp(slide, ramp(slide, 25), 25, 'plastic')
    const start = slideBox.position.x
    run(slide.renderer, 1)
    const slid = slideBox.position.x - start
    const angle = (25 * Math.PI) / 180
    // plastic on the ceramic top: sqrt(0.3 x 0.4) while it slides, the analytic distance in one second from rest
    const analytic = 0.5 * 9.81 * (Math.sin(angle) - Math.sqrt(0.3 * 0.4) * Math.cos(angle)) * Math.cos(angle)
    expect(slid).toBeGreaterThan(analytic * 0.75)
    expect(slid).toBeLessThan(analytic * 1.15)

    const hold = stage()
    const holdBox = boxOnRamp(hold, ramp(hold, 25), 25, 'ceramic')
    const holdStart = holdBox.position.x
    run(hold.renderer, 1)
    expect(Math.abs(holdBox.position.x - holdStart)).toBeLessThan(0.03)
  })

  it('5. the normal is the one of the support\'s tilted face, not the world\'s: a box dropped on a ramp lies along it', () => {
    const s = stage()
    const rampY = ramp(s, 15)
    const box = boxOnRamp(s, rampY, 15, 'ceramic')
    // set down level, 2 cm up: it has to turn onto the face
    box.rotation.z = 0
    box.position.y += 0.02
    box.updateMatrixWorld(true)
    run(s.renderer, 3)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(box.quaternion)
    const angle = (15 * Math.PI) / 180
    expect(Math.abs(Math.atan2(up.x, up.y) - angle)).toBeLessThan(0.05)
  })

  it('6. no collider without geometry: what a part draws is what collides, and a part that broke collides no more', () => {
    const s = stage()
    s.world.addObject('shelf', [partState('left', 'wood', { mass: 5 }), partState('right', 'wood', { mass: 5 })])
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.6))
    left.position.set(-0.35, 0.5, 0)
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.6))
    right.position.set(0.35, 0.5, 0)
    bindGroup(s, 'shelf', { left, right })
    expect(s.renderer.shownBoxes('shelf')).toHaveLength(2)
    const drop = (id: string, x: number): THREE.Group => {
      s.world.addObject(id, [partState('body', 'wood', { mass: 1 })])
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1))
      const root = bindGroup(s, id, { body: mesh })
      root.position.set(x, 1, 0)
      root.updateMatrixWorld(true)
      s.renderer.makePiece(id)
      return root
    }
    s.world.part('shelf', 'right')!.status = 'broken'
    s.world.emit({ type: 'fracture', object: 'shelf', part: 'right', point: [0.35, 0.5, 0], style: 'splinter', fragments: [] })
    run(s.renderer, 0.1)
    expect(s.renderer.shownBoxes('shelf')).toHaveLength(1)
    const onLeft = drop('on_left', -0.35)
    const overRight = drop('over_right', 0.35)
    run(s.renderer, 3)
    expect(lowestPoint(onLeft)).toBeGreaterThan(0.5)
    expect(lowestPoint(overRight)).toBeLessThan(0.02)
  })

  it('7. onBrokenChecked: after a break nothing is left over air, and what hangs is left to what holds it', () => {
    const stand = (lift: number) => {
      const s = stage()
      const checked: Array<[string, boolean]> = []
      const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene: s.scene, world: s.world.asWorld(), onBrokenChecked: (id, released) => checked.push([id, released]) })
      const ids = ['post_0', 'post_1', 'post_2', 'post_3']
      s.world.addObject('stand', [partState('board', 'wood', { mass: 6 }), ...ids.map((id) => partState(id, 'wood', { mass: 1 }))])
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.5))
      board.position.y = lift + 0.615
      const posts = ids.map((_, i) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.04))
        post.position.set(i & 1 ? 0.36 : -0.36, lift + 0.3, i & 2 ? 0.21 : -0.21)
        return post
      })
      const root = new THREE.Group()
      root.add(board, ...posts)
      s.scene.add(root)
      root.updateMatrixWorld(true)
      renderer.bind('stand', root, { parts: { board, ...Object.fromEntries(ids.map((id, i) => [id, posts[i]!])) } })
      const breakPost = (i: number): void => {
        s.world.part('stand', ids[i]!)!.status = 'broken'
        s.world.emit({ type: 'fracture', object: 'stand', part: ids[i]!, point: [0, lift + 0.3, 0], style: 'splinter', fragments: [] })
      }
      return { renderer, board, checked, breakPost }
    }
    const lost = stand(0)
    for (let i = 0; i < 4; i++) lost.breakPost(i)
    run(lost.renderer, 4)
    expect(lost.checked.length).toBeGreaterThan(0)
    expect(lost.checked.every(([id, released]) => id === 'stand' && !released)).toBe(true)
    expect(lost.renderer.piece('stand')).not.toBeNull()
    expect(lowestPoint(lost.board)).toBeLessThan(0.02)

    const hanging = stand(1.2)
    hanging.breakPost(0)
    run(hanging.renderer, 1)
    expect(hanging.checked).toEqual([['stand', false]])
    expect(hanging.renderer.piece('stand')).toBeNull()
  })

  it('8. a can standing on a 10 degree ramp moves at most 2 cm in 2 s', () => {
    const s = stage()
    const angle = (10 * Math.PI) / 180
    s.world.addObject('ramp', [partState('body', 'wood', { mass: 200 })])
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1))
    const rampRoot = bindGroup(s, 'ramp', { body: rampMesh })
    rampRoot.rotation.z = -angle
    rampRoot.position.set(0, Math.sin(angle) * 1.5 + 0.03, 0)
    rampRoot.updateMatrixWorld(true)
    if (!IS_JOLT) s.renderer.makePiece('ramp').sleeping = true
    s.world.addObject('can', [partState('body', 'steel', { mass: 0.41 })])
    const canMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.115, 24))
    canMesh.userData.hollow = true
    canMesh.userData.destructionThickness = 0.00025
    canMesh.userData.destructionContains = { fluid: 'soda', liters: 0.35 }
    const can = bindGroup(s, 'can', { body: canMesh })
    can.rotation.z = -angle
    const lift = 0.025 + 0.115 / 2 + 0.001
    can.position.set(Math.sin(angle) * lift, rampRoot.position.y + Math.cos(angle) * lift, 0)
    can.updateMatrixWorld(true)
    s.renderer.makePiece('can')
    const startX = can.position.x
    run(s.renderer, 2)
    expect(Math.abs(can.position.x - startX)).toBeLessThan(0.02)
  })

  it('9. a piece sliding into a wall goes back to the point where it met it (sweep)', () => {
    const wallX = 0.8
    const half = 0.1
    const sweep = (_piece: unknown, from: Vec3, to: Vec3): PieceSweepHit | null => {
      const reach = wallX - half
      if (to[0] <= from[0] || to[0] < reach || from[0] > reach) return null
      const travel = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
      return { object: 'wall', part: 'body', distance: ((reach - from[0]) / (to[0] - from[0])) * travel, point: [wallX, from[1], from[2]], normal: [-1, 0, 0] }
    }
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), staticSolids: () => new Map(), sweep })
    const root = new THREE.Object3D()
    root.position.set(0.69, 0.1, 0)
    const box = system.create('box', root, [half, half, half], new THREE.Vector3(), 2)
    box.velocity[0] = 3
    let furthest = 0
    for (let i = 0; i < 60; i++) {
      system.update(0.05)
      furthest = Math.max(furthest, root.position.x + half)
    }
    // never through the wall (5 mm of the engine's contact), and it ends on this side of it
    expect(furthest).toBeLessThan(wallX + 0.005)
    expect(root.position.x + half).toBeLessThan(wallX + 0.005)
  })

  it('10. a hard landing is told by the contact events: once, with the speed it came down at', () => {
    const landings: number[] = []
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: (_body, _point, impact) => landings.push(impact), scene: new THREE.Scene() })
    const root = new THREE.Object3D()
    root.position.set(0, 1.6, 0)
    system.create('box', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    for (let i = 0; i < 90; i++) system.update(STEP)
    expect(landings).toHaveLength(1)
    // 1.5 m of fall: sqrt(2 g h) = 5.4 m/s
    expect(landings[0]).toBeGreaterThan(4.5)
    expect(landings[0]).toBeLessThan(6)
  })
})
