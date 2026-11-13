import { createDestruction, waveWork } from '@adatechnology/game-destruction'
import type { BlastCasing } from '@adatechnology/game-destruction'
import { createGoodsItems, goodsText } from '@adatechnology/game-items-goods'
import { createTestRoom } from '@adatechnology/game-test-room'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createItemsTestModule, ITEM_PREFIX, makeupSpec } from '../src'

const stubRenderer = (): THREE.WebGLRenderer =>
  ({ domElement: document.createElement('canvas'), shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined }) as unknown as THREE.WebGLRenderer

describe('a hand grenade beside the shovel of the goods catalog, lying on the floor of the items room', () => {
  it('0.8 m away, throws it at single-digit speed without spinning it like a propeller, and it comes down and rests', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false })
    room.loadModule(createItemsTestModule({ catalog: createGoodsItems(), locale: 'en', translate: goodsText }))
    const { root, objectId } = room.spawn(`${ITEM_PREFIX}shovel`, [0, 0.03, -2.2], Math.PI / 2)
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    const piece = room.renderer.piece(objectId)!
    expect(piece.mass).toBeCloseTo(2, 1)
    room.blastAt('m67', [0.8, 0.05, -2.3])
    room.update(1 / 60)
    expect(Math.hypot(...(piece.velocity as [number, number, number]))).toBeLessThan(12)
    expect(piece.velocity[1]).toBeLessThan(6)
    expect(Math.hypot(...(piece.angularVelocity as [number, number, number]))).toBeLessThan(30)
    let highest = 0
    let towardCharge = 0
    for (let i = 0; i < 420; i++) {
      room.update(1 / 60)
      highest = Math.max(highest, root.position.y)
      // the charge is at +x of the shovel: after the wave nothing pulls it back toward it
      towardCharge = Math.max(towardCharge, piece.velocity[0])
    }
    expect(towardCharge).toBeLessThan(0.05)
    expect(root.position.x).toBeLessThan(-1)
    expect(highest).toBeLessThan(3)
    expect(Math.hypot(...(piece.velocity as [number, number, number]))).toBeLessThan(0.1)
    expect(Math.hypot(root.position.x, root.position.z + 2.2)).toBeLessThan(12)
  })

  it('0.5 m away, its fragments snap the handle, and the room shows it broken: the handle meshes are hidden and its splinters are drawn, the blade stays', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false })
    room.loadModule(createItemsTestModule({ catalog: createGoodsItems(), locale: 'en', translate: goodsText }))
    const { root, objectId } = room.spawn(`${ITEM_PREFIX}shovel`, [0, 0.03, -2.2], Math.PI / 2)
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    const shown = (): boolean[] => {
      const out: boolean[] = []
      root.traverse((child) => (child as THREE.Mesh).isMesh && out.push(child.visible))
      return out
    }
    expect(shown().every(Boolean)).toBe(true)
    // 0.5 m, not the 0.8 m of the throw: the wave cannot snap the handle at any distance here (a 3.5 cm ash stick across 90 cm fails at
    // q = 80 MPa (0.035/0.9)^2 / 0.75 = 0.16 MPa after W = 0.65 q A d = 0.65 x 0.16 MPa x 0.0315 m2 x 0.114 m = 376 J, and the wave gives it 36 J at 0.8 m, 72 J at 0.5 m);
    // the fragments do it. The handle shows the charge A / 4 pi d^2 = 0.0315 / (4 pi 0.25) = 1% of the 1000 pieces at 0.5 m, some ten of about 400 J each, against 0.4% at 0.8 m
    // (four pieces: the room's seed holes it four times and takes 95 of its 800 hit points, it does not snap)
    room.blastAt('m67', [0.5, 0.05, -2.3])
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(room.world.part(objectId, 'handle')?.status).toBe('broken')
    const after = shown()
    expect(after.some((visible) => !visible)).toBe(true)
    expect(after.some(Boolean)).toBe(true)
    expect(room.renderer.stats().fragments).toBeGreaterThan(10)
  })
})

/** The M67 of `@adatechnology/game-weapons` (`explosives.json`): 0.24 kg of TNT, a 190 g steel body in 1000 pieces round 180 g of Composition B. */
const M67_TNT = 0.24
const M67_ENERGY = 200000
const M67_CASING: BlastCasing = { mass: 0.19, material: 'steel', fragments: 1000, chargeMass: 0.18, gurneyVelocity: 2700 }

type V = [number, number, number]
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

// The shovel lies on its side: the handle (0.9 m of hard wood, 3.5 cm square) from x -0.55 to 0.35, the blade (22 x 30 cm, 2 mm of steel) from x 0.25 to 0.55 on the floor.
const BLADE_CENTRE: V = [0.4, 0.006, 0]
const above = (height: number): V => [BLADE_CENTRE[0], height, 0]

