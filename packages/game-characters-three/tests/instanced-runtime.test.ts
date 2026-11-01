import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { INSTANCE_POSES, createRng, decodePoseHeight } from '@adatechnology/game-characters'

import { BAKE_NEUTRAL_POSE, bakeBody, bakeVariants, buildInstancedBody, createBodyBatch, createBodyMaterial, createFlyingLimbs, createVariantBatches } from '../src'
import type { BakeBuilders } from '../src'

const time = { value: 0 }

describe('body material', () => {
  const shaderOf = (depth: boolean) => {
    const material = createBodyMaterial(THREE, { depth, time })
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\n#include <begin_vertex>\n#include <beginnormal_vertex>\nvarying vec3 vTint;\nvGlow = mat==3.',
      fragmentShader: '#include <common>\n#include <color_fragment>\n#include <dithering_fragment>\nvarying vec3 vTint;',
    }
    ;(material.onBeforeCompile as (shader: unknown) => void)(shader)
    return shader
  }

  it('shares the clock and puts the pose chunk before the vertex code', () => {
    const shader = shaderOf(false)
    expect(shader.uniforms.uTime).toBe(time)
    expect(shader.vertexShader).toContain('vec3 bodyAnim(vec3 p, inout vec3 nrm)')
    expect(shader.vertexShader).toContain('vec3 transformed = bodyAnim(position, _n);')
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = vTint;')
    expect(shader.fragmentShader).toContain('vEyeC*2.4')
  })

  it('the depth material only moves the vertices, without tints', () => {
    const shader = shaderOf(true)
    expect(shader.vertexShader).toContain('bodyAnim(position, _n)')
    expect(shader.fragmentShader).toBe('#include <common>\n#include <color_fragment>\n#include <dithering_fragment>\nvarying vec3 vTint;')
  })
})

describe('body batch', () => {
  it('packs instances into the five attributes and counts them', () => {
    const batch = createBodyBatch(THREE, buildInstancedBody(THREE, { segments: 5 }), { max: 2, time })
    batch.begin()
    batch.push({ a: [1, 2, 3, 4], b: [1.8, 1, 0.5, INSTANCE_POSES.indexOf('leap')], c: [0, 0.2, 1, 0.3], color: { r: 0.1, g: 0.2, b: 0.3 }, eye: { r: 1, g: 0, b: 0 }, y: 1.25 })
    batch.push({ a: [0, 0, 0, 0], b: [1, 1, 0, 0], c: [0, 0, 0, 0], color: { r: 1, g: 1, b: 1 } })
    batch.push({ a: [9, 9, 9, 9], b: [9, 9, 9, 9], c: [9, 9, 9, 9], color: { r: 9, g: 9, b: 9 } })
    batch.end()
    expect(batch.count).toBe(2)
    expect(batch.mesh.count).toBe(2)
    const attributes = batch.mesh.geometry.attributes
    expect(Array.from((attributes.iA!.array as Float32Array).slice(0, 4))).toEqual([1, 2, 3, 4])
    const packed = (attributes.iB!.array as Float32Array)[3]!
    expect(decodePoseHeight(packed)).toEqual({ pose: 'leap', height: 1.25 })
    expect(Array.from((attributes.iEye!.array as Float32Array).slice(0, 6))).toEqual([1, 0, 0, 0, 0, 0])
    expect(batch.mesh.frustumCulled).toBe(false)
  })
})

/** Vertex attribute slots a draw uses: the geometry's (a `mat4` takes 4), plus the `instanceMatrix` of an `InstancedMesh`. */
const vertexAttributeSlots = (mesh: THREE.Mesh): number => {
  const slots = Object.values(mesh.geometry.attributes).reduce((sum, attribute) => sum + Math.ceil(attribute.itemSize / 4), 0)
  return slots + ((mesh as THREE.InstancedMesh).isInstancedMesh ? 4 : 0)
}
const WEBGL2_MAX_VERTEX_ATTRIBS = 16
const SLOT_HEADROOM = 2

