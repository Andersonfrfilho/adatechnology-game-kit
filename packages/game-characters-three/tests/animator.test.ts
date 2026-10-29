import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { installPortableMath } from '@adatechnology/golden-tool'

import { createBestBuilder, createRigAnimator } from '../src'
import type { RichRig } from '../src'
import golden from './fixtures/team-golden/bestiary-gait.json'
import undeadTypes from '../../game-characters-undead/src/data/types.json'

// Recorded from the Bestiário page (animate0, the page's own code): 13 types x t = 0 .. 2 s, the joint rotations left on a body built with
// { decay: 0, seed: 5, phase: 0.7 }. The animator writes the numbers of the engine's gait onto the same rig and has to leave the same ones.
const gaits = Object.fromEntries(undeadTypes.map((type) => [type.name['pt-BR'], type.gait])) as never
const round4 = (value: number): number => Math.round(value * 1e4) / 1e4
const rotation = (object: THREE.Object3D | { rotation: { x: number; y: number; z: number } }): number[] => [object.rotation.x, object.rotation.y, object.rotation.z].map(round4)

type PoseEvent = { type: string; data: { type: string; time: number; hipY: number; upper: number[]; head: number[]; arms: number[][]; legs: number[][] } }

describe('G-gait (Chrome): the Bestiário animate0 on the rich rig', () => {
  const restore = installPortableMath()
  const best = createBestBuilder(THREE, { types: undeadTypes.map((type) => ({ name: type.name['pt-BR'], eye: Number.parseInt(type.eye.color, 16) })), random: () => 0.5 })
  const animator = createRigAnimator({ gaits })
  const names = new Map(undeadTypes.map((type) => [type.id, type.name['pt-BR']]))
  const events = (golden.events as unknown as PoseEvent[]).filter((event) => event.type === 'pose')

  it('has the 117 recorded poses', () => {
    expect(events).toHaveLength(117)
  })

  it('leaves the same joint rotations as the page, to 4 decimals, for every type and time', () => {
    const bodies = new Map<string, THREE.Object3D>()
    const mismatches: string[] = []
    for (const { data } of events) {
      let body = bodies.get(data.type)
      if (!body) {
        body = best.build({ type: names.get(data.type), decay: 0, seed: 5, phase: 0.7 }) as THREE.Object3D
        bodies.set(data.type, body)
      }
      const rig = body.userData.rig as RichRig
      animator.animate0(body, data.time)
      const actual = {
        hipY: round4(rig.fig.position.y),
        upper: rotation(rig.upper),
        head: rotation(rig.headG),
        arms: rig.arms.map((arm) => [round4(arm.g.rotation.x), round4(arm.el.rotation.x)]),
        legs: rig.legs.map((leg) => (leg.lost ? [0, 0] : [round4(leg.g.rotation.x), round4(leg.kn.rotation.x)])),
      }
      const { type: _type, time: _time, ...expected } = data
      if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push(`${data.type}@${data.time}`)
    }
    restore()
    expect(mismatches).toEqual([])
  })
})

describe('cascade, setPose and the loose bits', () => {
  const best = createBestBuilder(THREE, { types: [{ name: 'Lento', eye: 0xff0000 }], random: () => 0.5 })
  const animator = createRigAnimator()

  it('the first cascade call only records the joints; later calls move each a fraction of the way to what the animation left', () => {
    const body = best.build({ type: 'Lento', decay: 1, seed: 3, phase: 0 }) as THREE.Object3D
    const rig = body.userData.rig as RichRig
    animator.animate0(body, 0)
    animator.cascade(rig, 0.016)
    const before = rig.arms[0]!.g.rotation.x
    animator.setPose(rig, { armR: before + 1 })
    animator.cascade(rig, 0.1)
    expect(rig.arms[0]!.g.rotation.x).toBeCloseTo(before + 0.9 * 1, 6)
  })

  it('setPose names the joints it moves and leaves the rest', () => {
    const body = best.build({ type: 'Lento', decay: 0, seed: 1, phase: 0 }) as THREE.Object3D
    const rig = body.userData.rig as RichRig
    const knee = rig.legs[1]!.kn.rotation.x
    animator.setPose(rig, { lean: 0.5, drop: -0.1, kneeL: 1.2 })
    expect(rig.upper.rotation.x).toBe(0.5)
    expect(rig.fig.position.y).toBeCloseTo(rig.dropBase - 0.1, 12)
    expect(rig.legs[0]!.kn.rotation.x).toBe(1.2)
    expect(rig.legs[1]!.kn.rotation.x).toBe(knee)
  })

  it('without a rig it does nothing; lerpPose starts a missing joint at its target', () => {
    const empty = new THREE.Group()
    expect(animator.animate0(empty, 1)).toBeUndefined()
    expect(animator.lerpPose({ lean: 0 }, { lean: 1, headX: 2 }, 0.5)).toEqual({ lean: 0.5, headX: 2 })
  })
})
