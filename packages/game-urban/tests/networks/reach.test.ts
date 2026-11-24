import { describe, expect, it } from 'vitest'

import type { CityPlanInput } from '../../src'
import { generateNetworks, validateNetworks } from '../../src/networks'
import type { NetworkLot, NetworkNode } from '../../src/networks'

// One street along x at z = 0 (10 m wide, a 2.5 m sidewalk each side), no river; the lots stand on its +z side, so the poles do too (z = 5.4).
const PLAN: CityPlanInput = { id: 'reach', scale: 'town', size: [200, 200], districts: [], lines: [{ id: 'main', kind: 'street', width: 10, points: [[-100, 0], [100, 0]] }] }
const ROW: NetworkLot[] = [-60, -48, -36].map((x, index) => ({ id: `row_${index + 1}`, rect: [x, 7.5, x + 12, 32.5] }))
/** A lot whose front stands `front` metres from the axis, 12 m wide from `x`: its meter post 0.3 m inside the front. */
const setBack = (front: number, x = 20): NetworkLot => ({ id: 'back', rect: [x, front, x + 12, front + 20] })

const generate = (lots: readonly NetworkLot[], avoid: Array<readonly [number, number, number, number]> = []) => generateNetworks({ plan: PLAN, lots, seed: 1, avoid })
const poles = (out: ReturnType<typeof generate>): NetworkNode[] => out.networks.nodes.filter((node) => node.kind === 'pole')
const service = (out: ReturnType<typeof generate>): NetworkNode[] => poles(out).filter((node) => node.id.includes(':lot:'))
const valid = (out: ReturnType<typeof generate>) => validateNetworks(out.networks, { connections: out.connections, surfaceAt: out.surfaceAt })

describe('poles added to reach a lot', () => {
  it('spaces the service poles evenly from the street pole to the meter post, never past it', () => {
    const out = generate([...ROW, setBack(36.1)])
    const anchor = out.connections.find((connection) => connection.lot === 'back' && connection.network === 'power')?.at as readonly [number, number, number]
    const [pole] = service(out)
    expect(service(out).length).toBe(1)
    const street = poles(out).find((node) => !node.id.includes(':lot:') && Math.abs(node.at[0] - (pole?.at[0] ?? 0)) < 1e-6) as NetworkNode
    const toStreet = Math.hypot((pole?.at[0] ?? 0) - street.at[0], (pole?.at[2] ?? 0) - street.at[2])
    const toAnchor = Math.hypot((pole?.at[0] ?? 0) - anchor[0], (pole?.at[2] ?? 0) - anchor[2])
    expect(toStreet).toBeCloseTo(toAnchor, 6)
    expect(pole?.at[2] ?? 0).toBeLessThan(anchor[2])
    expect(valid(out)).toEqual([])
  })

  it('stands no service pole in a neighbour\'s lot: with no ground left it says the lot is out of reach', () => {
    const front: NetworkLot = { id: 'front', rect: [10, 7.5, 42, 70] }
    const out = generate([...ROW, front, setBack(70)])
    expect(service(out)).toEqual([])
    expect(out.warnings.length).toBeGreaterThan(0)
    expect(out.warnings.every((warning) => warning.code === 'lot_out_of_reach' && warning.id === 'back')).toBe(true)
  })

  it('keeps an added street pole 3 m from every other one', () => {
    const first = generate(ROW)
    const near = poles(first).find((node) => node.at[0] > 0 && node.at[0] < 80) as NetworkNode
    const out = generate([...ROW, setBack(36.1, near.at[0] - 5)])
    const street = poles(out).filter((node) => !node.id.includes(':lot:'))
    for (const a of street) for (const b of street) if (a !== b) expect(Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]), `${a.id} ${b.id}`).toBeGreaterThanOrEqual(3 - 1e-9)
    expect(street.length).toBeGreaterThan(poles(first).length)
  })
})

describe('corner and end poles and the gates', () => {
  it('slides an end pole inward off a gate', () => {
    const first = generate(ROW)
    const end = poles(first).reduce((a, b) => (a.at[0] < b.at[0] ? a : b))
    const gate = [end.at[0] - 1, end.at[2] - 1, end.at[0] + 1, end.at[2] + 1] as const
    const out = generate(ROW, [gate])
    for (const pole of poles(out)) expect(pole.at[0] > gate[0] && pole.at[0] < gate[2] && pole.at[2] > gate[1] && pole.at[2] < gate[3], pole.id).toBe(false)
    expect(out.warnings).toEqual([])
    expect(poles(out).some((pole) => pole.guyed && pole.at[0] > end.at[0])).toBe(true)
  })
})
