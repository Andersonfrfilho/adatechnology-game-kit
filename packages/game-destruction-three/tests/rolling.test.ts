import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { Vec3 } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '../src/renderer'
import type { PieceBody } from '../src/internal'
import { FakeWorld, mat, partState } from './fake-world'

const G = 9.81
/** A 350 ml can: 6.6 cm across, 11.5 cm long, a steel wall of a quarter millimetre (7850 kg/m3), 60 g empty and 410 g full. */
const CAN_RADIUS = 0.033
const CAN_LENGTH = 0.115
const CAN_WALL = 0.00025
const CAN_EMPTY = 2 * Math.PI * CAN_RADIUS * (CAN_LENGTH + CAN_RADIUS) * CAN_WALL * 7850
const CAN_FULL = 0.41

const run = (renderer: { update(dt: number): void }, seconds: number, each?: () => void): void => {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
    renderer.update(1 / 60)
    each?.()
  }
}

const scene3 = () => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  world.materials.set('steel', mat('steel', { density: 7850, tags: ['metal'], fracture: 'none' }))
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
  return { scene, world, renderer }
}

type Setup = ReturnType<typeof scene3>

/** A can drawn as a hollow steel shell (`userData.hollow`, its wall thickness, its soda when it is full), its axis along z (lying) or y (standing), its centre at `at`. */
const addCan = (s: Setup, id: string, at: Vec3, options: { mass?: number; standing?: boolean; tilt?: number; velocity?: Vec3 } = {}): { root: THREE.Group; piece: PieceBody } => {
  s.world.addObject(id, [partState('body', 'steel', { mass: options.mass ?? CAN_FULL })])
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(CAN_RADIUS, CAN_RADIUS, CAN_LENGTH, 24))
  mesh.userData.hollow = true
  mesh.userData.destructionThickness = CAN_WALL
  // a full can holds 350 ml of soda; an empty one nothing
  if ((options.mass ?? CAN_FULL) > CAN_EMPTY * 1.5) mesh.userData.destructionContains = { fluid: 'soda', liters: 0.35 }
  if (!options.standing) mesh.rotation.x = Math.PI / 2
  const root = new THREE.Group()
  root.add(mesh)
  root.rotation.z = -(options.tilt ?? 0)
  root.position.set(...at)
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.renderer.bind(id, root, { parts: { body: mesh } })
  const piece = s.renderer.makePiece(id, options.velocity ? { velocity: options.velocity } : {}) as PieceBody
  return { root, piece }
}

/** A wooden board 3 m long tilted by `degrees` (its +x end down, the low end on the floor), asleep: a ramp. */
const addRamp = (s: Setup, degrees: number): number => {
  const angle = (degrees * Math.PI) / 180
  s.world.addObject('ramp', [partState('body', 'wood', { mass: 200 })])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1))
  const root = new THREE.Group()
  root.add(mesh)
  root.rotation.z = -angle
  root.position.set(0, Math.sin(angle) * 1.5 + 0.03, 0)
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.renderer.bind('ramp', root, { parts: { body: mesh } })
  s.renderer.makePiece('ramp').sleeping = true
  return root.position.y
}

/** The acceleration (m/s2) along the slope of a can let go across a ramp of `degrees`, measured between 0.2 s and 0.7 s of rolling. */
const rollDown = (degrees: number, mass: number): { a: number; piece: PieceBody } => {
  const s = scene3()
  const top = addRamp(s, degrees)
  const angle = (degrees * Math.PI) / 180
  const lift = 0.025 + CAN_RADIUS + 0.001
  const { piece } = addCan(s, 'can', [-0.8 * Math.cos(angle) + Math.sin(angle) * lift, top + 0.8 * Math.sin(angle) + Math.cos(angle) * lift, 0], { mass, tilt: angle })
  const along = (): number => piece.velocity[0] * Math.cos(angle) - piece.velocity[1] * Math.sin(angle)
  run(s.renderer, 0.2)
  const v0 = along()
  run(s.renderer, 0.5)
  return { a: (along() - v0) / 0.5, piece }
}

