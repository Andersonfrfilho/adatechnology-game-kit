import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { CLIP_BONES, CLIP_LIMIT, CLIP_TEXELS, SEGMENT_CLIPS, bakeSegmentClips, clipIndexOf, createBodyBatch, buildInstancedBody, createBodyMaterial, createSegmentClipUniforms, packIdentity, unpackIdentity, walkPoseVertex } from '../src'
import type { SegmentClipSet } from '../src'

type Vec3 = [number, number, number]
type Quat = [number, number, number, number]
const quatAt = (set: SegmentClipSet, clip: number, step: number, bone: number, texel = 0): Quat => {
  const at = ((set.start[clip]! + step) * CLIP_TEXELS + bone * 2 + texel) * 4
  return [set.data[at]!, set.data[at + 1]!, set.data[at + 2]!, set.data[at + 3]!]
}
const rotate = (q: Quat, v: Vec3): Vec3 => {
  const t: Vec3 = [2 * (q[1] * v[2] - q[2] * v[1]), 2 * (q[2] * v[0] - q[0] * v[2]), 2 * (q[0] * v[1] - q[1] * v[0])]
  return [v[0] + q[3] * t[0] + (q[1] * t[2] - q[2] * t[1]), v[1] + q[3] * t[1] + (q[2] * t[0] - q[0] * t[2]), v[2] + q[3] * t[2] + (q[0] * t[1] - q[1] * t[0])]
}
const halfWay = (a: Quat, b: Quat): Quat => {
  const m: Quat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (a[3] + b[3]) / 2]
  const length = Math.hypot(...m)
  return [m[0] / length, m[1] / length, m[2] / length, m[3] / length]
}
const REST: Vec3 = [0.1, 0.4, 0.05]
const PIVOT: Vec3 = [0.1, 0.95, 0]
const SHOULDER: Vec3 = [0.3, 1.45, 0]

/** The clip walk of a vertex, as the shader applies it: own rotation about the pivot, the parent's about its pivot, the torso's about the hip, the bounce. */
const walked = (set: SegmentClipSet, bone: number, step: number, pivot: Vec3, parentPivot: Vec3): Vec3 => {
  const blended = (b: number): Quat => halfWay(quatAt(set, clipIndexOf(set, 'walk_down'), step, b), quatAt(set, clipIndexOf(set, 'walk_up'), step, b))
  const sub = (v: Vec3, c: Vec3): Vec3 => [v[0] - c[0], v[1] - c[1], v[2] - c[2]]
  const add = (v: Vec3, c: Vec3): Vec3 => [v[0] + c[0], v[1] + c[1], v[2] + c[2]]
  let q: Vec3 = REST
  const limb = [2, 3, 4, 5, 7, 8, 9, 10].includes(bone)
  if (limb) q = add(rotate(blended(bone), sub(q, pivot)), pivot)
  if (bone >= 7 && bone <= 10) q = add(rotate(blended(bone - 5), sub(q, parentPivot)), parentPivot)
  if (![4, 5, 9, 10].includes(bone)) {
    const torso = blended(0)
    const rest: Quat = [0.05996, 0, 0, 0.9982]
    const whole: Quat = [torso[3] * rest[0] + rest[3] * torso[0], torso[3] * rest[1] + rest[3] * torso[1] + torso[2] * rest[0] - torso[0] * rest[2], torso[3] * rest[2] + rest[3] * torso[2] + torso[0] * rest[1] - torso[1] * rest[0], torso[3] * rest[3] - torso[0] * rest[0]]
    q = add(rotate(whole, sub(q, [0, 0.95, 0])), [0, 0.95, 0])
  }
  const bounce = (quatAt(set, clipIndexOf(set, 'walk_down'), step, 0, 1)[1] + quatAt(set, clipIndexOf(set, 'walk_up'), step, 0, 1)[1]) / 2
  return [q[0], q[1] + bounce, q[2]]
}

