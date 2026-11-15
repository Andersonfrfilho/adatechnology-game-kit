import { describe, expect, it } from 'vitest'

import { createTerrain } from '../src'
import type { GroundLoss } from '@adatechnology/game-contracts'

const ground = (surface = 'dirt', onGroundLoss?: (loss: GroundLoss) => void) =>
  createTerrain({ bounds: [-5, -5, 5, 5], cellSize: 0.1, layout: { surface }, ...(onGroundLoss ? { onGroundLoss } : {}) })

/** The earth heaped on the ground (loose), in cubic metres, over the whole terrain. */
function heaped(terrain: ReturnType<typeof ground>): number {
  let volume = 0
  for (let x = -5; x <= 5 + 1e-9; x += 0.1) for (let z = -5; z <= 5 + 1e-9; z += 0.1) volume += terrain.columnAt(x, z).loose * 0.01
  return volume
}

describe('a shovel digs the ground (Terrain.dig, Terrain.fill)', () => {
  it('each shovelful takes its bite down: N in one place make a hole N times as deep, with the volume of the bites', () => {
    const terrain = ground()
    let volume = 0
    for (let k = 0; k < 3; k++) volume += terrain.dig({ x: 0, z: 0, depth: 0.2 }).volume
    expect(terrain.heightAt(0, 0)).toBeCloseTo(-0.6, 3)
    // a 0.3 x 0.3 m bite, 0.2 m deep: 0.018 m³ a shovelful
    expect(volume).toBeCloseTo(3 * 0.09 * 0.2, 4)
  })

  it('the earth taken is the earth heaped where it is thrown (its volume kept)', () => {
    const terrain = ground()
    let volume = 0
    for (let k = 0; k < 4; k++) volume += terrain.dig({ x: 0, z: 0, dump: { x: 1, z: 0 } }).volume
    expect(heaped(terrain)).toBeCloseTo(volume, 3)
    expect(terrain.heightAt(1, 0)).toBeGreaterThan(0.05)
  })

  it('it does not dig concrete, nor stone under the soil: the blade stops there', () => {
    const slab = ground('concrete_slab')
    const blow = slab.dig({ x: 0, z: 0 })
    expect(blow.volume).toBe(0)
    expect(blow.refused).toBe('concrete')
    expect(slab.heightAt(0, 0)).toBeCloseTo(0, 6)
    // dirt is 1.8 m of soil on stone: digging past it stops at the stone
    const dirt = ground()
    for (let k = 0; k < 12; k++) dirt.dig({ x: 0, z: 0, depth: 0.2 })
    expect(dirt.heightAt(0, 0)).toBeCloseTo(-1.8, 3)
    expect(dirt.dig({ x: 0, z: 0 }).refused).toBe('stone')
  })

  it('harder ground is harder work: clay and gravel cost more than soil, sand less', () => {
    const effort = (surface: string): number => ground(surface).dig({ x: 0, z: 0 }).effort
    expect(effort('sand')).toBeLessThan(effort('dirt'))
    expect(effort('lawn')).toBeGreaterThan(effort('dirt'))
  })

  it('earth thrown back from the heap closes the hole', () => {
    const terrain = ground()
    let volume = 0
    for (let k = 0; k < 3; k++) volume += terrain.dig({ x: 0, z: 0, dump: { x: 1, z: 0 } }).volume
    let moved = 0
    for (let k = 0; k < 6 && moved < volume - 1e-6; k++) moved += terrain.fill({ x: 0, z: 0, from: { x: 1, z: 0, radius: 0.6 }, volume: volume / 3 })
    expect(moved).toBeCloseTo(volume, 3)
    expect(terrain.heightAt(0, 0)).toBeCloseTo(0, 2)
  })

  it('what a shovel takes is ground lost: the structure standing on it is told (onGroundLoss)', () => {
    const losses: GroundLoss[] = []
    const terrain = ground('dirt', (loss) => losses.push(loss))
    for (let k = 0; k < 3; k++) terrain.dig({ x: 0, z: 0 })
    expect(losses.length).toBeGreaterThan(0)
    expect(Math.hypot(losses[0]!.x, losses[0]!.z)).toBeLessThan(0.3)
  })

  it('ground a shovel cannot dig (rock, laterite, concrete, asphalt, paving) stops the blade and stays as it was', () => {
    for (const [surface, material] of [['bedrock', 'stone'], ['hardpan', 'laterite'], ['concrete_slab', 'concrete'], ['road', 'asphalt'], ['paver_floor', 'paver']] as const) {
      const terrain = ground(surface)
      const result = terrain.dig({ x: 0, z: 0, dump: { x: 1, z: 0 } })
      expect(result.refused, surface).toBe(material)
      expect(result.volume, surface).toBe(0)
      expect(terrain.heightAt(0, 0), surface).toBeCloseTo(0, 6)
      expect(terrain.heightAt(1, 0), surface).toBeCloseTo(0, 6)
    }
  })

  it('that ground only sinks under a heavy blow: below its threshold a blow leaves it, above it a crater', () => {
    // a grenade's 2 MJ sinks laterite, concrete and asphalt; rock takes a charge ten times that to spall
    for (const [surface, charge] of [['bedrock', 2e7], ['hardpan', 2e6], ['concrete_slab', 2e6], ['road', 2e6]] as const) {
      const light = ground(surface)
      light.strike('blunt', { x: 0, z: 0, energy: 100, contactRadius: 0.05 })
      expect(light.heightAt(0, 0), `${surface} under a light blow`).toBeCloseTo(0, 6)
      const heavy = ground(surface)
      heavy.strike('explosive', { x: 0, z: 0, energy: charge })
      expect(heavy.heightAt(0, 0), `${surface} under a charge`).toBeLessThan(-1e-3)
    }
  })

  it('mud comes up on the blade and the hole closes behind it; under water nothing comes up', () => {
    const mud = ground('mud')
    const result = mud.dig({ x: 0, z: 0, dump: { x: 1, z: 0 } })
    expect(result.closes).toBe(true)
    expect(result.volume).toBe(0)
    expect(mud.heightAt(0, 0)).toBeCloseTo(0, 6)
    expect(ground('pond').dig({ x: 0, z: 0 }).refused).toBe('water')
  })

  it('a yard digs as it is laid: the topsoil, then the clay under it, slower, then the rock stops it', () => {
    const yard = ground('yard')
    const first = yard.dig({ x: 0, z: 0, depth: 0.2 })
    expect(first.material).toBe('soil')
    yard.dig({ x: 0, z: 0, depth: 0.15 })
    const clay = yard.dig({ x: 0, z: 0, depth: 0.2 })
    expect(clay.material).toBe('clay')
    expect(clay.effort).toBeGreaterThan(first.effort)
    for (let k = 0; k < 12; k++) yard.dig({ x: 0, z: 0, depth: 0.2 })
    expect(yard.heightAt(0, 0)).toBeCloseTo(-1.95, 3)
    expect(yard.dig({ x: 0, z: 0 }).refused).toBe('stone')
  })
})
