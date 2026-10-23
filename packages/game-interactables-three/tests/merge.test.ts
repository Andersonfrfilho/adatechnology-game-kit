import { createWorld } from '@adatechnology/game-interactables'
import { createHousehold } from '@adatechnology/game-interactables-household'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createMeshApi, syncObject } from '../src'

const hh = createHousehold({ region: 'br', locale: 'en' })

function make(type: string, opts: { merge: boolean; quality?: 'game' | 'high' }, item: Record<string, unknown> = { seed: 4 }) {
  const mesh = createMeshApi(THREE, { quality: opts.quality ?? 'game', mergeParts: opts.merge })
  const spec = hh.build(type, item, mesh.api)
  const res = mesh.finish(spec)
  const world = createWorld()
  world.add('o', spec, { x: 0, y: 0, z: 0, ry: 0 })
  return { res, spec, world }
}
const meshCount = (g: THREE.Object3D) => {
  let n = 0
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.visible) n++
  })
  return n
}

describe('game quality shares the opaque material', () => {
  it('plain, metal, wood and fabric are one instance (and one mesh per target)', () => {
    const m = createMeshApi(THREE, { quality: 'game' })
    expect(m.materials.plain).toBe(m.materials.wood)
    expect(m.materials.metal).toBe(m.materials.fabric)
    expect(m.materials.glass).not.toBe(m.materials.plain)
    m.api.box({}, 'wood', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0)
    m.api.box({}, 'metal', 2, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0)
    m.api.box({}, 'glass', 4, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0)
    expect(m.finish().group.children.length).toBe(2)
    const high = createMeshApi(THREE, { quality: 'high' })
    expect(high.materials.plain).not.toBe(high.materials.wood)
  })
})

describe('mergeParts (game quality)', () => {
  it('blinds: at most 4 meshes instead of one per slat', () => {
    const before = make('blinds', { merge: false })
    const after = make('blinds', { merge: true })
    expect(meshCount(before.res.group)).toBeGreaterThan(30)
    expect(meshCount(after.res.group)).toBeLessThanOrEqual(4)
  })

  it('clothesline: at most 6 meshes instead of one per cloth', () => {
    const before = make('clothesline', { merge: false })
    const after = make('clothesline', { merge: true })
    expect(meshCount(before.res.group)).toBeGreaterThan(10)
    expect(meshCount(after.res.group)).toBeLessThanOrEqual(6)
  })

  it('is off in high quality unless asked for', () => {
    const high = make('blinds', { merge: undefined as unknown as boolean, quality: 'high' })
    expect(meshCount(high.res.group)).toBeGreaterThan(30)
  })

  it('merged slats pose exactly like the separate part groups', () => {
    const sep = make('blinds', { merge: false })
    const mer = make('blinds', { merge: true })
    for (const t of [0, 0.4, 1]) {
      for (const w of [sep, mer]) {
        for (const p of w.spec.parts!.filter((q) => q.group === 'tilt')) w.world.setPart('o', p.id, t, true)
      }
      syncObject(THREE, sep.world, 'o', sep.res.parts)
      syncObject(THREE, mer.world, 'o', mer.res.parts)
      sep.res.group.updateMatrixWorld(true)
      mer.res.group.updateMatrixWorld(true)
      // world bounds of every slat, separate: the part group; merged: emulate the vertex shader on the vertices
      const box = new THREE.Box3()
      for (const p of sep.spec.parts!.filter((q) => q.group === 'tilt')) box.union(new THREE.Box3().setFromObject(sep.res.parts[p.id], true))
      const merged = mer.res.parts['slat_1']
      const batch = merged.userData.merged as { kind: string }
      expect(batch.kind).toBe('pose')
      const mesh = merged.children[0] as THREE.Mesh
      const mat = mesh.material as THREE.Material
      let uni: Record<string, { value: any }> = {}
      const shader = { uniforms: uni, vertexShader: '#include <begin_vertex>' }
      mat.onBeforeCompile(shader as any, undefined as any)
      uni = shader.uniforms
      const q = uni.batchQ.value as THREE.Vector4
      const pos = uni.batchPos.value as THREE.Vector3
      const sc = uni.batchScale.value as THREE.Vector3
      const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w)
      const pa = mesh.geometry.getAttribute('position')
      const pv = mesh.geometry.getAttribute('batchPivot')
      const out = new THREE.Box3()
      const v = new THREE.Vector3()
      const c = new THREE.Vector3()
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i)
        c.fromBufferAttribute(pv, i)
        out.expandByPoint(v.sub(c).multiply(sc).applyQuaternion(quat).add(c).add(pos))
      }
      for (const a of ['x', 'y', 'z'] as const) {
        expect(out.min[a], `t=${t} min ${a}`).toBeCloseTo(box.min[a], 4)
        expect(out.max[a], `t=${t} max ${a}`).toBeCloseTo(box.max[a], 4)
      }
    }
  })

  it('merged clothes keep one swing each', () => {
    const w = make('clothesline', { merge: true })
    const cloths = w.spec.soft!.filter((s) => s.kind === 'cloth')
    expect(cloths.length).toBeGreaterThan(3)
    w.world.push([cloths[1].anchor[0], 1, cloths[1].anchor[2]], 0.4, [1, 0, 0])
    w.world.update(0.05)
    syncObject(THREE, w.world, 'o', w.res.parts, { time: 2 })
    const g = w.res.parts[cloths[0].part ?? cloths[0].id]
    const batch = g.userData.merged as { kind: string; index: Record<string, number> }
    expect(batch.kind).toBe('sway')
    expect(Object.keys(batch.index).length).toBe(cloths.length)
    const mesh = g.children[0] as THREE.Mesh
    const ids = new Set<number>()
    const id = mesh.geometry.getAttribute('swayId')
    for (let i = 0; i < id.count; i++) ids.add(id.getX(i))
    expect(ids.size).toBe(cloths.length)
    const anchor = mesh.geometry.getAttribute('swayAnchor')
    expect(anchor.getX(0)).toBeGreaterThan(1)
    const shader = { uniforms: {} as Record<string, { value: any }>, vertexShader: '#include <begin_vertex>' }
    ;(mesh.material as THREE.Material).onBeforeCompile(shader as any, undefined as any)
    const axz = shader.uniforms.swayAxz.value as THREE.Vector2[]
    const swing = axz.map((a) => Math.abs(a.x) + Math.abs(a.y))
    expect(Math.max(...swing)).toBeGreaterThan(0)
    expect(swing[batch.index[cloths[1].id]]).toBe(Math.max(...swing))
    expect(shader.uniforms.swayTime.value).toBe(2)
  })

  it('leaves unrelated parts alone', () => {
    const w = make('wardrobe', { merge: true })
    for (const p of w.spec.parts!) expect(w.res.parts[p.id].userData.merged).toBeUndefined()
  })
})

