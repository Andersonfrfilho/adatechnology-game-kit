import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createArsenal } from '@adatechnology/game-weapons'
import { buildWeaponModelById, fitAttachmentModels, mountFrame, rigUnderbarrel } from '../src'
import { modelKit } from '../src/models/kit'

const arsenal = createArsenal({ rules: { faults: false } })
const kit = modelKit(THREE)

// each launcher and the rifles the arsenal lets carry it
const HOSTS: Readonly<Record<string, readonly string[]>> = { m203: ['colt_m4a1', 'colt_m16a2'], gp_25: ['ak_47', 'akm', 'ak_74', 'ak_12'], ag36: ['hk416'] }

const fitted = (launcher: string, host: string): { box: THREE.Box3; muzzle: THREE.Vector3; frame: readonly [number, number, number] } => {
  const model = buildWeaponModelById(THREE, host)!
  const def = arsenal.weapons.get(host)!
  rigUnderbarrel(THREE, model, def)
  fitAttachmentModels(model, [{ id: launcher, mount: 'underbarrel' }], kit, { catalogue: arsenal.attachments })
  model.root.updateMatrixWorld(true)
  const box = new THREE.Box3()
  for (const child of model.root.children) if (child !== model.inner) box.union(new THREE.Box3().setFromObject(child))
  return { box, muzzle: model.parts.uglMuzzle!.getWorldPosition(new THREE.Vector3()), frame: mountFrame(model, 'underbarrel')!.position }
}

describe('the launchers under the barrel drawn from their photos', () => {
  for (const [launcher, hosts] of Object.entries(HOSTS)) {
    it.each(hosts)(`${launcher} under %s: clamped up to the handguard, as long as the real one, its muzzle at the front of its tube`, (host) => {
      const { box, muzzle, frame } = fitted(launcher, host)
      const length = arsenal.attachments.get(launcher)!.dims!.length!
      expect(box.max.y).toBeGreaterThan(frame[1] + 0.017)
      expect(box.max.x - box.min.x).toBeGreaterThan(length - 0.03)
      expect(box.max.x - box.min.x).toBeLessThan(length + 0.03)
      expect(muzzle.x).toBeGreaterThan(box.max.x - 0.02)
    })
  }

  it('gives the GP-25 and the AG36 a pistol grip of their own that the M203 does not have', () => {
    const depth = (launcher: string, host: string): number => {
      const { box, frame } = fitted(launcher, host)
      return frame[1] - box.min.y
    }
    expect(depth('gp_25', 'ak_47')).toBeGreaterThan(0.12)
    expect(depth('ag36', 'hk416')).toBeGreaterThan(0.14)
    expect(depth('m203', 'colt_m4a1')).toBeLessThan(0.1)
  })
})
