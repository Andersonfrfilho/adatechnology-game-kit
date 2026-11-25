import { coincidentFacesOf, describeCoincidentFaces } from '@adatechnology/game-shapes-three'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { networkCases } from './network-cases'

/** The pieces of the drawn networks (poles with every kind of hardware, transformer, splice and coil, guys, lamps lit and failing) have no coincident faces (CLAUDE.md §13). */
describe('z-fighting of the networks', () => {
  it.each(networkCases(THREE))('%s', (_id, build) => {
    const root = build()
    root.updateMatrixWorld(true)
    const hits = coincidentFacesOf(root as never, { maxHits: Number.POSITIVE_INFINITY })
    expect(hits.length, describeCoincidentFaces(hits, 6)).toBe(0)
  })
})
