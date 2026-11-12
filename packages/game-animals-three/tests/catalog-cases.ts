import { SPECIES } from '@adatechnology/game-animals-species'
import * as THREE from 'three'
import { createAnimalsThree, profileGeometry } from '../src'
import { createStream } from '../src/context'
import { stubDocument } from './helpers'

/** The pieces of the catalog every catalog test walks (exact golden, z-fighting): built from the package's own lists, so a new piece is in them. */
export type Case = [string, () => THREE.Object3D]
export const cases: Case[] = []
for (const seed of [7, 11]) {
  for (const species of SPECIES) {
    cases.push([`${species.id}:${seed}`, () => createAnimalsThree(THREE, { document: stubDocument(), random: createStream(seed) }).build(species, { phase: 0.25 }).root])
  }
}
cases.push(['profile', () => new THREE.Mesh(profileGeometry(THREE, 0.8, [0.1, 0.3, 0.35, 0.2, 0.05], 18))])
