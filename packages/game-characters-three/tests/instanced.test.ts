import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { snapshotScene } from '@adatechnology/golden-tool'
import { GUIDE, TEAM_GAME, createBodySpec } from '@adatechnology/game-characters'

import { BODY_CHUNK, buildInstancedBody, createBodyChunk, jointsOf, LOD_SEGMENTS, lodAt } from '../src'
import { fnvOfArray } from './helpers'
import goldenBody from './fixtures/team-golden/game-instanced-body.json'
import goldenChunk from './fixtures/team-golden/game-body-chunk.json'

type BodyEvent = { type: string; data: { segments: number; vertices: number; triangles: number; box: number[]; position: string; normal: string; bone: string; vcol: string; pivot: string; ppivot: string } }

const round4 = (value: number): number => Math.round(value * 1e4) / 1e4

describe('G-instanced (source): the vertex chunk is the game chunk, byte for byte', () => {
  const [event] = goldenChunk.events as unknown as { data: { length: number; lines: number; sha256: string; jointUniforms: number } }[]

  it('has the length, lines and sha-256 recorded from the game', () => {
    expect(BODY_CHUNK).toHaveLength(event!.data.length)
    expect(BODY_CHUNK.split('\n')).toHaveLength(event!.data.lines)
    expect(createHash('sha256').update(BODY_CHUNK).digest('hex')).toBe(event!.data.sha256)
    expect((BODY_CHUNK.match(/vec3\(\s*-?[0-9.]+,/g) ?? []).length).toBe(event!.data.jointUniforms)
  })

  it('only the hip joint is parameterised, and the default is the chunk itself', () => {
    expect(createBodyChunk()).toBe(BODY_CHUNK)
    expect(createBodyChunk({ hipHeight: 0.92 })).toContain('q -= vec3(0.,0.92,0.)')
    expect(createBodyChunk({ hipHeight: 0.92 })).toHaveLength(BODY_CHUNK.length)
    expect(createBodyChunk({ hipHeight: 0.92 })).not.toContain('vec3(0.,0.95,0.)')
  })
})

describe('G-instanced (geometry): buildBody with the game proportions (TEAM_GAME)', () => {
  const events = (goldenBody.events as unknown as BodyEvent[]).filter((event) => event.type === 'body')

  for (const { data } of events) {
    it(`${data.segments} segments: ${data.vertices} vertices, every attribute hashes like the game's`, () => {
      const geometry = buildInstancedBody(THREE, { segments: data.segments })
      expect(geometry.attributes.position!.count).toBe(data.vertices)
      expect(geometry.attributes.position!.count / 3).toBe(data.triangles)
      geometry.computeBoundingBox()
      const { min, max } = geometry.boundingBox!
      expect([min.x, min.y, min.z, max.x, max.y, max.z].map(round4)).toEqual(data.box)
      for (const name of ['position', 'normal', 'bone', 'vcol', 'pivot', 'ppivot'] as const) expect(fnvOfArray(geometry.attributes[name]!.array), name).toBe(data[name])
    })

    it(`${data.segments} segments: the scene hash of the merged mesh matches`, () => {
      const geometry = buildInstancedBody(THREE, { segments: data.segments })
      const snapshot = snapshotScene(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff })))
      const expected = (goldenBody.scenes as Record<string, { hash: string; objects: number }>)[`body_${data.segments}`]!
      expect({ hash: snapshot.hash, objects: snapshot.objects }).toEqual({ hash: expected.hash, objects: expected.objects })
    })
  }

  it('the three levels of detail are 16, 10 and 5 segments, and a far body picks the last', () => {
    expect(LOD_SEGMENTS).toEqual([16, 10, 5])
    expect([5, 18, 54.9, 55, 200].map((distance) => lodAt(distance))).toEqual([0, 1, 1, 2, 2])
  })
})

describe('G-instanced (GUIDE proportions, an assumed deviation P1)', () => {
  it('the joints follow the spec: the arms hang from the guide shoulders, 0.61 m apart', () => {
    const geometry = buildInstancedBody(THREE, { segments: 16, body: GUIDE })
    const joints = jointsOf(GUIDE)
    expect(joints.shoulderD[0] - joints.shoulderE[0]).toBeCloseTo(0.61, 9)
    const bone = geometry.attributes.bone!
    const pivot = geometry.attributes.pivot!
    const pivots = new Set<string>()
    for (let index = 0; index < bone.count; index++) if (bone.getX(index) === 3) pivots.add([pivot.getX(index), pivot.getY(index), pivot.getZ(index)].map(round4).join(','))
    expect([...pivots]).toContain('0.305,1.475,0')
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(1.7)
    expect(geometry.boundingBox!.max.y).toBeLessThan(1.9)
  })

  it('the sides are told apart by x, so a spec that names them the other way round builds the same geometry', () => {
    const mirrored = createBodySpec({
      joints: { ...TEAM_GAME.joints, shoulderL: TEAM_GAME.joints.shoulderR, shoulderR: TEAM_GAME.joints.shoulderL, hipL: TEAM_GAME.joints.hipR, hipR: TEAM_GAME.joints.hipL },
    }, TEAM_GAME)
    const reference = buildInstancedBody(THREE, { segments: 5 })
    const swapped = buildInstancedBody(THREE, { segments: 5, body: mirrored })
    expect(fnvOfArray(swapped.attributes.position!.array)).toBe(fnvOfArray(reference.attributes.position!.array))
  })
})
