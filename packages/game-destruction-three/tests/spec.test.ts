import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

const hasCore = existsSync(fileURLToPath(new URL('../../game-destruction/dist/index.js', import.meta.url)))

function stool(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'stool'
  const wood = new THREE.MeshStandardMaterial({ name: 'wood_planks' })
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), wood)
  seat.name = 'wood_seat'
  seat.position.y = 0.45
  g.add(seat)
  const legs: THREE.Mesh[] = []
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.425, 0.05), wood)
    leg.name = `wood_leg_${i + 1}`
    leg.position.set(i % 2 ? 0.2 : -0.2, 0.2125, i < 2 ? 0.2 : -0.2)
    legs.push(leg)
    g.add(leg)
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.01, 0.4), new THREE.MeshStandardMaterial({ name: 'glass' }))
  top.name = 'glass_top'
  top.position.y = 0.48
  g.add(top)
  g.position.set(3, 0, 2) // root space must not care about where the group is
  g.updateMatrixWorld(true)
  return g
}

describe.skipIf(!hasCore)('specFromObject3D', () => {
  it('turns a small group into parts, materials and joints', async () => {
    const { specFromObject3D } = await import('../src/spec')
    const g = stool()
    const { spec, parts } = specFromObject3D(THREE, g, { name: 'stool', tags: ['furniture'] })
    expect(spec.name).toBe('stool')
    expect(spec.tags).toEqual(['furniture'])
    expect(spec.parts.map((p) => p.id)).toEqual(['wood_seat', 'wood_leg_1', 'wood_leg_2', 'wood_leg_3', 'wood_leg_4', 'glass_top'])
    const byId = Object.fromEntries(spec.parts.map((p) => [p.id, p]))
    expect(byId.glass_top.material).toBe('glass')
    expect(byId.wood_leg_1.material).toMatch(/wood/)
    expect(byId.wood_seat.material).toMatch(/wood/)
    expect(byId.wood_seat.shape).toEqual({ kind: 'box', size: [0.5, 0.05, 0.5].map((v) => expect.closeTo(v, 5)) })
    expect(byId.wood_seat.position[1]).toBeCloseTo(0.45, 5)
    expect(byId.wood_leg_1.position[0]).toBeCloseTo(-0.2, 5)
    // 4 legs touch the seat, and the top sits on it
    expect(spec.joints?.length).toBeGreaterThanOrEqual(5)
    for (const j of spec.joints ?? []) {
      expect(byId[j.a]).toBeDefined()
      expect(byId[j.b]).toBeDefined()
    }
    expect(Object.keys(parts)).toHaveLength(6)
    expect(parts.glass_top).toEqual([g.getObjectByName('glass_top')])
  })

  it('honours userData, ignore, minSize merging, anchors and joints:false', async () => {
    const { specFromObject3D } = await import('../src/spec')
    const g = new THREE.Group()
    const mk = (name: string, size: [number, number, number], pos: [number, number, number], ud: Record<string, unknown> = {}) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial())
      m.name = name
      m.position.set(...pos)
      Object.assign(m.userData, ud)
      g.add(m)
      return m
    }
    const body = mk('Body Panel', [1, 0.005, 1], [0, 0.5, 0], { destructionMaterial: 'steel' })
    mk('screw', [0.01, 0.01, 0.01], [0.2, 0.5, 0])
    mk('hidden', [1, 1, 1], [5, 5, 5], { destructionIgnore: true })
    const invisible = mk('ghost', [1, 1, 1], [9, 9, 9])
    invisible.visible = false
    const a = mk('a', [0.2, 0.2, 0.2], [2, 0.1, 0], { destructionPart: 'handle' })
    const b = mk('b', [0.2, 0.2, 0.2], [2.2, 0.1, 0], { destructionPart: 'handle' })
    const shell = mk('shell', [0.3, 0.3, 0.3], [4, 0.15, 0], { hollow: true })
    g.updateMatrixWorld(true)
    const r = specFromObject3D(THREE, g, { anchorBelow: 0.01, joints: false })
    const ids = r.spec.parts.map((p) => p.id)
    expect(ids).toEqual(['body_panel', 'handle', 'shell'])
    expect(r.parts.body_panel).toEqual([body, g.children[1]])
    expect(r.parts.handle).toEqual([a, b])
    const panel = r.spec.parts[0]
    expect(panel.material).toBe('steel')
    expect(panel.thickness).toBeCloseTo(0.005, 5) // thin metal keeps fill 1 and sets the thickness
    expect(panel.fill).toBe(1)
    expect(r.spec.parts[1].shape).toEqual({ kind: 'box', size: [expect.closeTo(0.4, 5), expect.closeTo(0.2, 5), expect.closeTo(0.2, 5)] })
    expect(r.spec.parts[2].fill).toBe(0.05)
    expect(shell.userData).toBeDefined()
    expect(r.spec.parts[1].anchored).toBe(true)
    expect(r.spec.parts[0].anchored).toBeUndefined()
    expect(r.spec.joints).toEqual([])
  })
})
