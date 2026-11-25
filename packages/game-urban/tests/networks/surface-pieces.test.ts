import { describe, expect, it } from 'vitest'

import { ROAD_SURFACE_LEVEL, breachOf, bowlDepthAt, coverOf, generateNetworks, pipePiecesOf, surfacePiecesOf } from '../../src/networks'
import type { NetworkNode } from '../../src/networks'
import { LOTS, PLAN } from './district'

const out = generateNetworks({ plan: PLAN, lots: LOTS, seed: 11 })
const surface = surfacePiecesOf(out.networks)
const pipes = pipePiecesOf(out.networks)
const nodesOf = (kind: NetworkNode['kind']): NetworkNode[] => out.networks.nodes.filter((node) => node.kind === kind)
const piecesOf = (kind: (typeof surface)[number]['kind']) => surface.filter((piece) => piece.kind === kind)

describe('the pieces that show on the ground', () => {
  it('puts a cover on every manhole, a grate on every inlet, a hydrant on every hydrant and a wing wall on every outfall', () => {
    // two covers closer than their frame is wide show as one
    expect(piecesOf('manhole_cover').length).toBeLessThanOrEqual(nodesOf('manhole').length + nodesOf('pumping_station').length)
    expect(piecesOf('manhole_cover').length).toBeGreaterThan(nodesOf('manhole').length / 2)
    expect(piecesOf('inlet_grate').length).toBe(nodesOf('inlet').length)
    expect(piecesOf('hydrant').length).toBe(nodesOf('hydrant').length)
    expect(piecesOf('wing_wall').length).toBe(nodesOf('outfall').length)
    expect(piecesOf('valve_cover').length).toBe(nodesOf('valve').length)
    expect(piecesOf('cleanout_cover').length).toBe(nodesOf('cleanout').length)
    expect(nodesOf('inlet').length).toBeGreaterThan(10)
  })

  it('puts at each lot the inspection box cover, the meter box and the downspout mouth', () => {
    for (const lot of LOTS) {
      for (const [kind, network] of [['inspection_cover', 'sewer'], ['meter_box', 'water'], ['downspout_mouth', 'storm']] as const) {
        expect(surface.filter((piece) => piece.kind === kind && piece.id === `lot:${lot.id}:${network}`).length, `${lot.id} ${kind}`).toBe(1)
      }
    }
  })

  it('is ground where it is walked on and solid where it stands up', () => {
    for (const piece of surface.filter((entry) => ['manhole_cover', 'inlet_grate', 'cleanout_cover', 'valve_cover', 'inspection_cover'].includes(entry.kind))) {
      expect(piece.solid, piece.id).toBe(false)
      expect(piece.size[1], piece.id).toBeLessThanOrEqual(0.03)
    }
    expect(new Set(surface.filter((piece) => piece.solid).map((piece) => piece.kind))).toEqual(new Set(['hydrant', 'wing_wall', 'meter_box']))
  })

  it('has a unique id, a material of the destruction catalogue, and a heading', () => {
    expect(new Set(surface.map((piece) => piece.id)).size).toBe(surface.length)
    for (const piece of surface) {
      expect(['cast_iron', 'concrete', 'plastic']).toContain(piece.material)
      expect(Number.isFinite(piece.ry)).toBe(true)
    }
  })

  it('squares every grate to its kerb: its length runs along the street, its lateral across', () => {
    const lateral = new Map(out.networks.edges.filter((edge) => edge.kind === 'storm_lateral').map((edge) => [edge.from, edge]))
    for (const grate of piecesOf('inlet_grate')) {
      const edge = lateral.get(grate.id)!
      const [from, to] = [out.networks.nodes.find((node) => node.id === edge.from)!, out.networks.nodes.find((node) => node.id === edge.to)!]
      const across = [to.at[0] - from.at[0], to.at[2] - from.at[2]]
      const along = [Math.cos(grate.ry), -Math.sin(grate.ry)]
      expect(Math.abs(across[0]! * along[0]! + across[1]! * along[1]!) / Math.hypot(...(across as [number, number])), grate.id).toBeLessThan(1e-6)
    }
  })
})

describe('the pits under the covers', () => {
  it('goes down from the cover to the bottom of the pipe at the node', () => {
    const nodes = new Map(out.networks.nodes.map((node) => [node.id, node]))
    const withShaft = surface.filter((piece) => piece.shaft !== undefined)
    expect(withShaft.length).toBeGreaterThan(20)
    for (const piece of withShaft) {
      const node = nodes.get(piece.id)!
      expect(piece.shaft!.top, piece.id).toBe(node.at[1])  // no surfaceAt: the ground
      expect(piece.shaft!.bottom, piece.id).toBe(node.invert)
      expect(piece.shaft!.top - piece.shaft!.bottom, piece.id).toBeGreaterThan(0)
    }
  })

  it('reaches the pipes that meet at its node', () => {
    const byEnd = new Map<string, number[]>()
    for (const pipe of pipes) {
      byEnd.set(`${pipe.from[0]},${pipe.from[2]}`, [...(byEnd.get(`${pipe.from[0]},${pipe.from[2]}`) ?? []), pipe.from[1] - pipe.diameter / 2])
    }
    for (const piece of piecesOf('manhole_cover').filter((entry) => entry.shaft?.shape === 'round')) {
      const bottoms = byEnd.get(`${piece.at[0]},${piece.at[2]}`)
      if (bottoms === undefined) continue
      expect(Math.min(...bottoms) + 0.5, piece.id).toBeGreaterThanOrEqual(piece.shaft!.bottom)
    }
  })
})

