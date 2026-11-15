import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import { TEMPLATES, THREE, houseOf, planOf } from './helpers/houses'
import { overlapOf, pieceBoxes } from './helpers/piece-boxes'

/** Overlap deeper than this (m) on all three axes at once is a piece born inside another. */
const OVERLAP = 0.001
const STAGED = { quality: 'game', constructionStages: true, constructionLevel: 8 } as const
const CASES = Object.keys(TEMPLATES).flatMap((template) => [1, 2, 3].flatMap((seed) => [false, true].map((staged) => [template, seed, staged] as const)))

type Part = House['structure']['parts'][number]
const thresholdsOf = (house: House): Part[] => house.structure.parts.filter((part) => part.id.startsWith('threshold:'))
const boxOf = (part: Part): THREE.Box3 => new THREE.Box3(new THREE.Vector3(part.aabb[0], part.y0, part.aabb[1]), new THREE.Vector3(part.aabb[2], part.y1, part.aabb[3]))
const solidRoles = ['wall', 'partition', 'column', 'beam', 'slab']

describe('the threshold of an outside door', () => {
  it.each(CASES)('%s, seed %i, staged %s: is born inside no wall, pillar, beam, door post or sidewalk slab, and no deeper than the ground', (template, seed, staged) => {
    const { house } = houseOf(planOf(template, seed), {}, staged ? STAGED : {})
    const overlaps: string[] = []
    for (const threshold of thresholdsOf(house)) {
      const boxes = pieceBoxes(house, threshold.id)
      const neighbours = house.structure.parts.filter((part) => part.id !== threshold.id && (part.extra ? /^(jamb|sidewalk|baseboard)/.test(part.id) : solidRoles.includes(part.role)))
      for (const neighbour of neighbours) {
        const others = neighbour.extra ? pieceBoxes(house, neighbour.id) : [boxOf(neighbour)]
        const deepest = Math.max(-1, ...boxes.flatMap((box) => others.map((other) => overlapOf(box, other))))
        if (deepest > OVERLAP) overlaps.push(`${threshold.id} x ${neighbour.id}: ${deepest.toFixed(3)} m`)
      }
      const sidewalk = pieceBoxes(house, threshold.id.replace('threshold:', 'sidewalk:door:'))
      const ground = Math.min(...sidewalk.map((box) => box.min.y))
      const lowest = Math.min(...boxes.map((box) => box.min.y))
      if (lowest < ground - OVERLAP) overlaps.push(`${threshold.id} is ${(ground - lowest).toFixed(3)} m under the ground`)
    }
    expect(overlaps).toEqual([])
  })

  it.each(CASES)('%s, seed %i, staged %s: is held by the ground it is set on, so it is no free piece born in the doorway', (template, seed, staged) => {
    const { house } = houseOf(planOf(template, seed), {}, staged ? STAGED : {})
    const held = new Map(house.structure.supports.map((support) => [support.part, support.on]))
    for (const threshold of thresholdsOf(house)) expect(held.get(threshold.id), threshold.id).toBe('ground')
  })

  it('exists in the houses that have a doorway between two walls, and has a body of its own', () => {
    const { house } = houseOf(planOf('sobrado', 3), {}, STAGED)
    const threshold = thresholdsOf(house).find((part) => part.id === 'threshold:d0_0')!
    expect(threshold).toBeDefined()
    expect(threshold.y1 - threshold.y0).toBeGreaterThan(0.01)
    expect(threshold.mass).toBeGreaterThan(1)
  })
})