describe('a can rolls down a ramp at g (sin t - C_rr cos t) / (1 + k)', () => {
  // steel on the wooden board: the wood is the softer, C_rr 0.01
  const C_RR = 0.01
  const expected = (degrees: number, k: number): number => {
    const t = (degrees * Math.PI) / 180
    return (G * (Math.sin(t) - C_RR * Math.cos(t))) / (1 + k)
  }

  it('a full can (its contents a solid cylinder) rolls at about g sin t / 1.57', () => {
    const k = (CAN_EMPTY / CAN_FULL) * 1 + (1 - CAN_EMPTY / CAN_FULL) * 0.5
    const { a, piece } = rollDown(10, CAN_FULL)
    expect(piece.round?.inertia).toBeCloseTo(k, 3)
    expect(a).toBeGreaterThan(expected(10, k) * 0.97)
    expect(a).toBeLessThan(expected(10, k) * 1.03)
  })

  it('an empty can (a thin shell, k = 1) rolls at g sin t / 2: slower than the full one', () => {
    const { a, piece } = rollDown(10, CAN_EMPTY)
    expect(piece.round?.inertia).toBeCloseTo(1, 3)
    expect(a).toBeGreaterThan(expected(10, 1) * 0.97)
    expect(a).toBeLessThan(expected(10, 1) * 1.03)
    expect(a).toBeLessThan(rollDown(10, CAN_FULL).a * 0.85)
  })

  it('rolls, not slides: the speed of its centre is its spin times its radius', () => {
    const { piece } = rollDown(15, CAN_FULL)
    expect(Math.hypot(piece.velocity[0], piece.velocity[1])).toBeCloseTo(Math.abs(piece.angularVelocity[2]) * CAN_RADIUS, 2)
  })
})

describe('a standing can does not roll', () => {
  it('upright on the floor it stays where it is set down, and goes to sleep', () => {
    const s = scene3()
    const { root, piece } = addCan(s, 'can', [0, CAN_LENGTH / 2 + 0.001, 0], { standing: true })
    run(s.renderer, 2)
    expect(Math.hypot(root.position.x, root.position.z)).toBeLessThan(0.005)
    // still upright
    expect(Math.abs(new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion).y)).toBeGreaterThan(0.99)
    expect(piece.sleeping).toBe(true)
  })

  it('upright on a ramp gentler than its grip (steel on wood holds to 26 degrees) it stays', () => {
    const s = scene3()
    const top = addRamp(s, 10)
    const angle = (10 * Math.PI) / 180
    const lift = 0.025 + CAN_LENGTH / 2 + 0.001
    const { root } = addCan(s, 'can', [Math.sin(angle) * lift, top + Math.cos(angle) * lift, 0], { standing: true, tilt: angle })
    const x0 = root.position.x
    run(s.renderer, 2)
    expect(Math.abs(root.position.x - x0)).toBeLessThan(0.02)
  })
})