describe('the segment clips', () => {
  const set = bakeSegmentClips()

  it('hold 14 clips (a gait family with arms down and up) in 12 bones of 24 texels, sampled at 30 Hz', () => {
    expect(SEGMENT_CLIPS).toHaveLength(14)
    expect(SEGMENT_CLIPS.length).toBeLessThanOrEqual(CLIP_LIMIT)
    expect(CLIP_BONES).toBe(12)
    expect(CLIP_TEXELS).toBe(24)
    expect(set.data).toHaveLength(set.rows * CLIP_TEXELS * 4)
    expect(set.rows).toBe(set.frames.reduce((sum, frames) => sum + frames, 0))
    expect(set.start.at(-1)! + set.frames.at(-1)!).toBe(set.rows)
  })

  it('are unit quaternions, every bone of every row', () => {
    for (let row = 0; row < set.rows; row += 7) for (let bone = 0; bone < CLIP_BONES; bone++) expect(Math.hypot(...quatAt({ ...set, start: [0] }, 0, row, bone))).toBeCloseTo(1, 5)
  })

  it('loop: the step after the last is the first', () => {
    const walk = clipIndexOf(set, 'walk_down')
    const frames = set.frames[walk]!
    const last = quatAt(set, walk, frames - 1, 4)
    const first = quatAt(set, walk, 0, 4)
    const next = walked(set, 4, frames - 1, PIVOT, PIVOT)
    expect(Math.hypot(last[0] - first[0], last[3] - first[3])).toBeLessThan(0.4)
    expect(next[0]).toBeCloseTo(0.1, 1)
  })

  it('walk the way the shader walk does (the impostor atlas port), arms half raised', () => {
    for (const bone of [0, 2, 3, 4, 5, 7, 8, 9, 10]) {
      for (const step of [0, 3, 6, 9, 12, 15, 18, 21]) {
        const expected = walkPoseVertex(REST, [0, 0, 1], { bone, pivot: bone === 7 || bone === 8 ? [0.3, 1.1, 0] : bone >= 9 ? [0.1, 0.5, 0] : bone >= 2 && bone <= 3 ? SHOULDER : PIVOT, parentPivot: bone === 7 || bone === 8 ? SHOULDER : PIVOT }, step, 24).position
        const pivot: Vec3 = bone === 7 || bone === 8 ? [0.3, 1.1, 0] : bone >= 9 ? [0.1, 0.5, 0] : bone >= 2 && bone <= 3 ? SHOULDER : PIVOT
        const parent: Vec3 = bone === 7 || bone === 8 ? SHOULDER : PIVOT
        const got = walked(set, bone, step, pivot, parent)
        // the nlerp of the two arm clips is not the same angle as the average of the angles, so the arms get a looser bound
        const tolerance = bone === 2 || bone === 3 || bone === 7 || bone === 8 ? 0.06 : 0.02
        expect(Math.abs(got[0] - expected[0]), `bone ${bone} step ${step} x`).toBeLessThan(tolerance)
        expect(Math.abs(got[1] - expected[1]), `bone ${bone} step ${step} y`).toBeLessThan(tolerance)
        expect(Math.abs(got[2] - expected[2]), `bone ${bone} step ${step} z`).toBeLessThan(tolerance)
      }
    }
  })

  it('differ by gait: the limp bends the left leg and not the right, the drag holds a leg back', () => {
    const left = clipIndexOf(set, 'limp_left_down')
    const walk = clipIndexOf(set, 'walk_down')
    const diff = (clip: number, bone: number) => Array.from({ length: 24 }, (_, step) => Math.abs(quatAt(set, clip, step, bone)[0] - quatAt(set, walk, step, bone)[0])).reduce((sum, value) => sum + value, 0)
    expect(diff(left, 4)).toBeGreaterThan(1)
    expect(diff(left, 5)).toBeCloseTo(0, 6)
    expect(diff(clipIndexOf(set, 'drag_down'), 4)).toBeGreaterThan(1)
    expect(set.cycles[clipIndexOf(set, 'lurch_down')]).toBe(2)
  })
})

describe('the clip texture and the material that reads it', () => {
  it('is RGBA32F, 24 texels wide, nearest filtered, with the tables the shader indexes', () => {
    const uniforms = createSegmentClipUniforms(THREE)
    const texture = uniforms.uClips.value
    expect(texture.image.width).toBe(24)
    expect(texture.type).toBe(THREE.FloatType)
    expect(texture.minFilter).toBe(THREE.NearestFilter)
    expect(texture.magFilter).toBe(THREE.NearestFilter)
    expect(texture.generateMipmaps).toBe(false)
    expect(uniforms.uClipStart.value).toHaveLength(16)
    expect(uniforms.uClipFrames.value[13]).toBe(24)
  })

  it('adds the clip functions and a third program key only with the option, and shares the uniforms', () => {
    const uniforms = createSegmentClipUniforms(THREE)
    const time = { value: 0 }
    const compile = (params: Parameters<typeof createBodyMaterial>[1]) => {
      const material = createBodyMaterial(THREE, params)
      const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <beginnormal_vertex>\nvarying vec3 vTint;\nvGlow = mat==3.', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <dithering_fragment>\nvarying vec3 vTint;' }
      ;(material.onBeforeCompile as (shader: unknown) => void)(shader)
      return { material, shader }
    }
    const plain = compile({ time, identity: true })
    const clipped = compile({ time, identity: true, segmentClips: uniforms })
    expect(plain.shader.vertexShader).not.toContain('bodyAnimClip')
    expect(clipped.shader.vertexShader).toContain('vec3 bodyAnimClip(vec3 p, inout vec3 nrm)')
    expect(clipped.shader.vertexShader).toContain('clipped ? bodyAnimClip(p, nrm) : bodyAnim(p, nrm)')
    expect(clipped.shader.uniforms.uClips).toBe(uniforms.uClips)
    expect(clipped.material.customProgramCacheKey()).not.toBe(plain.material.customProgramCacheKey())
    expect(compile({ time, identity: true, depth: true, segmentClips: uniforms }).shader.vertexShader).toContain('bodyAnimClip')
  })

  it('the batch hands it to every material, and the look says when a body walks from the clips', () => {
    const uniforms = createSegmentClipUniforms(THREE)
    const batch = createBodyBatch(THREE, buildInstancedBody(THREE, { segments: 5 }), { max: 1, time: { value: 0 }, identity: true, segmentClips: uniforms })
    expect(batch.mesh.customDepthMaterial).toBeDefined()
    const look = unpackIdentity(packIdentity({ wounds: 0, freshness: 0, trousers: 0, gaitStyle: 0, accessories: 0, clipA: 6, clipB: 7, clipBlend: 0.5, clips: true }))
    expect(look).toMatchObject({ clipA: 6, clipB: 7, clips: true })
    expect(unpackIdentity(packIdentity({ wounds: 0, freshness: 0, trousers: 0, gaitStyle: 0, accessories: 0 })).clips).toBe(false)
  })
})
