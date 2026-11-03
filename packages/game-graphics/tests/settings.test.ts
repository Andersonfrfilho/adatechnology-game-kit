import { describe, expect, it } from 'vitest'
import { DEFAULT_GRAPHICS, PRESET_VALUES, anyAuto, applyPreset, matchPreset, sanitizeGraphics, setOption, targetFrameMs } from '../src'

describe('graphics settings', () => {
  it('starts on Automático with every option that can be automatic left to the tuner', () => {
    expect(DEFAULT_GRAPHICS.preset).toBe('auto')
    expect(anyAuto(DEFAULT_GRAPHICS)).toBe(true)
    expect(DEFAULT_GRAPHICS.fpsCap).toBe(60)
  })

  it('a preset sets every option and keeps the cap and the counter of the player', () => {
    const mine = { ...DEFAULT_GRAPHICS, fpsCap: 120 as const, showFps: true }
    const low = applyPreset(mine, 'low')
    expect(low).toEqual({ ...PRESET_VALUES.low, preset: 'low', fpsCap: 120, showFps: true })
    expect(anyAuto(low)).toBe(false)
  })

  it('fixing one option under Automático leaves the others on auto and the preset reads custom', () => {
    const s = setOption(DEFAULT_GRAPHICS, 'shadows', 'off')
    expect(s.preset).toBe('custom')
    expect(s.shadows).toBe('off')
    expect(s.resolutionScale).toBe('auto')
    expect(s.hordeDetail).toBe('auto')
  })

  it('setting an option to what a preset has turns the preset back on', () => {
    const s = setOption(applyPreset(DEFAULT_GRAPHICS, 'high'), 'shadows', 'off')
    expect(s.preset).toBe('custom')
    expect(setOption(s, 'shadows', 'all').preset).toBe('high')
  })

  it('the cap and the counter never change the preset', () => {
    expect(setOption(applyPreset(DEFAULT_GRAPHICS, 'medium'), 'fpsCap', 30).preset).toBe('medium')
    expect(setOption(applyPreset(DEFAULT_GRAPHICS, 'medium'), 'showFps', true).preset).toBe('medium')
  })

  it('reads anything stored by hand back into range', () => {
    const s = sanitizeGraphics({ preset: 'ultra', resolutionScale: 7, hordeDetail: -1, shadows: 'rtx', viewDistance: 'long', fpsCap: 75, showFps: 'yes' })
    expect(s.resolutionScale).toBe(1)
    expect(s.hordeDetail).toBe(0.1)
    expect(s.shadows).toBe('auto')
    expect(s.fpsCap).toBe(60)
    expect(s.showFps).toBe(false)
    expect(s.preset).toBe('custom')
    expect(sanitizeGraphics(null)).toEqual(DEFAULT_GRAPHICS)
    expect(matchPreset(PRESET_VALUES.ultra)).toBe('ultra')
  })

  it('aims at the frame of the cap, and at 60 without one', () => {
    expect(targetFrameMs(30)).toBeCloseTo(33.33, 1)
    expect(targetFrameMs(0)).toBeCloseTo(16.67, 1)
  })
})