describe('a tapered bottle rolls round its narrow end', () => {
  it('pushed sideways, its wide end travels farther than its narrow one and its path bends', () => {
    const s = scene3()
    s.world.addObject('bottle', [partState('body', 'glass', { mass: 0.5 })])
    // a bottle 25 cm long, 9 cm across at the base and 5 cm at the shoulder of its neck, its axis along z
    const profile = [new THREE.Vector2(0, -0.125), new THREE.Vector2(0.045, -0.125), new THREE.Vector2(0.025, 0.125), new THREE.Vector2(0, 0.125)]
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 24))
    mesh.rotation.x = Math.PI / 2
    const root = new THREE.Group()
    root.add(mesh)
    // lying on its widest point and on the cap's rim
    root.position.set(0, 0.046, 0)
    s.scene.add(root)
    root.updateMatrixWorld(true)
    s.renderer.bind('bottle', root, { parts: { body: mesh } })
    const piece = s.renderer.makePiece('bottle', { velocity: [1, 0, 0] }) as PieceBody
    expect(piece.round?.kind).toBe('cylinder')
    // the base is at -z after the turn (the lathe's -y), the narrow end at +z
    const end = (z: number): THREE.Vector3 => new THREE.Vector3(0, 0, z).applyMatrix4(root.matrixWorld)
    const wide0 = end(-0.125)
    const narrow0 = end(0.125)
    run(s.renderer, 1.5)
    const wide1 = end(-0.125)
    const narrow1 = end(0.125)
    expect(wide1.distanceTo(wide0)).toBeGreaterThan(narrow1.distanceTo(narrow0) * 1.3)
    // its axis turned about the vertical: the path bends toward the narrow end
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion)
    expect(Math.abs(Math.atan2(axis.x, axis.z))).toBeGreaterThan(0.2)
    // and it never sank into the floor
    expect(root.position.y).toBeGreaterThan(0.02)
  })
})

describe('cans knock each other', () => {
  it('a can thrown into a still one in the air: they trade momentum by their restitution (steel on steel, e = 0.6), and the pair keeps all of it', () => {
    const s = scene3()
    // both fall alike from 2 m, so they meet level, the floor far below
    const a = addCan(s, 'a', [-0.3, 2, 0], { velocity: [3, 0, 0] })
    const b = addCan(s, 'b', [0, 2, 0])
    let before = 0
    let after: { va: number; vb: number } | null = null
    run(s.renderer, 0.3, () => {
      if (after) return
      if (Math.abs(b.piece.velocity[0]) > 0.05) after = { va: a.piece.velocity[0], vb: b.piece.velocity[0] }
      else before = a.piece.velocity[0]
    })
    const { va, vb } = after ?? { va: 0, vb: 0 }
    expect(before).toBeCloseTo(3, 3)
    // equal masses: the still one goes on at (1 + e) / 2 of the speed, the other keeps (1 - e) / 2
    expect(vb).toBeCloseTo(before * 0.8, 2)
    expect(va).toBeCloseTo(before * 0.2, 2)
    expect(va + vb).toBeCloseTo(before, 4)
  })

  it('a heavy can into a light one: the light one leaves faster than the heavy one came, momentum kept', () => {
    const s = scene3()
    const a = addCan(s, 'a', [-0.3, 2, 0], { velocity: [2, 0, 0], mass: 0.41 })
    const b = addCan(s, 'b', [0, 2, 0], { mass: CAN_EMPTY })
    let after: { va: number; vb: number } | null = null
    run(s.renderer, 0.3, () => {
      if (!after && Math.abs(b.piece.velocity[0]) > 0.05) after = { va: a.piece.velocity[0], vb: b.piece.velocity[0] }
    })
    const { va, vb } = after ?? { va: 0, vb: 0 }
    expect(vb).toBeGreaterThan(2)
    expect(0.41 * va + CAN_EMPTY * vb).toBeCloseTo(0.41 * 2, 3)
  })

  it('on the floor, a rolling can knocks a still one on and nearly stops; they never overlap', () => {
    const s = scene3()
    const a = addCan(s, 'a', [-0.4, CAN_RADIUS + 0.001, 0], { velocity: [2, 0, 0] })
    const b = addCan(s, 'b', [0.2, CAN_RADIUS + 0.001, 0])
    // rolling from the start: v = w r
    a.piece.angularVelocity[2] = -2 / CAN_RADIUS
    run(s.renderer, 0.5, () => expect(b.root.position.x - a.root.position.x).toBeGreaterThan(2 * CAN_RADIUS - 0.006))
    expect(b.root.position.x).toBeGreaterThan(0.4)
    expect(b.piece.velocity[0]).toBeGreaterThan(a.piece.velocity[0])
  })

  it('two cans rolling at each other at 3.5 m/s meet and bounce; neither passes through the other or the floor', () => {
    const s = scene3()
    const a = addCan(s, 'a', [-0.5, CAN_RADIUS + 0.001, 0], { velocity: [3.5, 0, 0] })
    const b = addCan(s, 'b', [0.5, CAN_RADIUS + 0.001, 0], { velocity: [-3.5, 0, 0] })
    a.piece.angularVelocity[2] = -3.5 / CAN_RADIUS
    b.piece.angularVelocity[2] = 3.5 / CAN_RADIUS
    let bounced = false
    run(s.renderer, 1.5, () => {
      expect(b.root.position.x - a.root.position.x).toBeGreaterThan(2 * CAN_RADIUS - 0.006)
      expect(Math.min(a.root.position.y, b.root.position.y)).toBeGreaterThan(CAN_RADIUS - 0.006)
      if (a.piece.velocity[0] < 0 && b.piece.velocity[0] > 0) bounced = true
    })
    expect(bounced).toBe(true)
  })
})

