import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { defaultLodSettings } from '../src'
import { makeKit } from './helpers/kit'

/* the builds are long synchronous loops: let the worker report between tests */
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

function triangles(root: any): number {
  let n = 0
  root.traverse((o: any) => {
    if (o.isMesh && o.geometry) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3
  })
  return n
}

describe('light mode', () => {
  const kit = makeKit()
  const key = kit.fleet[0].key

  it('starts off, with the defaults of the team, and every number can be overridden', () => {
    expect(kit.lod).toMatchObject({ ...defaultLodSettings })
    expect(makeKit({ lod: { gridFactor: 4, minStations: 10 } }).lod).toMatchObject({ gridFactor: 4, minStations: 10, on: false })
  })

  it('draws the same vehicle with far fewer triangles and puts the switch back', () => {
    const full = triangles(kit.build(key, 'intact').root)
    const lite = triangles(kit.build(key, 'intact', undefined, { lod: true }).root)
    expect(lite).toBeLessThan(full * 0.6)
    expect(kit.lod.on).toBe(false)
    expect(triangles(kit.build(key, 'intact').root)).toBe(full)
  })

  it('tags the interior meshes of a light build and leaves the full build untagged', () => {
    const tagged = (root: any): number => {
      let n = 0
      root.traverse((o: any) => {
        if (o.userData && o.userData.skipLite) n++
      })
      return n
    }
    expect(tagged(kit.build(key, 'intact').root)).toBe(0)
    expect(tagged(kit.build(key, 'intact', undefined, { lod: true }).root)).toBeGreaterThan(0)
  })

  it('gives the three.js generators fewer segments only while on', () => {
    const k = makeKit({}, false)
    expect(new k.THREE.CylinderGeometry(1, 1, 1, 24, 3).parameters.radialSegments).toBe(24)
    k.lod.on = true
    const cylinder = new k.THREE.CylinderGeometry(1, 1, 1, 24, 3)
    expect(cylinder.parameters.radialSegments).toBe(12)
    expect(cylinder.parameters.heightSegments).toBe(1)
    expect(new k.THREE.SphereGeometry(1, 8, 8).parameters.widthSegments).toBe(8)
    expect(new k.THREE.CylinderGeometry(1, 1, 1, 24) instanceof THREE.CylinderGeometry).toBe(true)
  })
})

describe('damageables', () => {
  const kit = makeKit()
  const key = kit.fleet[0].key

  it('lists the metal, glass, rubber and fuel parts as boxes, in the frame of the matrix when given', () => {
    const c = kit.build(key, 'intact')
    const list = kit.damageables(c)
    expect(list.length).toBeGreaterThan(0)
    for (const d of list) {
      expect(['metal', 'glass', 'rubber', 'fuel']).toContain(d.material)
      expect(['center', 'left', 'right']).toContain(d.side)
      expect(d.box.isBox3).toBe(true)
    }
    expect(new Set(list.map((d) => d.part)).size).toBeGreaterThan(1)
    const moved = kit.damageables(c, new THREE.Matrix4().makeTranslation(10, 0, 0))
    expect(moved[0].box.min.x).toBeCloseTo(list[0].box.min.x + 10, 6)
  })

  it('lets a game add a kind', () => {
    kit.damageableKinds['panel:hood'] = { material: 'metal', part: 'hood' }
    expect(kit.damageableKinds['panel:hood'].part).toBe('hood')
  })
})
