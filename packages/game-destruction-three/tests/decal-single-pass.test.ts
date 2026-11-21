import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DecalKit } from '../src/visual'

const isTwoPass = (material: THREE.Material): boolean => material.transparent === true && material.side === THREE.DoubleSide && material.forceSinglePass === false

describe('the bullet-hole disc is drawn in one pass', () => {
  it('keeps the flag next to the properties that made three draw it twice', () => {
    const material = new DecalKit(THREE).discMaterial()
    expect(material.forceSinglePass).toBe(true)
    expect(material.transparent).toBe(true)
    expect(material.side).toBe(THREE.DoubleSide)
  })

  it('keeps the flag on the clone the renderer draws with', () => {
    const clone = new DecalKit(THREE).discMaterial().clone()
    expect(clone.forceSinglePass).toBe(true)
    expect(clone.transparent).toBe(true)
    expect(clone.side).toBe(THREE.DoubleSide)
  })

  it('is not a two-pass material by the rule three uses in renderObject', () => {
    const kit = new DecalKit(THREE)
    expect(isTwoPass(kit.discMaterial())).toBe(false)
    expect(isTwoPass(kit.discMaterial().clone())).toBe(false)
  })
})
