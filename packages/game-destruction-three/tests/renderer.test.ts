import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { Piece, RendererOptions } from '../src/types'
import { FakeWorld, partState } from './fake-world'

function setup(opts: Partial<RendererOptions> = {}) {
  const scene = new THREE.Scene()
  const hostMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())
  scene.add(hostMesh)
  const world = new FakeWorld()
  const sounds: string[] = []
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), onSound: (k) => sounds.push(k), ...opts })
  return { scene, world, renderer, hostMesh, sounds }
}

function positions(mesh: THREE.Mesh): Float32Array {
  return new Float32Array((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as ArrayLike<number>)
}

const frag = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  part: 'top',
  material: 'glass',
  shape: 'shard' as const,
  center: [0, 1.5, 0] as [number, number, number],
  size: [0.2, 0.15, 0.01] as [number, number, number],
  rotation: [0.3, 0.2, 0.1, 0.92] as [number, number, number, number],
  velocity: [1, 2, 0.5] as [number, number, number],
  angularVelocity: [4, 3, 2] as [number, number, number],
  mass: 0.2,
  ...over,
})

describe('dents', () => {
  it('displaces only vertices within the radius and restore() puts them back', () => {
    const { world, renderer } = setup()
    world.addObject('o1', [partState('plate', 'steel')])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 10, 10, 10), new THREE.MeshStandardMaterial({ color: 0x888888 }))
    const root = new THREE.Group()
    root.add(mesh)
    root.updateMatrixWorld(true)
    renderer.bind('o1', root, { parts: { plate: mesh } })
    const original = mesh.geometry
    const before = positions(mesh)
    world.emit({
      type: 'dent',
      object: 'o1',
      part: 'plate',
      worldPoint: [0, 0.5, 0],
      dent: { point: [0, 0.5, 0], normal: [0, 1, 0], radius: 0.25, depth: 0.05 },
    })
    renderer.update(0.016)
    expect(mesh.geometry).not.toBe(original)
    const after = positions(mesh)
    let changed = 0
    for (let i = 0; i < before.length; i += 3) {
      const d = Math.hypot(before[i], before[i + 1] - 0.5, before[i + 2])
      const moved = Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i] - before[i]) + Math.abs(after[i + 2] - before[i + 2])
      if (d >= 0.25) expect(moved).toBe(0)
      else if (moved > 0) changed++
    }
    expect(changed).toBeGreaterThan(5)
    // the host's original geometry was not touched
    expect(positions(new THREE.Mesh(original))).toEqual(before)
    renderer.restore('o1')
    expect(mesh.geometry).toBe(original)
    expect(positions(mesh)).toEqual(before)
  })

  it('skips heavy meshes on low quality', () => {
    const { world, renderer } = setup({ quality: 'low' })
    world.addObject('o1', [partState('plate', 'steel')])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 60, 60, 60))
    const root = new THREE.Group()
    root.add(mesh)
    renderer.bind('o1', root, { parts: { plate: mesh } })
    const g = mesh.geometry
    world.emit({ type: 'dent', object: 'o1', part: 'plate', worldPoint: [0, 0.5, 0], dent: { point: [0, 0.5, 0], normal: [0, 1, 0], radius: 0.25, depth: 0.05 } })
    renderer.update(0.016)
    expect(mesh.geometry).toBe(g)
  })
})

describe('holes and cracks', () => {
  it('adds decals as children of the mesh and removes them on restore', () => {
    const { world, renderer } = setup()
    world.addObject('o1', [partState('plate', 'steel'), partState('top', 'glass')])
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1))
    b.position.y = 2
    const root = new THREE.Group()
    root.add(a, b)
    root.updateMatrixWorld(true)
    renderer.bind('o1', root, { parts: { plate: a, top: b } })
    world.emit({ type: 'hole', object: 'o1', part: 'plate', worldPoint: [0, 0.5, 0], exitPoint: [0, -0.5, 0], hole: { point: [0, 0.5, 0], normal: [0, 1, 0], diameter: 0.02, through: true } })
    world.emit({ type: 'hole', object: 'o1', part: 'top', worldPoint: [0, 2.025, 0], hole: { point: [0, 0.025, 0], normal: [0, 1, 0], diameter: 0.02, through: false } })
    world.emit({ type: 'crack', object: 'o1', part: 'top', worldPoint: [0.2, 2.025, 0], crack: { point: [0.2, 0, 0], normal: [0, 1, 0], length: 0.3, rays: 6 } })
    renderer.update(0.016)
    expect(a.children.length).toBe(2) // entry and exit discs
    expect(a.children[0]).toBeInstanceOf(THREE.Mesh)
    expect(b.children.length).toBe(2) // glass: crack stars instead of discs
    expect(b.children.every((c) => c instanceof THREE.LineSegments)).toBe(true)
    expect(renderer.stats().decals).toBe(4)
    renderer.restore('o1')
    expect(a.children.length + b.children.length).toBe(0)
    expect(renderer.stats().decals).toBe(0)
  })
})

