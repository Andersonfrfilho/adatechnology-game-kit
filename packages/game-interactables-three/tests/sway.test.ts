import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { attachSway, createMeshApi, swayMaterial, syncObject } from '../src'
import type { World } from '@adatechnology/game-interactables'

const shaderStub = () => ({ uniforms: {} as Record<string, any>, vertexShader: 'void main() {\n#include <begin_vertex>\n}' })

describe('swayMaterial / attachSway', () => {
  it('patches the material, depth and distance materials with the same uniforms', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.1), new THREE.MeshStandardMaterial())
    const handle = attachSway(THREE, mesh, { amplitude: 0.1 })
    expect(mesh.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial)
    expect(mesh.customDistanceMaterial).toBeInstanceOf(THREE.MeshDistanceMaterial)
    expect(mesh.material).not.toBeInstanceOf(Array)
    expect((mesh.material as THREE.Material).userData.sway).toBe(handle)
    expect(handle.uniforms.anchorY.value).toBe(1) // top of the box

    const shaders = [mesh.material as THREE.Material, mesh.customDepthMaterial!, mesh.customDistanceMaterial!].map((m) => {
      const s = shaderStub()
      m.onBeforeCompile(s as any, null as any)
      return s
    })
    for (const s of shaders) {
      expect(s.vertexShader).toContain('swayHang')
      expect(s.vertexShader).toContain('uniform float swayAx;')
      expect(s.uniforms.swayAx).toBe(handle.uniforms.ax)
      expect(s.uniforms.swayTime).toBe(handle.uniforms.time)
      expect(s.uniforms.swayAz).toBe(handle.uniforms.az)
      expect(s.uniforms.swayAnchorY).toBe(handle.uniforms.anchorY)
    }
    // one set() moves all three at once
    handle.set(0.2, -0.3, 4)
    for (const s of shaders) {
      expect(s.uniforms.swayAx.value).toBe(0.2)
      expect(s.uniforms.swayAz.value).toBe(-0.3)
      expect(s.uniforms.swayTime.value).toBe(4)
    }
  })

  it('swayMaterial keeps the base untouched and exposes the shadow materials', () => {
    const base = new THREE.MeshLambertMaterial({ color: 0xff0000 })
    const m = swayMaterial(THREE, base)
    expect(m).not.toBe(base)
    expect((m as unknown as THREE.MeshLambertMaterial).color.getHex()).toBe(0xff0000)
    expect(base.onBeforeCompile.toString()).not.toContain('swayHang')
    expect(m.userData.depthMaterial.depthPacking).toBe(THREE.RGBADepthPacking)
  })
})

function fakeWorld(): World {
  const t: Record<string, number> = { door: 1 }
  return {
    get: () => ({
      id: 'o',
      transform: { x: 0, y: 0, z: 0, ry: 0 },
      parts: t,
      spec: {
        type: 'x',
        parts: [{ id: 'door', pivot: [1, 0, 0], motion: { kind: 'hinge', angle: Math.PI / 2 } }],
        soft: [{ id: 'cloth', kind: 'cloth', anchor: [0, 2, 0], size: [1, 1, 0.1] }],
      },
    }),
    partT: (_o: string, p: string) => t[p] ?? 0,
    sway: () => ({ ax: 0, az: 0.5 }),
  } as unknown as World
}

describe('syncObject', () => {
  it('poses parts from the world and rotates plain soft groups around the anchor', () => {
    const { api, finish } = createMeshApi(THREE)
    api.part('door', [1, 0, 0], 0, () => api.box({}, 'plain', 1, 0, 0, 0.1, 2, 1, 0xffffff, 0, 0, 0))
    api.part('cloth', [0, 2, 0], 0, () => api.box({}, 'fabric', 0, 1, 0, 1, 1, 0.1, 0xffffff, 0, 0, 0))
    const { parts } = finish()
    syncObject(THREE, fakeWorld(), 'o', parts)
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(parts.door.quaternion)
    expect(forward.z).toBeCloseTo(-1, 5) // quarter turn about y
    // cloth: pivot is the anchor, so it only turns (rotation about z by 0.5)
    expect(parts.cloth.position.toArray()).toEqual([0, 2, 0])
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(parts.cloth.quaternion)
    expect(down.x).toBeCloseTo(Math.sin(0.5), 5)
    // calling again does not accumulate
    syncObject(THREE, fakeWorld(), 'o', parts)
    const down2 = new THREE.Vector3(0, -1, 0).applyQuaternion(parts.cloth.quaternion)
    expect(down2.x).toBeCloseTo(Math.sin(0.5), 5)
  })

  it('drives shader sway through the uniforms when the cloth is attached', () => {
    const { api, finish } = createMeshApi(THREE)
    api.part('cloth', [0, 2, 0], 0, () => api.box({}, 'fabric', 0, 1, 0, 1, 1, 0.1, 0xffffff, 0, 0, 0))
    const { parts } = finish()
    const mesh = parts.cloth.children[0] as THREE.Mesh
    const handle = attachSway(THREE, mesh)
    syncObject(THREE, fakeWorld(), 'o', parts, { time: 3 })
    expect(handle.uniforms.az.value).toBe(0.5)
    expect(handle.uniforms.time.value).toBe(3)
    expect(parts.cloth.quaternion.w).toBe(1) // group itself untouched
  })
})
