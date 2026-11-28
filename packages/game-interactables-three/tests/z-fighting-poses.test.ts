import { coincidentFacesOf, describeCoincidentFaces, meshBatchesOf } from '@adatechnology/game-shapes-three'
import type { CoincidentFaceHit } from '@adatechnology/game-shapes-three'
import { createHousehold } from '@adatechnology/game-interactables-household'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { applyPose, createMeshApi } from '../src'

/**
 * The catalog guard (`z-fighting.test.ts`) looks at every piece at rest. A moving part can still flicker where it stops: a flush button
 * pressed down to the lid's top, a lid closing onto a rim, a drawer pushed flush with the front. This test opens every part of every
 * household type halfway and all the way and counts the coincident faces between the part and everything else; there must be none
 * (CLAUDE.md §13). Faces inside one part already fight at rest and are the catalog guard's.
 */
const household = createHousehold({ region: 'br', locale: 'en' })
const STOPS = [0.5, 1]

interface Posed {
  id: string
  hits: CoincidentFaceHit[]
}

function posedHits(typeId: string, quality: 'high' | 'game'): Posed[] {
  const mesh = createMeshApi(THREE, { quality })
  const spec = household.build(typeId, { seed: 3 }, mesh.api)
  const { group, parts } = mesh.finish(spec)
  const out: Posed[] = []
  for (const part of spec.parts ?? []) {
    const g = parts[part.id]
    if (!g) continue
    const merged = g.userData.merged as { apply?: (m: typeof part.motion, t: number) => void } | undefined
    const pose = (t: number): void => {
      if (merged) merged.apply?.(part.motion, t)
      else applyPose(THREE, g, part.motion, t)
    }
    for (const t of STOPS) {
      pose(t)
      const hits = coincidentFacesOf(group as never, { maxHits: Number.POSITIVE_INFINITY })
      const { meshes } = meshBatchesOf(group as never)
      const inPart = (i: number): boolean => {
        let o: THREE.Object3D | null = meshes[i] as unknown as THREE.Object3D
        while (o) {
          if (o === g) return true
          o = o.parent
        }
        return false
      }
      const across = hits.filter((h) => inPart(h.batchA) !== inPart(h.batchB))
      if (across.length) out.push({ id: `household/${typeId}:${quality} ${part.id}@${t}`, hits: across })
    }
    pose(0)
  }
  return out
}

describe('z-fighting of moving parts', () => {
  it('no part of the catalog meets another face on its plane at any stop of its travel', async () => {
    const problems: string[] = []
    for (const quality of ['high', 'game'] as const) {
      for (const type of household.types) {
        for (const posed of posedHits(type.id, quality)) problems.push(`${posed.id}: ${posed.hits.length}\n${describeCoincidentFaces(posed.hits, 4)}`)
        await new Promise((resolve) => setImmediate(resolve))
      }
    }
    expect(problems, problems.join('\n')).toEqual([])
  }, 600_000)
})