describe('the pipes as bodies in the ground', () => {
  it('lays every pipe of the three networks under the ground, with the cover of the rules', () => {
    expect(new Set(pipes.map((pipe) => pipe.kind))).toEqual(new Set(['sewer_main', 'sewer_lateral', 'storm_gallery', 'storm_lateral', 'water_main', 'water_service']))
    const cover = (kind: string): number[] => pipes.filter((pipe) => pipe.kind === kind).flatMap((pipe) => [coverOf(pipe, 0), coverOf(pipe, 1)])
    for (const pipe of pipes) expect(Math.min(coverOf(pipe, 0), coverOf(pipe, 1)), pipe.id).toBeGreaterThan(-0.1)
    expect(Math.min(...cover('water_main'))).toBeGreaterThanOrEqual(0.5)
    expect(Math.max(...cover('water_main'))).toBeLessThanOrEqual(0.9)
    expect(Math.min(...cover('storm_gallery'))).toBeGreaterThanOrEqual(1.1)
    expect(Math.min(...cover('sewer_main'))).toBeGreaterThanOrEqual(0.8)
  })

  it('has no pipe for the gutters, which are open channels', () => {
    expect(pipes.some((pipe) => (pipe.kind as string) === 'storm_gutter')).toBe(false)
  })
})

describe('a crater over the pipes', () => {
  const water = pipes.find((pipe) => pipe.kind === 'water_main' && Math.hypot(pipe.to[0] - pipe.from[0], pipe.to[2] - pipe.from[2]) > 20)!
  const middle = { x: (water.from[0] + water.to[0]) / 2, z: (water.from[2] + water.to[2]) / 2 }

  it('is a paraboloid: the whole depth at the centre and nothing at the rim', () => {
    const crater = { ...middle, radius: 3, depth: 2 }
    expect(bowlDepthAt(crater, 0)).toBe(2)
    expect(bowlDepthAt(crater, 3)).toBe(0)
    expect(bowlDepthAt(crater, 1.5)).toBeCloseTo(1.5, 9)
  })

  it('reaches the water main of the sidewalk with a bowl deeper than its cover, and breaks it when the bowl gets to its bore', () => {
    const cover = coverOf(water, 0.5)
    const touched = breachOf({ pipes, surface }, { ...middle, radius: 3, depth: cover + 0.02 })
    expect(touched.pipes.find((pipe) => pipe.id === water.id)).toMatchObject({ content: 'water', severed: false })
    const broken = breachOf({ pipes, surface }, { ...middle, radius: 3, depth: cover + water.diameter })
    expect(broken.pipes.find((pipe) => pipe.id === water.id)).toMatchObject({ content: 'water', severed: true })
    expect(broken.leaks).toContain('water')
  })

  it('leaves the pipes alone when the bowl is shallower than their cover, or far from them', () => {
    expect(breachOf({ pipes, surface }, { ...middle, radius: 3, depth: coverOf(water, 0.5) - 0.1 }).pipes.find((pipe) => pipe.id === water.id)).toBeUndefined()
    expect(breachOf({ pipes, surface }, { x: 10_000, z: 10_000, radius: 5, depth: 4 })).toEqual({ pipes: [], surface: [], leaks: [] })
  })

  it('reaches a gallery and a sewer under a street with a deep one, and says what leaks: stormwater and sewage', () => {
    const gallery = pipes.find((pipe) => pipe.kind === 'storm_gallery')!
    const at = { x: (gallery.from[0] + gallery.to[0]) / 2, z: (gallery.from[2] + gallery.to[2]) / 2 }
    const deep = breachOf({ pipes, surface }, { ...at, radius: 6, depth: 5 })
    expect(deep.leaks).toEqual(expect.arrayContaining(['stormwater', 'sewage']))
  })

  it('throws off the cover and the grate inside the bowl', () => {
    const grate = piecesOf('inlet_grate')[0]!
    const result = breachOf({ pipes, surface }, { x: grate.at[0], z: grate.at[2], radius: 2, depth: 1 })
    expect(result.surface).toContain(grate.id)
  })
})

describe('the pieces on the road', () => {
  it('stand on the asphalt, 2 cm over the terrain, and the ones on the sidewalk and in the yards on the ground', () => {
    const lifted = surfacePiecesOf(out.networks, { surfaceAt: out.surfaceAt })
    const byId = new Map(out.networks.nodes.map((node) => [node.id, node]))
    for (const piece of lifted) {
      const node = byId.get(piece.id)!
      const surface = out.surfaceAt(node.at[0], node.at[2])
      expect(piece.at[1] - node.at[1], `${piece.id} on ${surface}`).toBeCloseTo(surface === 'road' ? ROAD_SURFACE_LEVEL : 0, 9)
    }
    expect(lifted.filter((piece) => piece.at[1] > 0).map((piece) => piece.kind)).toEqual(expect.arrayContaining(['manhole_cover', 'inlet_grate']))
  })
})
