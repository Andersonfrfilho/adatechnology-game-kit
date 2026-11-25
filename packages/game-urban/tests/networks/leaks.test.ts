import { describe, expect, it } from 'vitest'

import { breachOf, coverBodyOf, coverThrowOf, DEFAULT_LEAK_RULES, drainLeak, generateNetworks, leaksOf, openingOf, pipePiecesOf, startLeak, surfacePiecesOf, waterOutageOf } from '../../src/networks'
import type { Crater, PipePiece } from '../../src/networks'
import { LOTS, PLAN } from './district'

const { networks } = generateNetworks({ plan: PLAN, lots: LOTS, seed: 11 })
const pipes = pipePiecesOf(networks)
const surface = surfacePiecesOf(networks)

/** A bowl straight over the middle of a pipe, deep enough to break it and wide enough to reach it everywhere. */
function craterOver(pipe: PipePiece): Crater {
  const [x, z] = [(pipe.from[0] + pipe.to[0]) / 2, (pipe.from[2] + pipe.to[2]) / 2]
  return { x, z, radius: 1.5, depth: Math.max(pipe.ground[0], pipe.ground[1]) - Math.min(pipe.from[1], pipe.to[1]) + 1 }
}
const breachOver = (pipe: PipePiece) => breachOf({ pipes, surface }, craterOver(pipe))
const firstOf = (kind: PipePiece['kind']): PipePiece => pipes.find((pipe) => pipe.kind === kind)!

describe('what leaks from a broken pipe', () => {
  it('lets water out under pressure and sewage as a slow run, each from its own break and finite', () => {
    for (const [kind, content] of [['water_main', 'water'], ['sewer_main', 'sewage']] as const) {
      const pipe = firstOf(kind)
      const leaks = leaksOf(networks, breachOver(pipe), { isRaining: false }).filter((leak) => leak.id === pipe.id)
      expect(leaks, kind).toHaveLength(1)
      const [leak] = leaks
      expect(leak!.content).toBe(content)
      expect(leak!.isPressurised).toBe(content === 'water')
      expect(Number.isFinite(leak!.volume)).toBe(true)
      expect(leak!.volume).toBeCloseTo(leak!.rate * DEFAULT_LEAK_RULES[content].seconds, 6)
    }
    const rateOf = (kind: PipePiece['kind']): number => leaksOf(networks, breachOver(firstOf(kind)), { isRaining: false }).find((leak) => leak.id === firstOf(kind).id)!.rate
    expect(rateOf('water_main')).toBeGreaterThan(rateOf('sewer_main') * 5)
  })

  it('runs the drainage only while it rains', () => {
    const gallery = firstOf('storm_gallery')
    const breach = breachOver(gallery)
    expect(leaksOf(networks, breach, { isRaining: false }).filter((leak) => leak.content === 'stormwater')).toEqual([])
    expect(leaksOf(networks, breach, { isRaining: true }).filter((leak) => leak.id === gallery.id)).toHaveLength(1)
  })

  it('opens nothing for a bowl that does not get down to the pipe', () => {
    const pipe = firstOf('water_main')
    const shallow = breachOf({ pipes, surface }, { ...craterOver(pipe), depth: 0.1 })
    expect(leaksOf(networks, shallow, { isRaining: true })).toEqual([])
  })

  it('lets a leak out at no more than its rate and stops when it is empty, the litres adding up to its volume', () => {
    const [leak] = leaksOf(networks, breachOver(firstOf('water_service')), { isRaining: false })
    const state = startLeak(leak!)
    let total = 0
    for (let step = 0; step < 100_000 && state.remaining > 0; step++) {
      const out = drainLeak(state, 0.5)
      expect(out).toBeLessThanOrEqual(leak!.rate * 0.5 + 1e-9)
      total += out
    }
    expect(state.remaining).toBe(0)
    expect(total).toBeCloseTo(leak!.volume, 6)
    expect(drainLeak(state, 10)).toBe(0)
  })
})

