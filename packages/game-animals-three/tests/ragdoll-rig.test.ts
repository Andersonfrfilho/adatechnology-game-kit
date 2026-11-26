import { ragdollOfAnimal } from '@adatechnology/game-animals'
import { SPECIES } from '@adatechnology/game-animals-species'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createAnimalsThree } from '../src'

import { stubDocument } from './helpers'

const QUADRUPEDS = SPECIES.filter((species) => species.body.kind === 'quadruped')

/** The ragdoll is made from the species' rest pose (`game-animals`); the three.js animal is drawn from the same numbers, so every body must sit inside what is drawn. */
describe('quadruped ragdoll against the drawn rig', () => {
  const animals = createAnimalsThree(THREE, { document: stubDocument() })

  it.each(QUADRUPEDS.map((species) => species.id))('%s: every body sits inside the drawn animal and the feet stand on the ground (the tail may hang lower)', (id) => {
    const species = QUADRUPEDS.find((candidate) => candidate.id === id)
    if (!species || species.body.kind !== 'quadruped') throw new Error('species')
    const rig = animals.build(species, { phase: 0 })
    rig.root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(rig.root)
    const margin = Math.max(species.body.L, 0.2) * 0.05
    const { parts } = ragdollOfAnimal({ body: species.body })
    for (const part of parts) {
      const [x, y, z] = part.body.position
      expect(x).toBeGreaterThanOrEqual(box.min.x - margin)
      expect(x).toBeLessThanOrEqual(box.max.x + margin)
      expect(y).toBeGreaterThanOrEqual(box.min.y - margin)
      expect(y).toBeLessThanOrEqual(box.max.y + margin)
      expect(z).toBeGreaterThanOrEqual(box.min.z - margin)
      expect(z).toBeLessThanOrEqual(box.max.z + margin)
    }
    const bottomOf = (part: (typeof parts)[number]): number => {
      const { shape, position, rotation } = part.body
      if (shape.kind === 'sphere') return position[1] - shape.radius
      if (shape.kind !== 'capsule') return position[1]
      // the bodies turn about x only: the capsule's axis is (0, cos, sin) with cos = 1 - 2 qx^2
      const axisY = 1 - 2 * (rotation?.[0] ?? 0) ** 2
      return position[1] - Math.abs(axisY) * shape.halfHeight - shape.radius
    }
    const lowest = Math.min(...parts.map(bottomOf))
    expect(Math.abs(lowest)).toBeLessThanOrEqual(margin)
  })
})