describe('body batch vertex attributes (MAX_VERTEX_ATTRIBS)', () => {
  it('draws as a plain Mesh over an instanced geometry, with no instance matrix', () => {
    const batch = createBodyBatch(THREE, buildInstancedBody(THREE, { segments: 5 }), { max: 2, time })
    expect((batch.mesh as unknown as THREE.InstancedMesh).isInstancedMesh).toBeUndefined()
    expect(batch.mesh.geometry).toBeInstanceOf(THREE.InstancedBufferGeometry)
    expect((batch.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(0)
    batch.begin()
    batch.push({ a: [0, 0, 0, 0], b: [1, 1, 0, 0], c: [0, 0, 0, 0], color: { r: 1, g: 1, b: 1 } })
    batch.end()
    expect((batch.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(1)
  })

  it('keeps the program at 11 slots, with headroom under the WebGL2 minimum', () => {
    const geometry = buildInstancedBody(THREE, { segments: 5 })
    const batch = createBodyBatch(THREE, geometry, { max: 2, time })
    expect(vertexAttributeSlots(batch.mesh)).toBe(11)
    expect(vertexAttributeSlots(batch.mesh)).toBeLessThanOrEqual(WEBGL2_MAX_VERTEX_ATTRIBS - SLOT_HEADROOM)
    const old = new THREE.InstancedMesh(batch.mesh.geometry, batch.mesh.material, 2)
    expect(vertexAttributeSlots(old)).toBe(15)
  })
})

describe('flying limbs', () => {
  const blood = { color: 0x9e1b12, dried: 0x4a0a08, bleeds: true }

  it('launches with the game draw order, bounces, splats once and comes to rest', () => {
    const splats: unknown[] = []
    const launches: string[] = []
    const limbs = createFlyingLimbs(THREE, { random: createRng(3), effects: { onSplat: (splat) => splats.push(splat), onLaunch: (_limb, kind) => launches.push(kind) } })
    const mirror = createRng(3)
    const limb = limbs.launch({ x: 1, z: 2, kind: 'leg', color: 0x123456, blood })
    expect(launches).toEqual(['leg'])
    expect(limb).toMatchObject({ y: 0.5, len: 1.3, col: 0x2c3340, rest: false, splat: false })
    expect(limb.vx).toBe((mirror() - 0.5) * 3)
    expect(limb.vy).toBe(2 + mirror() * 2)
    expect(limb.vz).toBe((mirror() - 0.5) * 3)
    for (let step = 0; step < 400; step++) limbs.update(1 / 60)
    expect(limb.rest).toBe(true)
    expect(limb.rx).toBe(Math.PI / 2)
    expect(splats).toHaveLength(1)
    expect(limbs.mesh.count).toBe(1)
  })

  it('a body that does not bleed splats the first time it lands without a launch effect, and the pool reuses the oldest piece', () => {
    const limbs = createFlyingLimbs(THREE, { max: 2, random: createRng(1) })
    const first = limbs.launch({ x: 0, z: 0, kind: 'arm', color: 0xabcdef, blood: { ...blood, bleeds: false } })
    expect(first).toMatchObject({ y: 1.2, len: 1, col: 0xabcdef, splat: true })
    limbs.launch({ x: 1, z: 0, kind: 'arm', color: 1, blood })
    const third = limbs.launch({ x: 2, z: 0, kind: 'arm', color: 2, blood })
    expect(third).toBe(first)
    expect(limbs.limbs).toHaveLength(2)
  })
})

/** A rig as the rich builder makes it: a trunk, a head group, two arms and two legs, built from boxes. */
const fakeBuilders = (): BakeBuilders => {
  const top = new THREE.MeshLambertMaterial({ color: 0x4a6f96 })
  const skin = new THREE.MeshLambertMaterial({ color: 0xc0a080 })
  const blood = new THREE.MeshStandardMaterial({ color: 0x6e1410, polygonOffset: true })
  const box = (material: THREE.Material): THREE.Mesh => new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), material)
  return {
    topMaterial: () => top,
    buildBest: (spec, lod) => {
      const root = new THREE.Group()
      const fig = new THREE.Group()
      root.add(fig)
      const upper = new THREE.Group()
      upper.position.y = 0.9
      fig.add(upper)
      const headGroup = new THREE.Group()
      headGroup.position.set(0, 1.64, 0)
      upper.add(headGroup)
      const head = box(skin)
      head.userData.bone = 11
      headGroup.add(head)
      const eye = box(new THREE.MeshBasicMaterial({ color: 0xff0000 }))
      eye.userData.eye = 1
      headGroup.add(eye)
      const arms = [1, -1].map((side) => {
        const g = new THREE.Group()
        g.position.set(side * 0.3, 1.475, 0)
        upper.add(g)
        const el = new THREE.Group()
        el.position.y = -0.31
        g.add(el)
        g.add(box(top))
        el.add(box(skin))
        return { g, el, s: side }
      })
      const legs = [-1, 1].map((side) => {
        const g = new THREE.Group()
        g.position.set(side * 0.1, 0.9, 0)
        fig.add(g)
        const kn = new THREE.Group()
        kn.position.y = -0.42
        g.add(kn)
        g.add(box(skin))
        return { g, kn, s: side }
      })
      upper.add(box(top))
      upper.add(box(blood))
      const hidden = box(skin)
      hidden.visible = false
      upper.add(hidden)
      headGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true })))
      root.userData.rig = { P: { s: 1 + (spec.seed ?? 0) / 1e5, bulk: 1 }, fig, upper, headG: headGroup, arms, legs, lod }
      return root
    },
  }
}

