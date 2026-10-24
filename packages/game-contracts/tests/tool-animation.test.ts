import { describe, expect, it } from 'vitest'
import { STAGE_EVENT, TOOL_CLIP, checkToolClips, createToolClipPlayer, sampleClip, scaleClip, toolAnimationStep } from '../src'
import type { AnimationClipSpec, AnimationEventSpec, AnimationPose, HostEvent, ToolRig } from '../src'

const reload: AnimationClipSpec = {
  id: 'reload',
  duration: 1,
  keys: [
    { t: 0 },
    { t: 0.5, parts: { mag: { position: [0, -0.1, 0] } } },
    { t: 1, parts: { mag: { position: [0, 0, 0] } } },
  ],
  events: [
    { t: 0.5, type: STAGE_EVENT, data: { stage: 'magazine_in' } },
    { t: 0.9, type: 'sound', data: { name: 'click' } },
  ],
}

const recordingRig = (): { rig: ToolRig; poses: Map<string, AnimationPose> } => {
  const poses = new Map<string, AnimationPose>()
  return { poses, rig: { setPartPose: (id, pose) => void poses.set(id, pose) } }
}

describe('toolAnimationStep', () => {
  const step = (event: HostEvent) => toolAnimationStep(event)

  it('maps each event of the tool cycle to a move, with the duration the rule gave', () => {
    expect(step({ type: 'tool', weapon: 'w', duration: 0.35 })).toEqual({ type: 'play', clip: TOOL_CLIP.DRAW, duration: 0.35 })
    expect(step({ type: 'shot', weapon: 'w', shots: 1, recoil: [0, 0], rounds: 3 })).toEqual({ type: 'play', clip: TOOL_CLIP.SHOT, repeat: 3 })
    expect(step({ type: 'misfire', weapon: 'w' })).toEqual({ type: 'play', clip: TOOL_CLIP.MISFIRE })
    expect(step({ type: 'reload', weapon: 'w', phase: 'start', kind: 'empty', duration: 2.5 })).toEqual({ type: 'play', clip: TOOL_CLIP.RELOAD, variant: 'empty', duration: 2.5 })
    expect(step({ type: 'reload', weapon: 'w', phase: 'end' })).toEqual({ type: 'finish', clip: TOOL_CLIP.RELOAD })
    expect(step({ type: 'cycle', weapon: 'w', phase: 'start', duration: 0.5 })).toEqual({ type: 'play', clip: TOOL_CLIP.CYCLE, duration: 0.5 })
    expect(step({ type: 'stage', weapon: 'w', stage: 'charge' })).toEqual({ type: 'sync', stage: 'charge' })
    expect(step({ type: 'feed', weapon: 'w' })).toEqual({ type: 'play', clip: TOOL_CLIP.FEED })
    expect(step({ type: 'clear', weapon: 'w', fault: 'stovepipe', phase: 'start', duration: 1.2 })).toEqual({ type: 'play', clip: TOOL_CLIP.CLEAR, variant: 'stovepipe', duration: 1.2 })
    expect(step({ type: 'safety', weapon: 'w', on: true })).toEqual({ type: 'play', clip: TOOL_CLIP.SAFETY_ON })
    expect(step({ type: 'safety', weapon: 'w', on: false })).toEqual({ type: 'play', clip: TOOL_CLIP.SAFETY_OFF })
  })
})

describe('scaleClip and sampleClip', () => {
  it('scales keys and events to the duration of the rule', () => {
    const scaled = scaleClip(reload, 2)
    expect(scaled.duration).toBe(2)
    expect(scaled.keys.map((key) => key.t)).toEqual([0, 1, 2])
    expect(scaled.events?.map((event) => event.t)).toEqual([1, 1.8])
  })

  it('scales a clip of no duration without making the times NaN', () => {
    const scaled = scaleClip({ id: 'still', duration: 0, keys: [{ t: 0 }] }, 0.5)
    expect(scaled.keys.map((key) => key.t)).toEqual([0])
  })

  it('interpolates linearly, rests where a key names nothing and holds the last pose', () => {
    expect(sampleClip(reload, 'mag', 0.25).position).toEqual([0, -0.05, 0])
    expect(sampleClip(reload, 'mag', 2).position).toEqual([0, 0, 0])
    expect(sampleClip(reload, 'slide', 0.5).position).toEqual([0, 0, 0])
  })
})

