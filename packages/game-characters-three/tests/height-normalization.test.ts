import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { BODY_TYPE_IDS, GUIDE, HEIGHTS_BY_TYPE_METRES, InvalidHeightError, REFERENCE_HEIGHT_METRES, TEAM_GAME } from '@adatechnology/game-characters'
import undeadTypes from '../../game-characters-undead/src/data/types.json'

import { BAKE_NEUTRAL_POSE, PORT_DEVIATIONS, bakeBody, buildInstancedBody, createBestBuilder, createPersonBuilder } from '../src'
import type { BakeBuilders } from '../src'

const cards = undeadTypes.map((t) => ({ name: t.name['pt-BR'], eye: Number.parseInt(t.eye.color, 16) }))

const skullTopOfHeadGroup = (headG: THREE.Object3D): number => {
  const hd = headG.children[0]
  if (!hd) return Number.NaN
  for (const child of hd.children) {
    if (child instanceof THREE.Mesh && child.visible) {
      child.updateMatrixWorld(true)
      return new THREE.Box3().setFromObject(child).max.y
    }
  }
  return Number.NaN
}

describe('Spec 012 R1 — rich body height normalisation (±1 cm)', () => {
  it('records height normalisation deviations in PORT_DEVIATIONS', () => {
    const ids = PORT_DEVIATIONS.map((d) => d.id)
    expect(ids).toContain('spec-012-best-height-norm')
    expect(ids).toContain('spec-012-person-height-norm')
  })

  it('measures every Bestiário type and human within ±1 cm of declared heightMetres', () => {
    const best = createBestBuilder(THREE, { types: cards, random: () => 0.5 })
    for (const type of BODY_TYPE_IDS) {
      const isHuman = type === 'human'
      const root = best.build({
        type: isHuman ? 'Lento' : type,
        human: isHuman,
        seed: 4242,
        pose: { ...BAKE_NEUTRAL_POSE },
      })
      const rig = root.userData.rig as {
        fig: THREE.Object3D
        upper: THREE.Object3D
        headG: THREE.Object3D
        arms: { g: THREE.Object3D; el: THREE.Object3D }[]
        legs: { g: THREE.Object3D; kn: THREE.Object3D }[]
      }
      rig.fig.position.y = 0
      rig.upper.rotation.set(0, 0, 0)
      rig.headG.rotation.set(0, 0, 0)
      for (const arm of rig.arms) {
        arm.g.rotation.set(0, 0, 0)
        arm.el.rotation.set(0, 0, 0)
      }
      for (const leg of rig.legs) {
        leg.g.rotation.set(0, 0, 0)
        leg.kn.rotation.set(0, 0, 0)
      }
      root.updateMatrixWorld(true)
      const skullTop = skullTopOfHeadGroup(rig.headG)
      const expected = HEIGHTS_BY_TYPE_METRES[type]
      expect(Math.abs(skullTop - expected), `${type}: got ${skullTop.toFixed(4)} vs ${expected}`).toBeLessThanOrEqual(0.01)
    }
  })

  it('honours explicit heightMetres on Bestiário and rejects out-of-range heights', () => {
    const best = createBestBuilder(THREE, { types: cards, random: () => 0.5 })
    for (const target of [1.55, 1.8, 2.05]) {
      const root = best.build({ type: 'Lento', human: true, seed: 4242, heightMetres: target, pose: { ...BAKE_NEUTRAL_POSE } })
      const rig = root.userData.rig as { fig: THREE.Object3D; upper: THREE.Object3D; headG: THREE.Object3D }
      rig.fig.position.y = 0
      rig.upper.rotation.set(0, 0, 0)
      rig.headG.rotation.set(0, 0, 0)
      root.updateMatrixWorld(true)
      expect(Math.abs(skullTopOfHeadGroup(rig.headG) - target)).toBeLessThanOrEqual(0.01)
    }
    expect(() => best.build({ type: 'Lento', heightMetres: 0.3 })).toThrow(InvalidHeightError)
  })

  it('measures survivors (person-builder) within ±1 cm of declared heightMetres', () => {
    const pb = createPersonBuilder(THREE, { detail: 0 })
    const baseSpec = {
      skin: 0xd4a57a,
      hair: { c: 0x3b2a1e, s: 'short' },
      top: { c: 0x3d5a73 },
      pants: { c: 0x2c3340 },
      shoes: 0x222222,
    }
    const defaultChar = pb.build(baseSpec)
    defaultChar.root.updateMatrixWorld(true)
    expect(Math.abs(skullTopOfHeadGroup(defaultChar.headG) - REFERENCE_HEIGHT_METRES)).toBeLessThanOrEqual(0.01)

    for (const target of [1.4, 1.55, 1.8, 2.05]) {
      const ch = pb.build({ ...baseSpec, heightMetres: target })
      ch.root.updateMatrixWorld(true)
      expect(Math.abs(skullTopOfHeadGroup(ch.headG) - target)).toBeLessThanOrEqual(0.01)
    }
    expect(() => pb.build({ ...baseSpec, heightMetres: 4.5 })).toThrow(InvalidHeightError)
  })

  it('measures instanced body (TEAM_GAME and GUIDE, all LODs) within ±1 cm of declared heightMetres', () => {
    for (const bodySpec of [TEAM_GAME, GUIDE]) {
      for (const segments of [16, 10, 5]) {
        const geo = buildInstancedBody(THREE, { segments, body: bodySpec })
        const pos = geo.attributes.position!
        const bone = geo.attributes.bone!
        const vcol = geo.attributes.vcol!
        let skullMaxY = Number.NEGATIVE_INFINITY
        for (let i = 0; i < pos.count; i++) {
          // bone 1 (head) + material 0 (skin) excludes hair (material 4)
          if (bone.getX(i) === 1 && vcol.getW(i) === 0) {
            skullMaxY = Math.max(skullMaxY, pos.getY(i))
          }
        }
        expect(Math.abs(skullMaxY - bodySpec.heightMetres), `${bodySpec.id}/${segments}: got ${skullMaxY.toFixed(4)}`).toBeLessThanOrEqual(0.01)
        geo.dispose()
      }
    }
  })

  it('measures baked body (bakeBody, all undead types) within ±1 cm of declared heightMetres (skull vertices)', () => {
    const best = createBestBuilder(THREE, { types: cards, random: () => 0.5 })
    const builders: BakeBuilders = {
      buildBest: (spec, lod) => {
        best.setLOD(lod)
        return best.build(spec)
      },
      topMaterial: () => best.topM(),
    }
    for (const type of BODY_TYPE_IDS) {
      if (type === 'human') continue
      const baked = bakeBody(THREE, builders, { type, decay: 0, seed: 4242, hs: 'bald' }, 1)
      const pos = baked.geo.attributes.position!
      const bone = baked.geo.attributes.bone!
      let headMaxY = Number.NEGATIVE_INFINITY
      for (let i = 0; i < pos.count; i++) {
        if (bone.getX(i) === 1) headMaxY = Math.max(headMaxY, pos.getY(i))
      }
      const expected = HEIGHTS_BY_TYPE_METRES[type]
      expect(Math.abs(headMaxY - expected), `baked ${type}: got ${headMaxY.toFixed(4)} vs ${expected}`).toBeLessThanOrEqual(0.01)
      baked.geo.dispose()
    }
  })
})