/** A world with a table leg that the pieces sweep against (`sweepBox`): a 5 x 70 x 5 cm wooden post at `leg`. */
class LegWorld extends FakeWorld {
  constructor(private readonly leg: { min: Vec3; max: Vec3 }) {
    super()
    this.addObject('table', [partState('leg', 'wood', { mass: 2 })])
  }

  sweepBox(box: { min: Vec3; max: Vec3 }, direction: Vec3, distance: number): { object: string; part: string; point: Vec3; normal: Vec3; distance: number } | null {
    const half = [0, 1, 2].map((k) => (box.max[k] - box.min[k]) / 2)
    const from = [0, 1, 2].map((k) => (box.max[k] + box.min[k]) / 2)
    const len = Math.hypot(direction[0], direction[1], direction[2])
    let t0 = 0
    let t1 = distance
    let axis = -1
    for (let k = 0; k < 3; k++) {
      const d = direction[k] / len
      const lo = this.leg.min[k] - half[k]
      const hi = this.leg.max[k] + half[k]
      if (Math.abs(d) < 1e-9) {
        if (from[k] < lo || from[k] > hi) return null
        continue
      }
      let a = (lo - from[k]) / d
      let b = (hi - from[k]) / d
      if (a > b) [a, b] = [b, a]
      if (a > t0) {
        t0 = a
        axis = k
      }
      t1 = Math.min(t1, b)
      if (t0 > t1) return null
    }
    if (axis < 0) return null
    const normal: Vec3 = [0, 0, 0]
    normal[axis] = direction[axis] > 0 ? -1 : 1
    const point = [0, 1, 2].map((k) => from[k] + (direction[k] / len) * t0) as Vec3
    return { object: 'table', part: 'leg', point, normal, distance: t0 }
  }
}

describe('a can and the furniture', () => {
  it('a can rolling into a table leg bounces off it by the restitution of steel on wood', () => {
    const scene = new THREE.Scene()
    const world = new LegWorld({ min: [0.3, 0, -0.025], max: [0.35, 0.7, 0.025] })
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    const s = { scene, world, renderer } as unknown as Setup
    const can = addCan(s, 'can', [0, CAN_RADIUS + 0.001, 0], { velocity: [2.5, 0, 0] })
    can.piece.angularVelocity[2] = -2.5 / CAN_RADIUS
    let most = 0
    run(renderer, 1, () => {
      most = Math.max(most, can.root.position.x)
    })
    // it reached the leg, not past it, and came back: steel 0.6 on wood 0.5, e = 0.55
    expect(most).toBeLessThan(0.3 + 0.002)
    expect(most).toBeGreaterThan(0.2)
    expect(can.root.position.x).toBeLessThan(most - 0.05)
  })
})

