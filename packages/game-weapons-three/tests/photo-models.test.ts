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

  it('is finished in polished steel like the photo: the slide is bright and glossy', () => {
    let slide: THREE.MeshStandardMaterial | undefined
    model.parts.slide!.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!slide && mesh.isMesh) slide = mesh.material as THREE.MeshStandardMaterial
    })
    expect(slide!.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(0.55)
    expect(slide!.roughness).toBeLessThan(0.25)
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

describe('the Kalashnikovs with the wedge stock of their photos', () => {
  it.each(['ak_47', 'akm', 'rpk'])('%s: the stock drops from the receiver to a butt about 12 cm tall', (weapon) => {
    const model = buildWeaponModelById(THREE, weapon)!
    const stock = new THREE.Box3()
    for (const mesh of model.parts.stockMeshes ?? []) stock.union(new THREE.Box3().setFromObject(mesh))
    const receiver = new THREE.Box3().setFromObject(model.parts.bolt!)
    expect(stock.max.y - stock.min.y).toBeGreaterThan(0.11)
    expect(stock.min.y).toBeLessThan(receiver.min.y - 0.08)
  })
})

describe('the Kalashnikovs with the stamped receiver and the banana magazine of their photos', () => {
  it.each(['ak_47', 'akm', 'rpk', 'ak_74', 'aks_74u'])('%s: the magazine is one curved solid that bends forward, and the receiver stays low', (weapon) => {
    const model = buildWeaponModelById(THREE, weapon)!
    const meshes = model.parts.mag!.children.filter((child) => (child as THREE.Mesh).isMesh)
    expect(meshes.length).toBeLessThan(6)
    const box = new THREE.Box3().setFromObject(model.parts.mag!)
    const top = model.parts.mag!.getWorldPosition(new THREE.Vector3())
    // the foot of the magazine is well ahead of its top: the AK's forward curve
    expect(box.max.x - top.x).toBeGreaterThan(0.05)
    expect(top.y - box.min.y).toBeGreaterThan(0.15)
    const receiver = new THREE.Box3().setFromObject(model.parts.bolt!)
    expect(receiver.max.y).toBeLessThan(0.04)
  })

  it('gives the RPK the longer 40-round magazine', () => {
    const height = (weapon: string): number => {
      const magazine = buildWeaponModelById(THREE, weapon)!.parts.mag!
      return new THREE.Box3().setFromObject(magazine).getSize(new THREE.Vector3()).y
    }
    expect(height('rpk')).toBeGreaterThan(height('akm') + 0.04)
  })
})
