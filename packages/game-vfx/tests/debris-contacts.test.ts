import { describe, expect, it } from 'vitest'

import { WorkshopEngine } from '../src/workshop/engine'
import { lehmer } from '../src/random'

/** An engine on flat ground at 0; `contacts` turns on the touch of the pieces with the given upright bodies. */
function engineWith(obstacles?: () => { x: number; z: number; bottom: number; top: number; radius: number }[]): WorkshopEngine {
  const engine = new WorkshopEngine({ random: lehmer(7), groundAt: () => 0 })
  if (obstacles) engine.setDebrisContacts(obstacles)
  return engine
}

const run = (engine: WorkshopEngine, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) engine.debris.update(1 / 60)
}

/** Flat chips dropped one after the other on the same spot, as a wall shot over and over throws them. */
function dropChips(engine: WorkshopEngine, count: number): void {
  for (let i = 0; i < count; i++) {
    engine.debrisPiece({ p: [0, 0.4, 0], dir: [0, -1, 0], cone: 0.01, sp: [0, 0], size: [0.04, 0.01, 0.04], k: [1, 1], life: 60 })
    run(engine, 0.6)
  }
}

describe('debris pieces touch what is round them (shot wall and shot car alike)', () => {
  it('pile on the pieces at rest under them: a chip lies on a chip, not inside it', () => {
    const engine = engineWith(() => [])
    dropChips(engine, 4)
    const heights = engine.debris.pieces.filter((piece) => piece.on).map((piece) => piece.y).sort((a, b) => a - b)
    expect(heights).toHaveLength(4)
    for (let i = 1; i < heights.length; i++) expect(heights[i]! - heights[i - 1]!).toBeGreaterThan(0.008)
    expect(engine.debris.pieces.filter((piece) => piece.on).every((piece) => piece.rest)).toBe(true)
  })

  it('without the host turning it on they only bounce on the ground, as the Workshop page does', () => {
    const engine = engineWith()
    dropChips(engine, 3)
    const heights = engine.debris.pieces.filter((piece) => piece.on).map((piece) => piece.y)
    for (const y of heights) expect(y).toBeCloseTo(0.005, 3)
  })

  it('stop at the player and are pushed by the player, never inside the body', () => {
    const player = { x: 0.5, z: 0, bottom: 0, top: 1.7, radius: 0.3 }
    const engine = engineWith(() => [player])
    // thrown at the player's legs
    engine.debrisPiece({ p: [0, 0.3, 0], dir: [1, 0, 0], cone: 0.01, sp: [4, 4], size: [0.03, 0.01, 0.03], k: [1, 1], life: 60 })
    run(engine, 2)
    const piece = engine.debris.pieces.find((entry) => entry.on)!
    expect(Math.hypot(piece.x - player.x, piece.z - player.z)).toBeGreaterThanOrEqual(player.radius)
    expect(piece.x).toBeLessThan(player.x)
    // the player walks onto the chip at rest: it is pushed off, not left inside the feet
    expect(piece.rest).toBe(true)
    player.x = piece.x + 0.1
    run(engine, 0.5)
    expect(Math.hypot(piece.x - player.x, piece.z - player.z)).toBeGreaterThanOrEqual(player.radius)
  })

  it('a floor of chips at rest costs nothing a frame: nothing moving, no grid', () => {
    const engine = engineWith(() => [])
    dropChips(engine, 3)
    const before = engine.debris.pieces.filter((piece) => piece.on).map((piece) => [piece.x, piece.y, piece.z])
    run(engine, 1)
    expect(engine.debris.pieces.filter((piece) => piece.on).map((piece) => [piece.x, piece.y, piece.z])).toEqual(before)
  })
})
