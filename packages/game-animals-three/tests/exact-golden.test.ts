import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { SPECIES } from '@adatechnology/game-animals-species'
import { exactSnapshot } from '@adatechnology/golden-tool'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createAnimalsThree, profileGeometry } from '../src'
import { createStream } from '../src/context'
import { stubDocument } from './helpers'

/**
 * Every bit of the 13 animals (two seeds each) and of the body profile: recorded on the old path (three's own geometry constructors) before
 * the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = fileURLToPath(new URL('./fixtures/exact-animals.json', import.meta.url))

type Case = [string, () => THREE.Object3D]
const cases: Case[] = []
for (const seed of [7, 11]) {
  for (const species of SPECIES) {
    cases.push([`${species.id}:${seed}`, () => createAnimalsThree(THREE, { document: stubDocument(), random: createStream(seed) }).build(species, { phase: 0.25 }).root])
  }
}
cases.push(['profile', () => new THREE.Mesh(profileGeometry(THREE, 0.8, [0.1, 0.3, 0.35, 0.2, 0.05], 18))])

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the animals, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    })
    return
  }
  it('has a recording of every case', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort())
  })
  it.each(cases)('%s', (id, build) => {
    const snapshot = exactSnapshot(build())
    expect({ hash: snapshot.hash, objects: snapshot.nodes.length }).toEqual(recorded[id])
  })
})
