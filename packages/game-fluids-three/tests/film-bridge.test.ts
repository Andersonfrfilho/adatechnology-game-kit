import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createFilmLcg, createFluids } from '@adatechnology/game-fluids'
import { createFilmBridge, createFilmManager } from '../src'

const FLOOR = { id: 'floor', point: [0, 0, 0] as [number, number, number], normal: [0, 1, 0] as [number, number, number], halfSize: [8, 8] as [number, number], porosity: 0.05 }

function setup() {
  const fluids = createFluids({ seed: 2 })
  fluids.addSurface(FLOOR)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 1.6, 4)
  const random = createFilmLcg(11)
  const manager = createFilmManager(THREE, { scene, camera, random, fluids, now: () => 0 })
  const bridge = createFilmBridge({ fluids, manager, random })
  const step = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      fluids.update(1 / 60)
      bridge.update(1 / 60)
      manager.update(1 / 60)
    }
  }
  return { fluids, manager, bridge, step }
}

const barrel = (fluids: ReturnType<typeof createFluids>, liquid: string) => {
  fluids.addContainer({ capacity: 18, liquid, liters: 10, shape: { kind: 'box', size: [0.3, 0.4, 0.15] }, opening: 0.02, closed: true }, { id: 'can', position: [0, 0.5, 0] })
  fluids.puncture('can', [0.15, 0.2, 0], [1, 0, 0], 0.004)
}

describe('film bridge', () => {
  it('a leak of fuel drips into the film until the stream ends', () => {
    const { fluids, manager, bridge, step } = setup()
    barrel(fluids, 'fuel')
    step(0.2)
    expect(bridge.leaks).toBe(1)
    step(3)
    const grids = manager.list()
    expect(grids.length).toBeGreaterThan(0)
    expect(grids.every((grid) => grid.profile.id === 'fuel')).toBe(true)
    expect(manager.stats().wetCells + grids.reduce((n, grid) => n + grid.film.drops.launched, 0)).toBeGreaterThan(0)
    fluids.removeContainer('can')
    step(0.5)
    expect(bridge.leaks).toBe(0)
  })

  it('leaves out a liquid with no film (water) and maps one that has none by name (diesel as fuel)', () => {
    const plain = setup()
    barrel(plain.fluids, 'water')
    plain.step(1)
    expect(plain.bridge.leaks).toBe(0)
    expect(plain.manager.gridCount).toBe(0)
    const mapped = createFilmBridge({ fluids: plain.fluids, manager: plain.manager, random: createFilmLcg(1), liquids: { diesel: 'fuel' } })
    plain.fluids.addContainer({ capacity: 18, liquid: 'diesel', liters: 10, shape: { kind: 'box', size: [0.3, 0.4, 0.15] }, opening: 0.02, closed: true }, { id: 'tank', position: [3, 0.5, 0] })
    plain.fluids.puncture('tank', [3.15, 0.2, 0], [1, 0, 0], 0.004)
    plain.fluids.update(1 / 60)
    expect(mapped.leaks).toBe(1)
    mapped.dispose()
  })

  it('a splat with a tint draws the film in its colours and keeps grids of other tints apart', () => {
    const { manager, bridge, step } = setup()
    const fresh = { fresh: 0xaa1010, dry: 0x3a1a10 }
    const old = { fresh: 0x6c1c16, dry: 0x2a160e }
    expect(bridge.splat({ fluid: 'blood', point: [0, 0.6, 0], count: 3, radius: 4, tint: fresh })).toBe(3)
    expect(bridge.splat({ fluid: 'blood', point: [0.1, 0.6, 0.1], count: 2, tint: old })).toBe(2)
    expect(bridge.splat({ fluid: 'blood', point: [0, 0.6, 0.05], count: 1 })).toBe(1)
    step(1)
    const grids = manager.list()
    expect(grids).toHaveLength(3)
    expect(grids.map((grid) => grid.profile.thin).sort()).toEqual([0x6c1c16, 0xaa1010, grids.find((grid) => !grid.tint)!.profile.thin].sort())
    expect(grids.find((grid) => grid.tint === fresh)!.profile.dry).toBe(0x3a1a10)
  })

  it('passes the drying scale on, and the rain washes the fresh blood but not the oil', () => {
    const { manager, bridge, step } = setup()
    bridge.splat({ fluid: 'blood', point: [0, 0.6, 0], count: 4 })
    bridge.splat({ fluid: 'motor_oil', point: [1.5, 0.6, 1.5], count: 4 })
    step(1)
    bridge.setWeather({ rain: 0, drying: 2 })
    expect(manager.list()[0]!.film.weather()).toEqual({ rain: 0, drying: 2 })
    const [blood, oil] = [manager.list().find((grid) => grid.profile.id === 'blood')!, manager.list().find((grid) => grid.profile.id === 'motor_oil')!]
    const oilBefore = oil.film.wetCells()
    expect(blood.film.wetCells()).toBeGreaterThan(0)
    expect(bridge.wash()).toBeGreaterThan(0)
    expect(blood.film.wetCells()).toBe(0)
    expect(oil.film.wetCells()).toBe(oilBefore)
    expect(bridge.wash()).toBe(0)
  })

  it('passes the rain on, and stops feeding after dispose', () => {
    const { manager, bridge, fluids, step } = setup()
    bridge.splat({ fluid: 'blood', point: [0, 0.6, 0] })
    bridge.setWeather({ rain: 0.5 })
    expect(manager.list()[0]!.film.weather().rain).toBe(0.5)
    bridge.dispose()
    barrel(fluids, 'fuel')
    step(0.5)
    expect(bridge.leaks).toBe(0)
  })
})