describe('createToolClipPlayer', () => {
  it('plays a clip over the duration the rule gives and fires its events when their time passes', () => {
    const { rig, poses } = recordingRig()
    const events: string[] = []
    const player = createToolClipPlayer({ clips: { reload }, rig, onEvent: (event: AnimationEventSpec) => events.push(event.type) })
    player.apply({ type: 'play', clip: TOOL_CLIP.RELOAD, duration: 2 })
    player.update(1)
    expect(poses.get('mag')?.position).toEqual([0, -0.1, 0])
    expect(events).toEqual([STAGE_EVENT])
    player.update(1)
    expect(events).toEqual([STAGE_EVENT, 'sound'])
    expect(poses.get('mag')?.position).toEqual([0, 0, 0])
    expect(player.playing).toEqual([])
  })

  it('picks the variant clip when the tool has it and falls back to the plain clip', () => {
    const { rig } = recordingRig()
    const clips = { reload, reload_empty: { ...reload, id: 'reload_empty', duration: 2, keys: [{ t: 0 }, { t: 2 }], events: [] } }
    const player = createToolClipPlayer({ clips, rig })
    player.apply({ type: 'play', clip: TOOL_CLIP.RELOAD, variant: 'empty' })
    expect(player.playing).toEqual(['reload_empty'])
    player.apply({ type: 'play', clip: TOOL_CLIP.RELOAD, variant: 'tactical' })
    expect(player.playing).toEqual(['reload_empty', 'reload'])
  })

  it('moves the clip to the marker a stage reaches and finishes it when the rule ends the phase', () => {
    const { rig, poses } = recordingRig()
    const player = createToolClipPlayer({ clips: { reload }, rig })
    player.apply({ type: 'play', clip: TOOL_CLIP.RELOAD })
    player.apply({ type: 'sync', stage: 'magazine_in' })
    player.update(0)
    expect(poses.get('mag')?.position).toEqual([0, -0.1, 0])
    player.apply({ type: 'finish', clip: TOOL_CLIP.RELOAD })
    player.update(0.01)
    expect(poses.get('mag')?.position).toEqual([0, 0, 0])
    expect(player.playing).toEqual([])
  })

  it('spaces the rounds of a repeat by the interval and ignores a clip the tool does not have', () => {
    const { rig } = recordingRig()
    const shot: AnimationClipSpec = { id: 'shot', duration: 0.05, keys: [{ t: 0 }, { t: 0.05 }], events: [{ t: 0, type: 'muzzle_flash' }] }
    const events: string[] = []
    const player = createToolClipPlayer({ clips: { shot }, rig, repeatInterval: () => 0.1, onEvent: (event) => events.push(event.type) })
    player.apply({ type: 'play', clip: TOOL_CLIP.SHOT, repeat: 3 })
    for (let frame = 0; frame < 30; frame++) player.update(0.01)
    expect(events).toEqual(['muzzle_flash', 'muzzle_flash', 'muzzle_flash'])
    player.apply({ type: 'play', clip: TOOL_CLIP.CLEAR })
    expect(player.playing).toEqual([])
  })

  it('a repeated round that leaves its delay in the middle of a frame starts with the rest of that frame, whatever the frame step', () => {
    const rise: AnimationClipSpec = { id: 'shot', duration: 1, keys: [{ t: 0 }, { t: 1, parts: { mag: { position: [0, 1, 0] } } }] }
    const pose = (steps: number[]): number => {
      const { rig, poses } = recordingRig()
      const player = createToolClipPlayer({ clips: { shot: rise }, rig, repeatInterval: () => 0.1 })
      player.apply({ type: 'play', clip: TOOL_CLIP.SHOT, repeat: 2 })
      for (const dt of steps) player.update(dt)
      return poses.get('mag')?.position[1] ?? -1
    }
    expect(pose([0.25])).toBeCloseTo(0.15, 9)
    expect(pose([0.05, 0.2])).toBeCloseTo(pose([0.25]), 9)
    expect(pose([0.03, 0.03, 0.03, 0.03, 0.03, 0.1])).toBeCloseTo(0.15, 9)
  })
})

describe('checkToolClips', () => {
  it('accepts a valid set and reports a wrong id, an unknown part and a stage event without a stage', () => {
    expect(checkToolClips({ reload }, ['mag']).ok).toBe(true)
    const broken: AnimationClipSpec = { ...reload, id: 'other', events: [{ t: 0.1, type: STAGE_EVENT }] }
    const { problems } = checkToolClips({ reload: broken }, [])
    expect(problems.join('|')).toMatch(/has the id "other"/)
    expect(problems.join('|')).toMatch(/unknown part "mag"/)
    expect(problems.join('|')).toMatch(/stage event without data.stage/)
  })

  it('reports a clip with no duration', () => {
    expect(checkToolClips({ reload: { ...reload, duration: 0 } }, ['mag']).problems.join('|')).toMatch(/has no duration/)
  })
})