describe('a can and a table that is a piece', () => {
  /** A 1.2 x 0.6 m table 0.75 m high, a piece of its own (a top and four 5 cm legs), asleep on the floor at x = 1. */
  const tableAhead = (s: Setup): void => {
    s.world.addObject('table', [partState('top', 'wood', { mass: 8 }), ...[0, 1, 2, 3].map((i) => partState(`leg${i}`, 'wood', { mass: 1 }))])
    const root = new THREE.Group()
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6))
    top.position.set(0, 0.73, 0)
    root.add(top)
    const legs = [0, 1, 2, 3].map((i) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.71, 0.05))
      leg.position.set(i & 1 ? 0.55 : -0.55, 0.355, i & 2 ? 0.25 : -0.25)
      root.add(leg)
      return leg
    })
    root.position.set(1, 0, 0)
    s.scene.add(root)
    root.updateMatrixWorld(true)
    s.renderer.bind('table', root, { parts: { top, leg0: legs[0], leg1: legs[1], leg2: legs[2], leg3: legs[3] } })
    s.renderer.makePiece('table').sleeping = true
  }

  it('meets its parts as drawn: a can rolls under the top between the legs, another hits a leg and bounces back', () => {
    const s = scene3()
    tableAhead(s)
    // one across the middle (z 0), under the top
    const free = addCan(s, 'free', [0, CAN_RADIUS + 0.001, -0.06], { velocity: [2, 0, 0] })
    // its middle in line with the near legs (z -0.25)
    const blocked = addCan(s, 'blocked', [0, CAN_RADIUS + 0.001, -0.25], { velocity: [2, 0, 0] })
    free.piece.angularVelocity[2] = -2 / CAN_RADIUS
    blocked.piece.angularVelocity[2] = -2 / CAN_RADIUS
    let blockedMost = -Infinity
    run(s.renderer, 1.2, () => {
      blockedMost = Math.max(blockedMost, blocked.root.position.x)
    })
    // under the table and out the other side (the legs are at x 0.45 and 1.55)
    expect(free.root.position.x).toBeGreaterThan(1.6)
    // stopped at the near leg (its face at x 0.425) and came back
    expect(blockedMost).toBeLessThan(0.425)
    expect(blocked.root.position.x).toBeLessThan(blockedMost - 0.05)
  })
})