describe('fracture', () => {
  it('hides the part mesh, spawns fragments that fall and rest above the ground', () => {
    const { scene, world, renderer, sounds } = setup()
    world.addObject('o1', [partState('top', 'glass')])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshStandardMaterial({ color: 0x99ccee, transparent: true, opacity: 0.4 }))
    mesh.position.y = 1.5
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('o1', root, { parts: { top: mesh } })
    const before = scene.children.length
    const fragments = Array.from({ length: 6 }, (_, i) => frag(`f${i}`, { center: [i * 0.1 - 0.3, 1.5, 0] }))
    world.emit({ type: 'fracture', object: 'o1', part: 'top', style: 'shatter', fragments, point: [0, 1.5, 0] })
    renderer.update(0.016)
    expect(mesh.visible).toBe(false)
    expect(renderer.stats().fragments).toBe(6)
    expect(scene.children.length).toBeGreaterThan(before + 5)
    expect(sounds).toContain('shatter_glass')
    for (let i = 0; i < 400; i++) renderer.update(1 / 60)
    const frags = scene.children.filter((c) => c instanceof THREE.Mesh && c !== mesh && c.scale.z < 0.02) as THREE.Mesh[]
    expect(frags.length).toBe(6)
    for (const f of frags) {
      expect(f.position.y).toBeGreaterThanOrEqual(0)
      expect(f.position.y).toBeLessThan(0.2)
    }
    // at rest: nothing moves any more
    const snap = frags.map((f) => f.position.clone())
    for (let i = 0; i < 30; i++) renderer.update(1 / 60)
    frags.forEach((f, i) => expect(f.position.distanceTo(snap[i])).toBeLessThan(1e-6))
    renderer.restore('o1')
    expect(mesh.visible).toBe(true)
    expect(renderer.stats().fragments).toBe(0)
  })

  it('respects maxFragments and fades fragments after fragmentLife', () => {
    const { world, renderer } = setup({ maxFragments: 5, fragmentLife: 1 })
    world.addObject('o1', [partState('top', 'glass')])
    const fragments = Array.from({ length: 12 }, (_, i) => frag(`f${i}`, { velocity: [0, 0, 0] }))
    world.emit({ type: 'fracture', object: 'o1', part: 'top', style: 'shatter', fragments, point: [0, 1, 0] })
    renderer.update(0.016)
    for (let i = 0; i < 60; i++) renderer.update(1 / 60) // shrink-away of the 7 over budget
    expect(renderer.stats().fragments).toBeLessThanOrEqual(5)
    for (let i = 0; i < 400; i++) renderer.update(1 / 60)
    expect(renderer.stats().fragments).toBe(0)
  })
})

