import { cornersOf, createHousehold, createRecorder } from '@adatechnology/game-interactables-household'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createMeshApi } from '../src'

describe('real household objects', () => {
  it.each(['fridge', 'wardrobe', 'stove'])('%s: every part mesh sits where the recorder says (part frame contract)', (type) => {
    const hh = createHousehold({ region: 'br', locale: 'en' })
    const item = { seed: 3 }
    const rec = createRecorder()
    hh.build(type, item, rec.api)
    const mesh = createMeshApi(THREE)
    hh.build(type, item, mesh.api)
    const { group, parts } = mesh.finish()
    group.updateMatrixWorld(true)
    const ids = Object.keys(rec.parts)
    expect(ids.length).toBeGreaterThan(0)
    expect(Object.keys(parts).sort()).toEqual(ids.sort())
    for (const id of ids) {
      const part = rec.parts[id]
      const expected = new THREE.Box3()
      for (const p of part.primitives) for (const c of cornersOf(p)) expected.expandByPoint(new THREE.Vector3(c[0] + part.pivot[0], c[1] + part.pivot[1], c[2] + part.pivot[2]))
      const actual = new THREE.Box3().setFromObject(parts[id])
      // sphere / cone / tilted primitives may be tighter than their corner boxes, so compare the boxes with a tolerance
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(actual.min[axis], `${type}/${id} min ${axis}`).toBeGreaterThanOrEqual(expected.min[axis] - 0.01)
        expect(actual.max[axis], `${type}/${id} max ${axis}`).toBeLessThanOrEqual(expected.max[axis] + 0.01)
      }
      const c1 = actual.getCenter(new THREE.Vector3())
      const c2 = expected.getCenter(new THREE.Vector3())
      expect(c1.distanceTo(c2), `${type}/${id} centre`).toBeLessThan(0.05)
    }
  })

  it('the fridge door mesh bounding box equals the recorder bounds', () => {
    const hh = createHousehold({ region: 'br', locale: 'en' })
    const rec = createRecorder()
    hh.build('fridge', { seed: 1 }, rec.api)
    const mesh = createMeshApi(THREE)
    hh.build('fridge', { seed: 1 }, mesh.api)
    const { group, parts } = mesh.finish()
    group.updateMatrixWorld(true)
    const id = Object.keys(rec.parts).find((k) => /door/.test(k))!
    const part = rec.parts[id]
    const box = new THREE.Box3()
    for (const p of part.primitives) {
      if (p.kind !== 'box') continue // boxes are exact; cylinders and spheres are tighter than their corners
      for (const c of cornersOf(p)) box.expandByPoint(new THREE.Vector3(c[0] + part.pivot[0], c[1] + part.pivot[1], c[2] + part.pivot[2]))
    }
    const actual = new THREE.Box3().setFromObject(parts[id])
    for (let i = 0; i < 3; i++) {
      // the handle (a cylinder) may be slightly inside its corner box, so allow a few centimetres on the outer faces
      expect(Math.abs(actual.min.getComponent(i) - box.min.getComponent(i))).toBeLessThan(0.03)
      expect(Math.abs(actual.max.getComponent(i) - box.max.getComponent(i))).toBeLessThan(0.03)
    }
  })
})
