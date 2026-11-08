import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Vec3 } from '@adatechnology/game-destruction'
import { createVfx } from '@adatechnology/game-vfx'
import type { Follow } from '@adatechnology/game-vfx'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

/** Lasting emitters of a broken object (grit trickling off a broken face, its fire) go with the object as it tips or falls apart, never stay where it stood. */

type Burst = { kind: string; point: Vec3 }

function setup() {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const vfx = createVfx({ seed: 7 })
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), vfx, eventBudgetMs: Infinity })
  const bursts: Burst[] = []
  const burst = vfx.burst.bind(vfx)
  vi.spyOn(vfx, 'burst').mockImplementation((kind, point, ...rest) => {
    bursts.push({ kind, point: [point[0], point[1], point[2]] })
    return burst(kind, point, ...rest)
  })
  return { scene, world, vfx, renderer, bursts }
}

/** A wooden cabinet: one board standing 1.8 m tall, its root on the floor. */
function cabinet(ctx: ReturnType<typeof setup>) {
  ctx.world.addObject('cabinet', [partState('side', 'wood', { mass: 30 })])
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x8a6a4a }))
  side.position.y = 0.9
  const root = new THREE.Group()
  root.add(side)
  ctx.scene.add(root)
  root.updateMatrixWorld(true)
  ctx.renderer.bind('cabinet', root, { parts: { side } })
  return { root, side }
}

const distance = (a: Vec3, b: THREE.Vector3): number => Math.hypot(a[0] - b.x, a[1] - b.y, a[2] - b.z)

describe('lasting emitters follow the body they broke on', () => {
  it('grit trickling off a broken face falls from where the face is now, after the object tipped over', () => {
    const ctx = setup()
    const { root, side } = cabinet(ctx)
    const hit: Vec3 = [0, 1.5, 0.2]
    ctx.world.emit({ type: 'spall', object: 'cabinet', part: 'side', layer: 0, point: hit, area: 0.002 })
    ctx.renderer.update(1 / 60)
    const local = side.worldToLocal(new THREE.Vector3(...hit))

    // the cabinet tips onto its back and slides away
    root.position.set(2, 0, -1)
    root.rotation.set(-Math.PI / 2, 0, 0)
    root.updateMatrixWorld(true)
    ctx.bursts.length = 0
    for (let i = 0; i < 60; i++) ctx.renderer.update(1 / 60)

    const grit = ctx.bursts.filter((b) => b.kind === 'chips')
    expect(grit.length).toBeGreaterThan(0)
    const now = side.localToWorld(local.clone())
    for (const b of grit) {
      expect(distance(b.point, now)).toBeLessThan(1e-4)
      expect(distance(b.point, new THREE.Vector3(...hit))).toBeGreaterThan(1)
    }
  })

  it('grit follows a piece that came off and fell as a body of its own', () => {
    const ctx = setup()
    ctx.world.addObject('chair', [partState('seat', 'wood', { mass: 3 }), partState('leg', 'wood', { mass: 1 })], [['seat'], ['leg']])
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5))
    seat.position.y = 2
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05))
    leg.position.set(0.2, 1.75, 0.2)
    const root = new THREE.Group()
    root.add(seat, leg)
    ctx.scene.add(root)
    root.updateMatrixWorld(true)
    ctx.renderer.bind('chair', root, { parts: { seat, leg } })

    const hit: Vec3 = [0.2, 1.7, 0.225]
    ctx.world.emit({ type: 'spall', object: 'chair', part: 'leg', layer: 0, point: hit, area: 0.0005 })
    ctx.renderer.update(1 / 60)
    const local = leg.worldToLocal(new THREE.Vector3(...hit))
    ctx.world.emit({ type: 'detach', object: 'chair', joint: 'j', parts: ['seat', 'leg'], by: 'break', groups: [['seat'], ['leg']] })
    ctx.renderer.update(0)
    expect(leg.parent).not.toBe(root)

    let checked = 0
    for (let i = 0; i < 90; i++) {
      ctx.bursts.length = 0
      ctx.renderer.update(1 / 60)
      const now = leg.localToWorld(local.clone())
      for (const b of ctx.bursts.filter((x) => x.kind === 'chips')) {
        expect(distance(b.point, now)).toBeLessThan(1e-3)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
    // it ended up on the floor, far below where it was hit
    expect(leg.localToWorld(local.clone()).y).toBeLessThan(0.3)
  })

  it('grit stops when the face it fell from is no longer drawn', () => {
    const ctx = setup()
    const { side } = cabinet(ctx)
    ctx.world.emit({ type: 'spall', object: 'cabinet', part: 'side', layer: 0, point: [0, 1.5, 0.2], area: 0.002 })
    ctx.renderer.update(1 / 60)
    side.visible = false
    ctx.bursts.length = 0
    for (let i = 0; i < 120; i++) ctx.renderer.update(1 / 60)
    expect(ctx.bursts.filter((b) => b.kind === 'chips')).toHaveLength(0)
  })

  it('the fire of a burning piece goes on with the piece as it falls, not where the object stood', () => {
    const ctx = setup()
    ctx.world.addObject('chair', [partState('seat', 'wood', { mass: 3 }), partState('leg', 'wood', { mass: 1, burning: true })], [['seat'], ['leg']])
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5))
    seat.position.y = 2
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05))
    leg.position.set(0.2, 1.75, 0.2)
    const root = new THREE.Group()
    root.add(seat, leg)
    ctx.scene.add(root)
    root.updateMatrixWorld(true)
    ctx.renderer.bind('chair', root, { parts: { seat, leg } })
    const follows: Follow[] = []
    const fire = ctx.vfx.fire.bind(ctx.vfx)
    vi.spyOn(ctx.vfx, 'fire').mockImplementation((options) => {
      if (options.follow) follows.push(options.follow)
      return fire(options)
    })
    const stop = vi.spyOn(ctx.vfx, 'stop')

    ctx.world.emit({ type: 'ignite', object: 'chair', part: 'leg', point: [0.2, 1.6, 0.2] })
    for (let i = 0; i < 30; i++) ctx.renderer.update(1 / 60)
    expect(follows).toHaveLength(1)
    const followed = follows[0]!
    const follow = 'position' in followed ? followed.position : followed
    expect(follow.y).toBeGreaterThan(1.5)

    ctx.world.emit({ type: 'detach', object: 'chair', joint: 'j', parts: ['seat', 'leg'], by: 'break', groups: [['seat'], ['leg']] })
    for (let i = 0; i < 240; i++) ctx.renderer.update(1 / 60)
    expect(stop).not.toHaveBeenCalled()
    expect(follows).toHaveLength(1)
    const box = new THREE.Box3().setFromObject(leg)
    expect(follow.y).toBeCloseTo(box.min.y, 2)
    expect(follow.y).toBeLessThan(0.3)
  })
})