describe('bakeBody', () => {
  it('resets the rig, tags every visible opaque mesh with its bone, pivot and colour, and counts the vertices', () => {
    const { geo, verts, s, bulk } = bakeBody(THREE, fakeBuilders(), { type: 'Lento', decay: 1, seed: 7 }, 1)
    expect(s).toBeCloseTo(1.00007, 9)
    expect(bulk).toBe(1)
    expect(geo.attributes.position!.count).toBe(verts)
    expect(verts).toBe(10 * 24)
    const bones = new Set(Array.from(geo.attributes.bone!.array))
    expect([...bones].sort((a, b) => a - b)).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 11])
    const vcol = geo.attributes.vcol!.array as Float32Array
    const materials = new Set<number>()
    for (let vertex = 0; vertex < verts; vertex++) materials.add(vcol[vertex * 4 + 3]!)
    expect([...materials].sort()).toEqual([1, 3, 6])
    expect(geo.index!.count).toBe(verts * 1.5)
  })

  it('blood turns vivid wine red and an eye is enlarged around its centre; the pose goes in neutral', () => {
    const { geo } = bakeBody(THREE, fakeBuilders(), { type: 'Lento', seed: 1, pose: { lean: 0.4 } }, 0.28)
    const vcol = geo.attributes.vcol!.array as Float32Array
    const bloody: number[][] = []
    for (let vertex = 0; vertex < geo.attributes.position!.count; vertex++) if (vcol[vertex * 4 + 3] === 6 && vcol[vertex * 4] === Math.fround(0.3)) bloody.push([vcol[vertex * 4 + 1]!, vcol[vertex * 4 + 2]!])
    expect(bloody).toHaveLength(24)
    expect(bloody.every(([green, blue]) => green! <= 0.04 && blue! <= 0.04)).toBe(true)
    expect(BAKE_NEUTRAL_POSE.lean).toBe(0)
  })

  it('bakeVariants follows the ZVAR rule and a variant gets three batches sized for a horde', () => {
    const { variants, byType } = bakeVariants(THREE, fakeBuilders(), [
      { id: 'walker', name: 'Lento', index: 0 },
      { id: 'screamer', name: 'Gritador', index: 4 },
    ])
    expect(byType.get('walker')).toEqual([0, 1, 2, 3])
    expect(byType.get('screamer')).toEqual([4])
    expect(variants.map((variant) => [variant.seed, variant.decay])).toEqual([[7000, 1], [7013, 2], [7026, 1], [7039, 2], [7404, 1]])
    const batches = createVariantBatches(THREE, variants[0]!, time)
    expect(batches.map((batch) => batch.max)).toEqual([160, 700, 2600])
    expect(batches.map((batch) => batch.mesh.castShadow)).toEqual([true, true, false])
  })
})