const blast = (at: V, seed: number, options: { withCasing: boolean; slab?: boolean }) => {
  const world = createDestruction({ seed })
  const id = world.add(makeupSpec('shovel')!, { id: 'shovel' })
  // a slab of concrete 30 cm thick between the charge and the shovel: a table-top slab, a floor above
  if (options.slab) world.add({ parts: [{ id: 'slab', material: 'concrete', shape: { kind: 'box', size: [4, 0.3, 4] }, position: [0, 0, 0], anchored: true }] }, { id: 'slab', position: [0.4, 0.4, 0] })
  const results = world.explode(at, M67_ENERGY, 15, 'test', { shelter: true, charge: { tnt: M67_TNT, ...(options.withCasing ? { casing: M67_CASING } : {}) } })
  const part = (partId: string) => world.part(id, partId)!
  return { world, results, part }
}

describe('a grenade beside the shovel', () => {
  it('the wave alone, 0.8 m from the blade, bends it with less than 200 J, not the 17 kJ of a tenth of the energy', () => {
    const { part } = blast(above(0.8), 1, { withCasing: false })
    const blade = part('blade')
    expect(blade.dents.length).toBeGreaterThan(0)
    expect(blade.status).not.toBe('broken')
    // the blade is a 22 x 30 cm sheet of 1.1 kg held in nothing: impulse of 300 Pa s on 0.066 m2 against its mass, and 3 MPa through its 2 mm
    const work = waveWork({ tnt: M67_TNT, distance: 0.79, reach: 1, area: 0.301 * 0.22, mass: 1.1, thickness: 0.002 })
    expect(work.energy + work.shock).toBeGreaterThan(20)
    expect(work.energy + work.shock).toBeLessThan(200)
    // the old coupling gave 17.8 kJ x 0.02 hp/J = 356 hp to a blade of 440 hp
    expect(blade.maxHp - blade.hp).toBeLessThan(300)
  })

  it('its fragments hole the handle and the blade, and can snap the handle', () => {
    let handleHoles = 0
    let bladeHoles = 0
    let snapped = 0
    for (const seed of SEEDS) {
      const { part } = blast(above(0.8), seed, { withCasing: true })
      handleHoles += part('handle').holes.length
      bladeHoles += part('blade').holes.length
      if (part('handle').status === 'broken') snapped++
    }
    expect(handleHoles).toBeGreaterThan(0)
    expect(bladeHoles).toBeGreaterThan(SEEDS.length)
    expect(snapped).toBeGreaterThan(0)
    expect(snapped).toBeLessThan(SEEDS.length)
  })

  it('does less the farther it goes off: holes in the blade at 0.8 m, 2.5 m and 6 m, and the hit points it takes', () => {
    const at = (height: number) => {
      let holes = 0
      let lost = 0
      for (const seed of SEEDS) {
        const { part } = blast(above(height), seed, { withCasing: true })
        holes += part('blade').holes.length
        lost += part('blade').maxHp - part('blade').hp
      }
      return { holes, lost }
    }
    const near = at(0.8)
    const middle = at(2.5)
    const far = at(6)
    expect(near.holes).toBeGreaterThan(middle.holes)
    expect(middle.holes).toBeGreaterThanOrEqual(far.holes)
    expect(near.lost).toBeGreaterThan(middle.lost)
    expect(middle.lost).toBeGreaterThan(far.lost)
  })

  it('throws the same pieces every time for a seed', () => {
    const run = () => blast(above(0.8), 7, { withCasing: true }).results.map((r) => [r.object, r.part, r.damage])
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })

  it('is stopped by a concrete slab over the shovel: no hole, and the wave takes far less of the blade', () => {
    let openHoles = 0
    let shieldedHoles = 0
    let openLost = 0
    let shieldedLost = 0
    for (const seed of SEEDS) {
      const open = blast(above(0.8), seed, { withCasing: true })
      const shielded = blast(above(0.8), seed, { withCasing: true, slab: true })
      openHoles += open.part('blade').holes.length + open.part('handle').holes.length
      shieldedHoles += shielded.part('blade').holes.length + shielded.part('handle').holes.length
      openLost += open.part('blade').maxHp - open.part('blade').hp
      shieldedLost += shielded.part('blade').maxHp - shielded.part('blade').hp
    }
    expect(openHoles).toBeGreaterThan(0)
    expect(shieldedHoles).toBe(0)
    expect(shieldedLost).toBeLessThan(openLost * 0.3)
  })
})
