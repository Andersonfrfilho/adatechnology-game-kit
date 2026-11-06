import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildWeaponModelById } from '../src'

const sizeOf = (object: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())

describe('the Desert Eagle Mark XIX drawn from its photo', () => {
  const model = buildWeaponModelById(THREE, 'desert_eagle_mark_xix')!

  it('is 270 mm long and about 150 mm tall, with the pistol anchors the hands and the reload use', () => {
    const size = sizeOf(model.root)
    expect(size.x).toBeCloseTo(0.27, 2)
    expect(size.y).toBeGreaterThan(0.13)
    expect(size.y).toBeLessThan(0.17)
    expect(model.parts.slide && model.parts.grip && model.parts.mag && model.parts.trigger && model.parts.hammer && model.parts.muzzle && model.parts.eject).toBeTruthy()
  })

  it('keeps the barrel block fixed ahead of a slide that only covers the rear half, the muzzle at the front', () => {
    const slide = new THREE.Box3().setFromObject(model.parts.slide!)
    const whole = new THREE.Box3().setFromObject(model.root)
    expect(slide.max.x).toBeLessThan(whole.min.x + (whole.max.x - whole.min.x) * 0.62)
    const muzzle = model.parts.muzzle!.getWorldPosition(new THREE.Vector3())
    expect(muzzle.x).toBeGreaterThan(whole.max.x - 0.01)
  })
})

describe('the SVD Dragunov drawn from its photo', () => {
  const model = buildWeaponModelById(THREE, 'svd_dragunov')!

  it('is 1225 mm long and its stock has the thumbhole: a ray across the stock behind the grip passes through nothing', () => {
    expect(sizeOf(model.root).x).toBeCloseTo(1.225, 2)
    const stock = model.parts.stockMeshes ?? []
    expect(stock.length).toBeGreaterThan(0)
    model.root.updateMatrixWorld(true)
    const scale = model.inner.scale.x
    const across = (x: number, y: number): number => new THREE.Raycaster(new THREE.Vector3(model.inner.position.x + x * scale, y, 1), new THREE.Vector3(0, 0, -1)).intersectObjects(stock, false).length
    expect(across(0.22, -0.055)).toBe(0)
    expect(across(0.22, 0.005)).toBeGreaterThan(0)
    expect(across(0.22, -0.11)).toBeGreaterThan(0)
  })
})

describe('the bolt-action rifles with the sporter stock of their photos', () => {
  it.each(['remington_700', 'remington_700_300wm', 'hunting_rifle_30_06', 'm24_sws', 'steyr_ssg_69'])('%s: the butt drops below the comb, so the stock is no longer a straight bar on a block', (weapon) => {
    const model = buildWeaponModelById(THREE, weapon)!
    model.root.updateMatrixWorld(true)
    const scale = model.inner.scale.x
    // the height of the weapon at x (in the builder's metres): the top seen from above to the bottom seen from below
    const heightAt = (from: number, to: number): number => {
      const x = model.inner.position.x + ((from + to) / 2) * scale
      const down = new THREE.Raycaster(new THREE.Vector3(x, 1, 0), new THREE.Vector3(0, -1, 0)).intersectObject(model.inner, true)[0]
      const up = new THREE.Raycaster(new THREE.Vector3(x, -1, 0), new THREE.Vector3(0, 1, 0)).intersectObject(model.inner, true)[0]
      return down && up ? down.point.y - up.point.y : 0
    }
    // the butt is taller than the wrist, the wrist is the narrow waist of the stock
    expect(heightAt(0, 0.04)).toBeGreaterThan(0.12)
    expect(heightAt(0.17, 0.21)).toBeLessThan(0.1)
  })
})