describe('detach and pieces', () => {
  it('creates a piece from a loose group, keeps world transforms and calls onPiece', () => {
    const onPiece = vi.fn()
    const ctx = setup({ onPiece })
    ctx.world.addObject('chair', [partState('seat', 'wood', { mass: 3 }), partState('leg', 'wood', { mass: 1 })], [['seat'], ['leg']])
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5))
    seat.position.y = 2
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05))
    legMesh.position.set(0.2, 1.75, 0.2)
    const group = new THREE.Group()
    group.position.set(1, 0, 0)
    group.add(seat, legMesh)
    ctx.scene.add(group)
    group.updateMatrixWorld(true)
    ctx.renderer.bind('chair', group, { parts: { seat, leg: legMesh } })
    const worldBefore = legMesh.getWorldPosition(new THREE.Vector3())

    ctx.world.emit({ type: 'detach', object: 'chair', joint: 'j', parts: ['seat', 'leg'], by: 'break', groups: [['seat'], ['leg']] })
    ctx.renderer.update(0)
    expect(ctx.world.splits).toHaveLength(1)
    expect(ctx.world.splits[0]).toMatchObject({ id: 'chair', group: 1 })
    expect(onPiece).toHaveBeenCalledTimes(1)
    const piece = onPiece.mock.calls[0][0] as Piece
    expect(piece.objectId).toBe(ctx.world.splits[0].newId)
    expect(ctx.renderer.pieces()).toHaveLength(1)
    expect(ctx.renderer.piece(piece.objectId)).toBe(piece)
    expect(legMesh.parent).toBe(piece.root)
    expect(piece.root).not.toBe(group)
    expect(piece.root.parent).toBe(ctx.scene)
    expect(seat.parent).toBe(group)
    expect(legMesh.getWorldPosition(new THREE.Vector3()).distanceTo(worldBefore)).toBeLessThan(1e-5)
    expect(piece.halfExtents[1]).toBeCloseTo(0.2, 2)
    expect(piece.mass).toBeCloseTo(1, 5)

    // it falls and comes to rest on the ground, and the world follows
    for (let i = 0; i < 300; i++) ctx.renderer.update(1 / 60)
    expect(piece.sleeping).toBe(true)
    const y = legMesh.getWorldPosition(new THREE.Vector3()).y
    // a thin leg ends up lying on its side, resting on the ground
    expect(y).toBeGreaterThan(0.015)
    expect(y).toBeLessThan(0.06)
    const last = ctx.world.transforms.filter((t) => t.id === piece.objectId).at(-1)
    expect(last).toBeDefined()
    expect(last?.position[1]).toBeLessThan(0.5) // the group origin, not the centre of mass

    // a hard landing was reported as a blunt hit on the piece
    expect(ctx.world.hits.some((h) => h.id === piece.objectId && h.hit.type === 'blunt' && (h.hit.energy ?? 0) > 0)).toBe(true)

    // restore brings the leg back to the original root
    ctx.renderer.restore('chair')
    expect(legMesh.parent).toBe(group)
    expect(legMesh.position.toArray()).toEqual([0.2, 1.75, 0.2])
    expect(ctx.renderer.pieces()).toHaveLength(0)
  })

  it('does not split when autoSplit is false', () => {
    const ctx = setup({ autoSplit: false })
    ctx.world.addObject('c', [partState('a', 'wood'), partState('b', 'wood')], [['a'], ['b']])
    ctx.world.emit({ type: 'detach', object: 'c', joint: 'j', parts: ['a', 'b'], by: 'break', groups: [['a'], ['b']] })
    ctx.renderer.bind('c', new THREE.Group())
    ctx.renderer.update(0)
    expect(ctx.world.splits).toHaveLength(0)
  })

  it('makePiece settles a box and impulse wakes it', () => {
    const { world, renderer, scene } = setup()
    world.addObject('crate', [partState('box', 'wood', { mass: 10 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(0, 1, 0)
    root.rotation.set(0.4, 0.3, 0.2)
    scene.add(root)
    renderer.bind('crate', root, { parts: { box: mesh } })
    const piece = renderer.makePiece('crate')
    expect(piece.mass).toBe(10)
    for (let i = 0; i < 400; i++) renderer.update(1 / 60)
    expect(piece.sleeping).toBe(true)
    // lowest corner is on the ground (no sinking, no hovering)
    const box = new THREE.Box3().setFromObject(root)
    expect(box.min.y).toBeGreaterThan(-0.03)
    expect(box.min.y).toBeLessThan(0.03)
    renderer.impulse('crate', [30, 20, 0], [0, 0.2, 0.2])
    expect(piece.sleeping).toBe(false)
    expect(piece.velocity[0]).toBeCloseTo(3, 5)
    renderer.update(1 / 60)
    expect(root.position.x).toBeGreaterThan(0)
    // held pieces are not integrated
    piece.held = true
    const p = root.position.clone()
    for (let i = 0; i < 30; i++) renderer.update(1 / 60)
    expect(root.position.distanceTo(p)).toBe(0)
  })
})

describe('piece centre of mass', () => {
  it('exposes localCenter: the centre of the meshes relative to the root origin', () => {
    const { world, renderer, scene } = setup()
    world.addObject('plank', [partState('box', 'wood', { mass: 4 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.2))
    mesh.position.set(0.5, 0.1, 0)
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(3, 1, 0)
    scene.add(root)
    renderer.bind('plank', root, { parts: { box: mesh } })
    const piece = renderer.makePiece('plank')
    expect(piece.localCenter[0]).toBeCloseTo(0.5, 5)
    expect(piece.localCenter[1]).toBeCloseTo(0.1, 5)
    expect(piece.localCenter[2]).toBeCloseTo(0, 5)
    // it is a plain copy: the renderer keeps working from its own state
    piece.localCenter[0] = 99
    for (let i = 0; i < 60; i++) renderer.update(1 / 60)
    expect(Number.isFinite(root.position.x)).toBe(true)
  })
})

describe('hard landing', () => {
  it('syncs the world transform before it reports the landing hit', () => {
    const { world, renderer, scene } = setup()
    world.addObject('crate', [partState('box', 'wood', { mass: 10 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(0, 2, 0)
    scene.add(root)
    renderer.bind('crate', root, { parts: { box: mesh } })
    renderer.makePiece('crate')
    let seen: { synced: number | null; actual: number } | null = null
    const origHit = world.hit.bind(world)
    world.hit = (id, hit) => {
      const t = world.transforms[world.transforms.length - 1]
      seen ??= { synced: t ? t.position[1] : null, actual: root.position.y }
      return origHit(id, hit)
    }
    for (let i = 0; i < 120 && !seen; i++) renderer.update(1 / 60)
    expect(seen).not.toBeNull()
    // at the moment of the hit the world already knows where the crate landed
    expect(seen!.synced).not.toBeNull()
    expect(Math.abs(seen!.synced! - seen!.actual)).toBeLessThan(1e-6)
  })
})

describe('fire, heat and melt', () => {
  it('sends burn_loop when a part starts to burn and burn_end when it burns out or is put out', () => {
    const { world, renderer, sounds } = setup()
    world.addObject('o1', [partState('plank', 'wood'), partState('beam', 'wood')])
    const root = new THREE.Group()
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), new THREE.MeshStandardMaterial())
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), new THREE.MeshStandardMaterial())
    root.add(plank, beam)
    renderer.bind('o1', root, { parts: { plank, beam } })
    world.emit({ type: 'ignite', object: 'o1', part: 'plank', point: [0, 0.05, 0] })
    world.emit({ type: 'primed', object: 'o1', part: 'beam', point: [0, 0.05, 0], trigger: 'shot', delay: 1 })
    world.emit({ type: 'burnout', object: 'o1', part: 'plank', point: [0, 0.05, 0] })
    world.emit({ type: 'extinguish', object: 'o1', part: 'beam' })
    // a part that is not burning (any more) is put out without a second burn_end
    world.emit({ type: 'extinguish', object: 'o1', part: 'beam' })
    renderer.update(1 / 60)
    expect(sounds.filter((key) => key.startsWith('burn_'))).toEqual(['burn_loop', 'burn_loop', 'burn_end', 'burn_end'])
  })

  it('chars a cloned material and emits fire and smoke while burning', () => {
    const { world, renderer } = setup()
    const st = world.addObject('o1', [partState('plank', 'wood')])
    const orig = new THREE.MeshStandardMaterial({ color: 0xaa7744 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), orig)
    const root = new THREE.Group()
    root.add(mesh)
    renderer.bind('o1', root, { parts: { plank: mesh } })
    const ps = st.parts[0]
    ps.burning = true
    ps.char = 0.5
    ps.temperature = 600
    world.emit({ type: 'ignite', object: 'o1', part: 'plank', point: [0, 0.05, 0] })
    for (let i = 0; i < 30; i++) renderer.update(1 / 60)
    expect(renderer.stats().particles).toBeGreaterThan(10)
    expect(mesh.material).not.toBe(orig)
    expect(orig.color.getHex()).toBe(0xaa7744)
    const c = (mesh.material as THREE.MeshStandardMaterial).color
    expect(c.r).toBeLessThan(orig.color.r)
    ps.burning = false
    ps.char = 1
    world.emit({ type: 'burnout', object: 'o1', part: 'plank', point: [0, 0.05, 0] })
    renderer.update(1 / 60)
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x111111)
    renderer.restore('o1')
    expect(mesh.material).toBe(orig)
  })

  it('shows fire on a part primed by a shot or fire, and nothing for one primed by a nearby blast', () => {
    const { world, renderer } = setup()
    world.addObject('o1', [partState('drum', 'steel')])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x9b1c18 }))
    const root = new THREE.Group()
    root.add(mesh)
    renderer.bind('o1', root, { parts: { drum: mesh } })
    world.emit({ type: 'primed', object: 'o1', part: 'drum', point: [0, 0.3, 0], trigger: 'explosion', delay: 0.3 })
    for (let i = 0; i < 30; i++) renderer.update(1 / 60)
    const quiet = renderer.stats().particles
    world.emit({ type: 'primed', object: 'o1', part: 'drum', point: [0, 0.3, 0], trigger: 'shot', delay: 1.2 })
    for (let i = 0; i < 30; i++) renderer.update(1 / 60)
    expect(quiet).toBe(0)
    expect(renderer.stats().particles).toBeGreaterThan(0)
  })

  it('glows when a metal part is hot, and cools back', () => {
    const { world, renderer } = setup()
    const st = world.addObject('o1', [partState('bar', 'steel')])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x777777 }))
    const root = new THREE.Group()
    root.add(mesh)
    renderer.bind('o1', root, { parts: { bar: mesh } })
    st.parts[0].temperature = 900
    world.emit({ type: 'damage', object: 'o1', part: 'bar', amount: 1, hp: 99, damageType: 'heat' })
    renderer.update(1 / 60)
    const m = mesh.material as THREE.MeshStandardMaterial
    expect(m.emissive.getHex()).not.toBe(0)
    st.parts[0].temperature = 100
    renderer.update(1 / 60)
    expect(m.emissive.getHex()).toBe(0)
  })

  it('sags a melting part, keeps its bottom, then leaves a puddle when melted', () => {
    const { world, renderer, scene } = setup()
    const st = world.addObject('o1', [partState('bar', 'steel')])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.4, 2, 4, 2))
    mesh.position.y = 0.5
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('o1', root, { parts: { bar: mesh } })
    st.parts[0].melt = 0.6
    st.parts[0].temperature = 1500
    world.emit({ type: 'melt', object: 'o1', part: 'bar', melt: 0.6 })
    renderer.update(1 / 60)
    const box = new THREE.Box3().setFromObject(mesh)
    expect(box.max.y - box.min.y).toBeLessThan(0.6)
    expect(box.min.y).toBeCloseTo(0, 3)
    st.parts[0].melt = 1
    st.parts[0].status = 'melted'
    world.emit({ type: 'melt', object: 'o1', part: 'bar', melt: 1 })
    renderer.update(1 / 60)
    expect(mesh.visible).toBe(false)
    expect(renderer.stats().decals).toBe(1)
    renderer.restore('o1')
    expect(mesh.visible).toBe(true)
    expect(mesh.scale.y).toBe(1)
    expect(mesh.position.y).toBe(0.5)
    expect(renderer.stats().decals).toBe(0)
  })

  it('drips land and leave a puddle', () => {
    const { world, renderer } = setup()
    world.addObject('o1', [partState('bar', 'steel')])
    renderer.bind('o1', new THREE.Group())
    world.emit({ type: 'drip', object: 'o1', part: 'bar', point: [0, 0.5, 0], material: 'steel' })
    for (let i = 0; i < 60; i++) renderer.update(1 / 60)
    expect(renderer.stats().decals).toBe(1)
  })
})

