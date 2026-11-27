import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildInstancedBody, createBodyBatch, createBodyMaterial } from '../src'

const time = { value: 0 }
const color = { r: 1, g: 1, b: 1 }
const base = { a: [1, 2, 0.5, 0] as const, b: [1, 1, 0, 0] as const, c: [0, 0, 1, 0] as const, color }

const compiled = (params: Parameters<typeof createBodyMaterial>[1]) => {
  const material = createBodyMaterial(THREE, params)
  const shader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: '#include <common>\n#include <begin_vertex>\n#include <beginnormal_vertex>\nvarying vec3 vTint;\nvGlow = mat==3.',
    fragmentShader: '#include <common>\n#include <color_fragment>\n#include <dithering_fragment>\nvarying vec3 vTint;',
  }
  ;(material.onBeforeCompile as (shader: unknown) => void)(shader)
  return { material, shader }
}

describe('the oriented body material (spec 008, T5.4b)', () => {
  it('turns the body by iQ when it holds one and by the yaw when it is zero, in the position and in the normal', () => {
    const { shader } = compiled({ time, oriented: true })
    expect(shader.vertexShader).toContain('attribute vec4 iQ;')
    expect(shader.vertexShader).toContain('transformed = (dot(iQ, iQ) > 0.5 ? quatTurn(iQ, transformed) : rY(iA.z)*transformed) + vec3(iA.x, floor(iB.w/16.)/1000. - 2., iA.y);')
    expect(shader.vertexShader).toContain('objectNormal = dot(iQ, iQ) > 0.5 ? quatTurn(iQ, _nn) : rY(iA.z)*_nn;')
  })

  it('without the option the shader is the one it was: no iQ, the yaw only, and the program key is the same as before', () => {
    const { material, shader } = compiled({ time })
    expect(shader.vertexShader).not.toContain('iQ')
    expect(shader.vertexShader).toContain('transformed = rY(iA.z)*transformed + vec3(')
    expect(material.customProgramCacheKey()).toBe(createBodyMaterial(THREE, { time }).customProgramCacheKey())
  })

  it('has its own program key, with and without the identity extension, in the shadow passes too', () => {
    const keys = new Set([
      createBodyMaterial(THREE, { time }).customProgramCacheKey(),
      createBodyMaterial(THREE, { time, oriented: true }).customProgramCacheKey(),
      createBodyMaterial(THREE, { time, identity: true }).customProgramCacheKey(),
      createBodyMaterial(THREE, { time, identity: true, oriented: true }).customProgramCacheKey(),
    ])
    expect(keys.size).toBe(4)
    expect(compiled({ time, oriented: true, identity: true, depth: true }).shader.vertexShader).toContain('quatTurn(iQ, transformed)')
  })
})

describe('the oriented body batch (spec 008, T5.4b)', () => {
  it('holds a quaternion per instance, zero for the body that has none, and a batch that is not oriented has no iQ', () => {
    const geometry = buildInstancedBody(THREE, { segments: 5 })
    const batch = createBodyBatch(THREE, geometry, { max: 3, time, oriented: true })
    batch.begin()
    batch.push({ ...base })
    batch.push({ ...base, rotation: [0.5, 0.5, -0.5, 0.5] })
    batch.end()
    const attribute = (batch.mesh.geometry as THREE.InstancedBufferGeometry).getAttribute('iQ')
    expect(Array.from(attribute.array.slice(0, 8))).toEqual([0, 0, 0, 0, 0.5, 0.5, -0.5, 0.5])
    const plain = createBodyBatch(THREE, geometry, { max: 1, time })
    expect((plain.mesh.geometry as THREE.InstancedBufferGeometry).getAttribute('iQ')).toBeUndefined()
  })
})
