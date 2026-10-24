import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { checkToolClips, createToolClipPlayer } from '@adatechnology/game-contracts'
import type { AnimationPose } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import { buildToolClips } from '../src/animation/clip-set'
import { MODEL_ENTRIES, buildWeaponModelById } from '../src/models'
import { partRegistry } from '../src/models/part-registry'

const arsenal = createArsenal({ rules: { faults: false } })

const contextOf = (id: string) => {
  const model = buildWeaponModelById(THREE, id)
  const def = arsenal.weapons.get(id)
  if (!model || !def) throw new Error(`no model or def for ${id}`)
  const action = def.action
  const caliber = action.kind === 'firearm' ? arsenal.calibers.get(action.caliber) : undefined
  const reloadFamily = action.kind === 'firearm' || action.kind === 'flame' || action.kind === 'launcher' ? action.family : undefined
  return { model, def, context: { parts: model.parts, family: model.parts.family, caseType: caliber?.caseType ?? 'rifle', reloadFamily } as const }
}

describe('clips of the gallery models', () => {
  it('every weapon of the gallery has valid clips over the parts of its own model, and a shot, a reload and a draw', () => {
    const problems: string[] = []
    for (const id of Object.keys(MODEL_ENTRIES)) {
      const { model, context } = contextOf(id)
      const clips = buildToolClips(context)
      const report = checkToolClips(clips, partRegistry(model.parts).keys())
      problems.push(...report.problems.map((problem) => `${id}: ${problem}`))
      for (const needed of ['shot', 'reload', 'draw', 'empty', 'misfire', 'fault_misfire', 'clear_misfire']) if (!clips[needed]) problems.push(`${id}: no "${needed}" clip`)
    }
    expect(problems).toEqual([])
  })

  it('weapons with a manual action have a cycle clip as long as the rule\'s cycle, and the others have none', () => {
    const pump = contextOf('remington_870')
    expect(buildToolClips(pump.context).cycle?.duration).toBeCloseTo(pump.def.action.kind === 'firearm' ? (pump.def.action.timings?.cycle ?? 0) : 0, 5)
    const bolt = contextOf('remington_700')
    expect(buildToolClips(bolt.context).cycle?.duration).toBeCloseTo(0.82, 5)
    expect(buildToolClips(contextOf('glock_17').context).cycle).toBeUndefined()
  })

  it('the reload clips carry the stages of the rule at the fractions the rule puts them', () => {
    const { context } = contextOf('glock_17')
    const clips = buildToolClips(context)
    const stages = (id: string) => (clips[id]?.events ?? []).filter((event) => event.type === 'stage').map((event) => [event.data?.stage, Math.round((event.t / (clips[id]?.duration ?? 1)) * 1000) / 1000])
    expect(stages('reload')).toEqual([['magazine_out', 0], ['magazine_in', 0.549]])
    expect(stages('reload_empty').at(-1)).toEqual(['charge', 0.872])
  })

  it('a reload clip played over twice its time moves the magazine through the same positions', () => {
    const { model, context } = contextOf('glock_17')
    const clips = buildToolClips(context)
    const poses: AnimationPose[] = []
    const player = createToolClipPlayer({ clips, rig: { setPartPose: (id, pose) => id === 'mag' && poses.push(pose) } })
    player.apply({ type: 'play', clip: 'reload', duration: 1.64 })
    for (let frame = 0; frame < 100; frame++) player.update(0.02)
    const lowest = Math.min(...poses.map((pose) => pose.position?.[1] ?? 0))
    expect(lowest).toBeCloseTo(-(model.parts.magDrop ?? 0) * 2.2, 3)
    expect(poses.at(-1)?.position?.[1]).toBeCloseTo(0, 5)
  })
})