describe('a can and a tall loose piece', () => {
  it('a can rolled along the floor into a 1.9 m wardrobe that is a piece bounces off it, never through it', () => {
    const s = scene3()
    s.world.addObject('wardrobe', [partState('body', 'wood', { mass: 60 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, 0.6))
    mesh.position.y = 0.95
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(1, 0, 0)
    s.scene.add(root)
    root.updateMatrixWorld(true)
    s.renderer.bind('wardrobe', root, { parts: { body: mesh } })
    s.renderer.makePiece('wardrobe').sleeping = true
    const can = addCan(s, 'can', [0, CAN_RADIUS + 0.001, 0], { velocity: [3, 0, 0] })
    can.piece.angularVelocity[2] = -3 / CAN_RADIUS
    let most = -Infinity
    run(s.renderer, 1, () => {
      most = Math.max(most, can.root.position.x)
    })
    // its face at x 0.5: the can's middle stops a radius short of it, and goes back
    expect(most).toBeLessThan(0.5 - CAN_RADIUS + 0.01)
    expect(can.root.position.x).toBeLessThan(most - 0.05)
  })
})

describe('a fast box into a can', () => {
  it('a book thrown low at 9 m/s into a can asleep knocks it on instead of passing through it', () => {
    const s = scene3()
    const can = addCan(s, 'can', [0, CAN_RADIUS + 0.001, 0])
    run(s.renderer, 1.5)
    expect(can.piece.sleeping).toBe(true)
    s.world.addObject('book', [partState('body', 'paper', { mass: 0.6 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.15))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(-0.4, 0.12, 0)
    s.scene.add(root)
    root.updateMatrixWorld(true)
    s.renderer.bind('book', root, { parts: { body: mesh } })
    s.renderer.makePiece('book', { velocity: [9, 0, 0] })
    const met: Array<{ book: number; can: number; v: number }> = []
    run(s.renderer, 0.2, () => {
      if (met.length === 0 && can.piece.velocity[0] > 0.5) met.push({ book: root.position.x, can: can.root.position.x, v: can.piece.velocity[0] })
    })
    // knocked ahead when they met, the book still behind it then (not through it, as one step of 15 cm would have taken it)
    const first = met[0]
    expect(first).toBeDefined()
    expect(first?.v ?? 0).toBeGreaterThan(1)
    expect(first?.book ?? Infinity).toBeLessThan(first?.can ?? -Infinity)
  })
})

describe('what others meet a piece by after a part comes off it', () => {
  it('a shelf of 14 boards (part boxes, no contacts) that loses its top board is met by the 13 left, not by the one gone', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), eventBudgetMs: Infinity })
    const ids = Array.from({ length: 14 }, (_, i) => `board${i}`)
    world.addObject('shelf', ids.map((id) => partState(id, 'wood', { mass: 1 })), [ids.slice(0, 13), [ids[13] ?? 'board13']])
    const root = new THREE.Group()
    const parts: Record<string, THREE.Mesh> = {}
    ids.forEach((id, i) => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.3))
      board.position.y = 0.01 + i * 0.12
      root.add(board)
      parts[id] = board
    })
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('shelf', root, { parts })
    const piece = renderer.makePiece('shelf') as PieceBody
    expect(piece.contacts).toBeUndefined()
    expect(piece.partBoxes).toHaveLength(14)
    const topOf = (p: PieceBody): number => Math.max(...(p.partBoxes ?? []).map((b) => b.center[1] + b.half[1]))
    const before = topOf(piece)
    world.emit({ type: 'detach', object: 'shelf', joint: 'j', parts: [ids[12] ?? '', ids[13] ?? ''], by: 'break', groups: [ids.slice(0, 13), [ids[13] ?? '']] })
    renderer.update(0)
    expect(piece.partBoxes).toHaveLength(13)
    // the highest box left is the 13th board's: 12 cm under where the one gone was (from the centre of mass, which moved down 6 cm)
    expect(before - topOf(piece)).toBeCloseTo(0.12 - 0.06, 2)
  })
})

describe('fifty cans', () => {
  it('roll and knock about on the floor in little time per frame, and none goes under the floor', () => {
    const s = scene3()
    const cans: Array<{ root: THREE.Group; piece: PieceBody }> = []
    for (let i = 0; i < 50; i++) {
      const x = (i % 10) * 0.15 - 0.7
      const z = Math.floor(i / 10) * 0.2 - 0.4
      const speed = ((i * 37) % 11) / 5 - 1
      const can = addCan(s, `can${i}`, [x, CAN_RADIUS + 0.001, z], { velocity: [speed, 0, 0] })
      can.piece.angularVelocity[2] = -speed / CAN_RADIUS
      cans.push(can)
    }
    // warm up the code paths, then time a second and a half
    run(s.renderer, 0.25)
    const frames: number[] = []
    for (let f = 0; f < 90; f++) {
      const t0 = performance.now()
      s.renderer.update(1 / 60)
      frames.push(performance.now() - t0)
      for (const can of cans) expect(can.root.position.y).toBeGreaterThan(CAN_RADIUS - 0.006)
    }
    frames.sort((a, b) => a - b)
    const median = frames[frames.length >> 1] ?? 0
    // the whole renderer update (pieces, contacts, knocks) for 50 cans; measured 1.4 ms under a load average of 30 on the dev machine; the budget leaves room for a loaded CI
    expect(median).toBeLessThan(6)
  })
})
