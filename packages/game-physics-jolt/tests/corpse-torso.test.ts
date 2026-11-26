import { describe, expect, it } from 'vitest'

import type { Quat } from '@adatechnology/game-physics'

import { kit, sceneOf, seconds } from './lod-scenes'

const FLAT: Quat = [Math.SQRT1_2, 0, 0, Math.SQRT1_2]
const MARK = -7

describe('readTorso writes straight into `out` (review of PR 521, item 9)', () => {
  it('on every rung it writes the 7 numbers at the offset and nothing around them', { timeout: 60000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 1 } })
    scene.corpses.add({ id: 1, kit, position: [-12, 0.05, 0], yaw: 0 })
    scene.corpses.add({ id: 2, kit, position: [-6, 0.05, 0], yaw: 0 })
    scene.corpses.addLying({ id: 3, kit, torso: { position: [0, 0.17, 0], rotation: FLAT }, rung: 'r2' })
    scene.corpses.addLying({ id: 4, kit, torso: { position: [6, 0.17, 0], rotation: FLAT }, rung: 'r2' })
    scene.corpses.changeRung(4, 'r2f')
    scene.corpses.addLying({ id: 5, kit, torso: { position: [12, 0.17, 0], rotation: FLAT }, rung: 'r2' })
    seconds(scene.loop, 4)
    // asked for now, so the policy has not yet brought it back from nothing to the nearby rung
    scene.corpses.changeRung(5, 'r3')
    const pose = new Float64Array(7)
    for (const [id, rung] of [[1, 'r0'], [2, 'r1'], [3, 'r2'], [4, 'r2f'], [5, 'r3']] as const) {
      expect(scene.corpses.rungOf(id)).toBe(rung)
      for (const out of [new Float64Array(11).fill(MARK), new Float32Array(11).fill(MARK)]) {
        expect(scene.corpses.readTorso(id, out, 2)).toBe(true)
        expect([...out.slice(0, 2)], rung).toEqual([MARK, MARK])
        expect([...out.slice(9)], rung).toEqual([MARK, MARK])
        const quaternionLength = Math.hypot(out[5] as number, out[6] as number, out[7] as number, out[8] as number)
        expect(quaternionLength, rung).toBeCloseTo(1, 4)
      }
    }
    // the chain's torso is the pose of its first body; the stored ones are what was laid
    const out = new Float64Array(7)
    scene.corpses.readTorso(2, out, 0)
    scene.world.readPose(scene.corpses.partsOf(2)[0] as never, pose, 0)
    expect([...out]).toEqual([...pose])
    scene.corpses.readTorso(5, out, 0)
    ;[12, 0.17, 0, ...FLAT].forEach((value, index) => expect(out[index]).toBeCloseTo(value, 2))
    expect(scene.corpses.readTorso(99, out, 0)).toBe(false)
    scene.world.dispose()
  })
})