describe('leaks', () => {
  it('streams while the part has liters and stops at zero', () => {
    const { world, renderer } = setup()
    const st = world.addObject('o1', [partState('tank', 'steel', { liters: 5 })])
    void st
    renderer.bind('o1', new THREE.Group())
    world.emit({ type: 'leak', object: 'o1', part: 'tank', fluid: 'water', point: [0, 1, 0], direction: [1, 0, 0], rate: 0.1, pressurized: true })
    for (let i = 0; i < 20; i++) renderer.update(1 / 60)
    expect(renderer.stats().particles).toBeGreaterThan(5)
    world.part('o1', 'tank')!.liters = 0
    for (let i = 0; i < 400; i++) renderer.update(1 / 60) // every particle expires
    expect(renderer.stats().particles).toBe(0)
  })
})

describe('particles and explosions', () => {
  it('never exceeds maxParticles', () => {
    const { renderer } = setup({ maxParticles: 120 })
    for (let k = 0; k < 40; k++) {
      renderer.emit('sparks', [0, 1, 0], [0, 1, 0], 30, 3)
      renderer.emit('smoke', [0, 1, 0], [0, 1, 0], 30, 1)
      renderer.emit('foam', [0, 1, 0], [0, 1, 0], 30, 1)
      renderer.update(1 / 60)
      expect(renderer.stats().particles).toBeLessThanOrEqual(120)
    }
    expect(renderer.stats().particles).toBeGreaterThan(30)
  })

  it('halves the budget on low quality', () => {
    const { renderer } = setup({ maxParticles: 200, quality: 'low' })
    for (let k = 0; k < 50; k++) renderer.emit('smoke', [0, 1, 0], [0, 1, 0], 40, 1)
    renderer.update(0.001)
    expect(renderer.stats().particles).toBeLessThanOrEqual(100)
  })

  it('explodes: flash light, particles, sound and impulses on pieces in range', () => {
    const { scene, world, renderer, sounds } = setup()
    world.addObject('crate', [partState('box', 'wood', { mass: 5 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(1, 0.2, 0)
    scene.add(root)
    renderer.bind('crate', root, { parts: { box: mesh } })
    const piece = renderer.makePiece('crate')
    for (let i = 0; i < 90; i++) renderer.update(1 / 60)
    expect(piece.sleeping).toBe(true)
    world.emit({ type: 'explode', object: 'bomb', part: 'tank', point: [0, 0.3, 0], energy: 200000, radius: 4 })
    renderer.update(1 / 60)
    expect(sounds).toContain('explode')
    expect(scene.children.some((c) => c instanceof THREE.PointLight)).toBe(true)
    expect(piece.sleeping).toBe(false)
    expect(piece.velocity[0]).toBeGreaterThan(1)
    expect(renderer.stats().particles).toBeGreaterThan(50)
  })
})

describe('explode without an exploding part', () => {
  it('draws flash, fire, smoke, light and sound, and shoves pieces, like an `explode` event', () => {
    const { scene, renderer, sounds } = setup()
    renderer.explode([0, 0.3, 0], 200000, 4)
    renderer.update(1 / 60)
    expect(sounds).toContain('explode')
    expect(scene.children.some((c) => c instanceof THREE.PointLight)).toBe(true)
    const additive = scene.getObjectByName('destruction-particles-additive') as THREE.Points
    const normal = scene.getObjectByName('destruction-particles') as THREE.Points
    const alphaOf = (points: THREE.Points): Float32Array => points.geometry.getAttribute('alpha').array as Float32Array
    expect(alphaOf(additive).some((a) => a > 0.5)).toBe(true)
    expect(alphaOf(normal).some((a) => a > 0)).toBe(true)
  })
})

describe('clear and dispose', () => {
  it('leaves the scene with only what the host added', () => {
    const { scene, world, renderer, hostMesh } = setup()
    world.addObject('o1', [partState('plate', 'steel'), partState('top', 'glass'), partState('leg', 'wood')], [['plate', 'top'], ['leg']])
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 6, 6, 6), new THREE.MeshStandardMaterial())
    const top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1))
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1))
    const root = new THREE.Group()
    root.add(plate, top, leg)
    scene.add(root)
    renderer.bind('o1', root, { parts: { plate, top, leg } })
    const hostChildren = [...scene.children]
    const plateGeo = plate.geometry
    world.emit({ type: 'dent', object: 'o1', part: 'plate', worldPoint: [0, 0.5, 0], dent: { point: [0, 0.5, 0], normal: [0, 1, 0], radius: 0.2, depth: 0.03 } })
    world.emit({ type: 'hole', object: 'o1', part: 'plate', worldPoint: [0, 0.5, 0], hole: { point: [0, 0.5, 0], normal: [0, 1, 0], diameter: 0.02, through: false } })
    world.emit({ type: 'fracture', object: 'o1', part: 'top', style: 'shatter', fragments: [frag('f1'), frag('f2')], point: [0, 1, 0] })
    world.emit({ type: 'detach', object: 'o1', joint: 'j', parts: ['plate', 'leg'], by: 'break', groups: [['plate', 'top'], ['leg']] })
    world.emit({ type: 'explode', object: 'o1', part: 'plate', point: [0, 0, 0], energy: 1000, radius: 2 })
    world.emit({ type: 'drip', object: 'o1', part: 'plate', point: [0, 0.5, 0], material: 'steel' })
    renderer.update(1 / 60)
    for (let i = 0; i < 20; i++) renderer.update(1 / 60)
    expect(scene.children.length).toBeGreaterThan(hostChildren.length)
    renderer.clear()
    expect(scene.children).toEqual(hostChildren)
    expect(plate.geometry).toBe(plateGeo)
    expect(plate.children).toHaveLength(0)
    expect(top.visible).toBe(true)
    expect(leg.parent).toBe(root)
    expect(renderer.stats()).toEqual({ fragments: 0, particles: 0, pieces: 0, decals: 0 })
    renderer.dispose()
    expect(scene.children).toEqual(hostChildren)
    expect(hostMesh.parent).toBe(scene)
  })

  it('stops listening after dispose', () => {
    const { world, renderer } = setup()
    renderer.dispose()
    expect(world.handlers).toHaveLength(0)
  })
})
