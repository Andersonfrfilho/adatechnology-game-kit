import type { GroundLoss } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createTerrain, GROUND_LOSS_MIN_DEPTH } from '../src'

const BOUNDS = [-10, -10, 10, 10] as const
const GRENADE = 800_000

const make = (surface: string): { terrain: ReturnType<typeof createTerrain>; losses: GroundLoss[] } => {
  const losses: GroundLoss[] = []
  const terrain = createTerrain({ bounds: BOUNDS, layout: { surface }, onGroundLoss: (loss) => losses.push(loss) })
  return { terrain, losses }
}

describe('ground loss', () => {
  it('a crater tells where, how deep and how much ground it took', () => {
    const { terrain, losses } = make('dirt')
    const result = terrain.strike('explosive', { x: 2, z: -1, energy: GRENADE })
    const crater = losses.find((loss) => loss.source === 'crater')
    expect(crater).toBeDefined()
    expect(crater!.x).toBeCloseTo(2, 0)
    expect(crater!.z).toBeCloseTo(-1, 0)
    expect(crater!.radius).toBeGreaterThan(result.radius * 0.8)
    expect(crater!.radius).toBeLessThan(result.radius * 1.4)
    expect(crater!.depth).toBeCloseTo(terrain.columnAt(2, -1).depth, 1)
    // a bowl of radius r and depth d holds about π r² d / 2
    const bowl = (Math.PI * result.radius ** 2 * result.depth) / 2
    expect(crater!.removed!).toBeGreaterThan(bowl * 0.6)
    expect(crater!.removed!).toBeLessThan(bowl * 1.6)
  })

  it('a scuff that leaves no void says nothing', () => {
    const { terrain, losses } = make('dirt')
    terrain.strike('ballistic', { x: 0, z: 0, energy: 500 })
    expect(losses).toEqual([])
  })

  it('a weight that lands flat presses the ground down and takes none away', () => {
    const { terrain, losses } = make('dirt')
    const landed = terrain.strike('blunt', { x: 0, z: 0, energy: 600_000, contactRadius: 3 })
    expect(landed.radius).toBeGreaterThan(0)
    expect(terrain.heightAt(0, 0)).toBeLessThan(0)
    expect(losses).toEqual([])
  })

  it('a slab over a void that gives way tells the hole it opened', () => {
    const { terrain, losses } = make('suspended_slab')
    terrain.dug.fill(0.12)
    expect(terrain.bear([{ x: 1, z: 1, radius: 0.3, newtons: 9000 }])).toBe(true)
    const slab = losses.find((loss) => loss.source === 'slab')
    expect(slab).toBeDefined()
    expect(slab!.depth).toBeGreaterThan(3)
    expect(Math.hypot(slab!.x - 1, slab!.z - 1)).toBeLessThan(0.3)
    expect(slab!.radius).toBeGreaterThan(0.3)
    expect(slab!.removed!).toBeGreaterThan(0)
  })

  it('sand that slides into a pit tells, once at rest, the ground it lowered', () => {
    const { terrain, losses } = make('sand')
    // a pit 1.2 m deep with a sheer wall at x = 0: the blow at its edge starts the sand moving
    for (let row = 0; row <= terrain.rows; row++) {
      for (let column = 0; column <= terrain.columns; column++) {
        const x = BOUNDS[0] + column * terrain.cellSize
        const z = BOUNDS[1] + row * terrain.cellSize
        if (x > 0 && x < 2 && Math.abs(z) < 1) terrain.dug[row * terrain.stride + column] = 1.2
      }
    }
    terrain.strike('explosive', { x: 0, z: 0, energy: 100_000 })
    expect(losses.filter((loss) => loss.source === 'slide')).toEqual([])
    for (let t = 0; t < 8; t += 1 / 60) terrain.update(1 / 60)
    const slides = losses.filter((loss) => loss.source === 'slide')
    expect(slides).toHaveLength(1)
    const slide = slides[0]!
    expect(slide.depth).toBeGreaterThanOrEqual(GROUND_LOSS_MIN_DEPTH)
    expect(Math.abs(slide.x)).toBeLessThan(0.3)
    expect(slide.removed!).toBeGreaterThan(0)
    // the wall slumped: ground on the high side of it is now lower than it was
    expect(terrain.voidUnder(-0.3, 0, 0.1).depth).toBeGreaterThan(0.05)
  })

  it('voidUnder measures the share of a disc with no ground under it', () => {
    const { terrain } = make('dirt')
    expect(terrain.voidUnder(0, 0, 1)).toEqual({ depth: 0, mean: 0, fraction: 0 })
    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    const centre = terrain.voidUnder(0, 0, 0.2)
    expect(centre.fraction).toBe(1)
    expect(centre.depth).toBeCloseTo(terrain.columnAt(0, 0).depth, 3)
    const wide = terrain.voidUnder(0, 0, 3)
    expect(wide.fraction).toBeGreaterThan(0)
    expect(wide.fraction).toBeLessThan(0.5)
    expect(wide.mean).toBeLessThan(centre.mean)
    expect(terrain.voidUnder(6, 6, 0.01).fraction).toBe(0)
  })
})