describe('the water a main break cuts', () => {
  it('cuts every house downstream of a broken main and tells which pipe did it', () => {
    const mains = pipes.filter((pipe) => pipe.kind === 'water_main')
    const cuts = mains.map((pipe) => ({ pipe, outage: waterOutageOf(networks, { before: [], after: [pipe.id] }) })).filter(({ outage }) => outage !== undefined)
    expect(cuts.length).toBeGreaterThan(0)
    const widest = cuts.reduce((best, entry) => (entry.outage!.lots.length > best.outage!.lots.length ? entry : best))
    expect(widest.outage!.lots.length).toBeGreaterThan(1)
    expect(widest.outage!.causes).toEqual([widest.pipe.id])
    expect(widest.outage!.network).toBe('water')
  })

  it('cuts only its own house when a service breaks', () => {
    const service = firstOf('water_service')
    const outage = waterOutageOf(networks, { before: [], after: [service.id] })
    expect(outage?.lots).toHaveLength(1)
  })

  it('tells only what is new: a second break downstream of the first cuts nothing more, and a break that cuts nothing is no outage', () => {
    const mains = pipes.filter((pipe) => pipe.kind === 'water_main')
    const cut = mains.map((pipe) => ({ pipe, outage: waterOutageOf(networks, { before: [], after: [pipe.id] }) })).find((entry) => entry.outage !== undefined && entry.outage.lots.length > 1)!
    const again = waterOutageOf(networks, { before: [cut.pipe.id], after: [cut.pipe.id] })
    expect(again).toBeUndefined()
    expect(waterOutageOf(networks, { before: [], after: [] })).toBeUndefined()
  })
})

describe('the hole and the cover a blast leaves', () => {
  const covers = surface.filter((piece) => piece.kind === 'manhole_cover')

  it('opens the shaft of a cover down to its floor, as wide as the shaft', () => {
    expect(covers.length).toBeGreaterThan(3)
    for (const piece of covers) {
      const opening = openingOf(piece)!
      expect(opening.depth, piece.id).toBeGreaterThan(piece.shaft!.top - piece.shaft!.bottom)
      expect(opening.rect[2] - opening.rect[0], piece.id).toBeCloseTo(piece.shaft!.width, 9)
    }
  })

  it('opens nothing where nothing was a cover (a hydrant, a wing wall)', () => {
    for (const piece of surface.filter((entry) => entry.solid)) {
      expect(openingOf(piece), piece.id).toBeUndefined()
      expect(coverBodyOf(piece), piece.id).toBeUndefined()
    }
  })

  it('makes the cover a plate of its own material, as heavy as that volume weighs', () => {
    const piece = covers.find((entry) => entry.material === 'cast_iron' && entry.shape === 'round')!
    const body = coverBodyOf(piece)!
    expect(body.spec.parts).toHaveLength(1)
    expect(body.spec.parts[0]!.material).toBe('cast_iron')
    expect(body.spec.parts[0]!.shape).toEqual({ kind: 'cylinder', radius: piece.size[0] / 2, height: piece.size[1] })
    expect(body.mass).toBeCloseTo(7200 * Math.PI * (piece.size[0] / 2) ** 2 * piece.size[1], 6)
    expect(body.id).toBe(`cover:${piece.id}`)
    expect(body.position).toEqual(piece.at)
  })

  it('throws a cover away from the middle of the bowl and up, harder the deeper the bowl, the same way every time', () => {
    const piece = covers[0]!
    const crater = { x: piece.at[0] - 1, z: piece.at[2], depth: 1 }
    const [vx, vy, vz] = coverThrowOf(piece, crater)
    expect(vx).toBeGreaterThan(0)
    expect(vz).toBeCloseTo(0, 9)
    expect(vy).toBeGreaterThan(0)
    expect(coverThrowOf(piece, crater)).toEqual([vx, vy, vz])
    expect(coverThrowOf(piece, { ...crater, depth: 2 })[0]).toBeGreaterThan(vx)
    expect(coverThrowOf(piece, { x: piece.at[0], z: piece.at[2], depth: 1 })[0]).toBeGreaterThan(0)
  })
})
