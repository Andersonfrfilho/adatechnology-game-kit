import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { hasWeaponModel, buildWeaponModelById } from '../src/models'
import { arsenal, setup, step, keyR } from './support/reload-room'

// When the support hand works a part (racks the slide, pulls the charging handle, pumps), the shooting hand keeps its hold: on the grip, closed, the finger off the trigger.
describe('the shooting hand while the support hand works the action', () => {
  const ACTIONS = ['pump_back', 'pump_forward', 'charging_handle_pull', 'charging_handle_release', 'slide_release']
  const ids = [...arsenal.weapons.values()]
    .filter((def) => def.action.kind === 'firearm' && hasWeaponModel(def.id))
    .filter((def) => ['pistol', 'rifle', 'p90', 'belt', 'pump', 'semi12'].includes(buildWeaponModelById(THREE, def.id)!.parts.family))
    .map((def) => def.id)

  it('the catalogue has them', () => expect(ids.length).toBeGreaterThan(60))

  it.each(ids)('%s: the shooting hand stays on the grip from the first sound of the action to the end of the reload', (id) => {
    const { room, last } = setup()
    room.setTool(id)
    step(room, 40)
    for (let n = 0; room.tool.ammo > 0 && n < 200; n++) {
      room.use()
      step(room, 12)
    }
    step(room, 180)
    if (room.tool.ammo !== 0) return
    const rest = last().targets!.R!.position.slice()
    const before = room.log.entries().length
    keyR()
    let frames = 0
    const away: number[] = []
    const grip: number[] = []
    const finger: number[] = []
    step(room, 60 * 12, () => {
      frames++
      const p = last().targets!.R!.position
      away.push(Math.hypot(p[0] - rest[0]!, p[1] - rest[1]!, p[2] - rest[2]!))
      grip.push(last().targets!.grip ?? 1)
      finger.push(last().triggerFinger ?? 0)
    })
    const entries = room.log.entries().slice(before)
    const t0 = entries[0]!.t
    const first = entries.find((entry) => entry.type === 'sound' && ACTIONS.includes((entry.data as { cue?: string }).cue ?? ''))
    if (!first) return
    const from = Math.max(0, Math.floor((first.t - t0) * 60))
    const reloadFrames = away.findIndex((_, i) => i > from && !room.tool.reloading) // unused: the window runs to the end of the sample
    expect(reloadFrames).toBeLessThan(frames)
    for (let i = from; i < frames; i++) {
      expect(away[i], `frame ${i}: the shooting hand is off the grip`).toBeLessThan(0.012)
      expect(grip[i], `frame ${i}: the hand is open`).toBeGreaterThanOrEqual(0.85)
      expect(finger[i]!, `frame ${i}: the finger is on the trigger`).toBeLessThan(0.55)
    }
  }, 60000)
})