describe('merged groups keep the host material', () => {
  // a light mask like a host would add: marks the shader, a define and a cache key on the material it passes in
  function masked() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
    const calls: unknown[] = []
    mat.defines = { ROOM_MASK: '1' }
    mat.userData.mask = true
    mat.onBeforeCompile = function (this: THREE.Material, shader: any) {
      calls.push(this)
      shader.fragmentShader = `${shader.fragmentShader ?? ''}// masked`
      shader.hostRan = true
    }
    mat.customProgramCacheKey = () => 'mask1'
    return { mat, calls }
  }

  it.each(['blinds', 'clothesline'])('%s: the merged clone still runs the original onBeforeCompile, defines, cache key and userData', (type) => {
    const { mat, calls } = masked()
    const mesh = createMeshApi(THREE, { quality: 'game', mergeParts: true, materials: { plain: mat, wood: mat, metal: mat, fabric: mat }, shadows: true })
    const spec = hh.build(type, { seed: 4 }, mesh.api)
    const res = mesh.finish(spec)
    const merged = Object.values(res.parts).find((g) => g.userData.merged)!
    expect(merged).toBeTruthy()
    const m = (merged.children[0] as THREE.Mesh).material as THREE.Material
    expect(m).not.toBe(mat)
    expect(m.defines).toMatchObject({ ROOM_MASK: '1' })
    expect(m.userData.mask).toBe(true)
    expect(m.customProgramCacheKey()).toMatch(/^mask1\|/)
    const shader: any = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '' }
    m.onBeforeCompile(shader, undefined as any)
    expect(shader.hostRan).toBe(true)
    expect(shader.fragmentShader).toContain('masked')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(m) // the hook runs against the clone it patches
    expect(shader.uniforms.batchQ ?? shader.uniforms.swayAxz).toBeTruthy() // and the batch patch is chained after it
  })

  it('materialFor picks the material per key and part, at the options and at finish (finish wins)', () => {
    const a = new THREE.MeshLambertMaterial({ vertexColors: true })
    const b = new THREE.MeshLambertMaterial({ vertexColors: true })
    const seen: Array<[string, string | null]> = []
    const mesh = createMeshApi(THREE, {
      quality: 'game',
      mergeParts: false,
      materialFor: (k, id) => {
        seen.push([k, id])
        return a
      },
    })
    const spec = hh.build('wardrobe', { seed: 1 }, mesh.api)
    const res = mesh.finish(spec)
    const meshes: THREE.Mesh[] = []
    res.group.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh))
    expect(meshes.every((x) => x.material === a)).toBe(true)
    expect(seen.some(([, id]) => id === null)).toBe(true)
    expect(seen.some(([, id]) => id !== null)).toBe(true)

    const m2 = createMeshApi(THREE, { quality: 'game', materialFor: () => a })
    const s2 = hh.build('wardrobe', { seed: 1 }, m2.api)
    const r2 = m2.finish(s2, { materialFor: () => b })
    const ms: THREE.Mesh[] = []
    r2.group.traverse((o) => (o as THREE.Mesh).isMesh && ms.push(o as THREE.Mesh))
    expect(ms.every((x) => x.material === b)).toBe(true)
  })

  it('slats given different materials per part are not mixed into one mesh', () => {
    const a = new THREE.MeshLambertMaterial({ vertexColors: true })
    const b = new THREE.MeshLambertMaterial({ vertexColors: true })
    const mesh = createMeshApi(THREE, { quality: 'game', mergeParts: true, materialFor: (_k, id) => (id && Number(/\d+$/.exec(id)?.[0]) % 2 ? a : b) })
    const spec = hh.build('blinds', { seed: 4 }, mesh.api)
    const res = mesh.finish(spec)
    const merged = res.parts['slat_1']
    expect(merged.children.length).toBeGreaterThanOrEqual(2)
  })
})
