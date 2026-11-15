import { join } from 'node:path'

import { TERRAIN_PROFILES, createTerrain } from '@adatechnology/game-terrain'
import { GAME_DEPTH_PRECISION, coincidentFacesOf, describeCoincidentFaces } from '@adatechnology/game-shapes-three'
import { checkZFightingLedger } from '@adatechnology/golden-tool'
import type { ZFightingCase } from '@adatechnology/golden-tool'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createTerrainRenderer } from '../src'

const LEDGER = join(process.cwd(), 'tests/fixtures/z-fighting-ground-ledger.json')
const CAMERA = { x: 0, y: 2, z: 0 }

/** A strip of every ground profile of the catalog (so a new profile is walked on its own), a trench and a pit, shovelfuls heaped beside them, a blast, footprints. */
function scene(): { id: string; build: () => THREE.Object3D }[] {
  const strips = TERRAIN_PROFILES.map((profile, index) => ({ rect: [-18 + index * 2, -18, -16 + index * 2, 18] as [number, number, number, number], surface: profile.id }))
  const dug = (id: string, digs: number, strike: boolean): { id: string; build: () => THREE.Object3D } => ({
    id,
    build: () => {
      const terrain = createTerrain({
        bounds: [-20, -20, 20, 20],
        layout: { surface: 'dirt', zones: strips, excavations: [{ rect: [4, -3, 5, 3], depth: 0.8 }, { rect: [8, 4, 9.5, 5.5], depth: 0.6, toDepth: 0.9, along: 'x' }] },
      })
      for (let i = 0; i < digs; i++) terrain.dig({ x: 6 + (i % 3) * 0.3, z: -6, size: [0.4, 0.4], depth: 0.25, dump: { x: 7.4, z: -6.5 + (i % 2) * 0.2 } })
      if (strike) terrain.strike('explosive', { x: -2, z: 2, energy: 800_000 })
      for (let i = 0; i < 6; i++) terrain.press({ x: i * 0.4, z: 0, radius: 0.12, angle: 0 })
      const view = createTerrainRenderer(THREE, { terrain })
      view.sync(CAMERA)
      view.group.updateMatrixWorld(true)
      return view.group
    },
  })
  return [dug('ground, trench, pit', 0, false), dug('ground with a spoil heap beside the trench', 12, false), dug('ground with a blast and loose earth', 12, true)]
}

describe('z-fighting of the ground (heaps, holes, loose earth, marks, every profile of the catalog)', () => {
  it('no ground scene has coincident or nearly coincident faces beyond the ledger', () => {
    const checked: ZFightingCase[] = scene().map(({ id, build }) => {
      const hits = coincidentFacesOf(build(), { depth: GAME_DEPTH_PRECISION, maxHits: 100_000, maxPerPair: 100_000 })
      return { id, hits: hits.length, detail: describeCoincidentFaces(hits, 4) }
    })
    const { problems } = checkZFightingLedger({ file: LEDGER, cases: checked, update: process.env.UPDATE_ZFIGHT === '1' })
    expect(problems, problems.join('\n')).toEqual([])
  }, 900_000)
})
