import { describe, expect, it } from 'vitest'

import { HANDS_TIMING, createTakeTimeline, planDrawSequence, planHands, planTakeSequence } from '../src'
import type { TakeStep } from '../src'

const kinds = (steps: readonly TakeStep[]): string[] => steps.map((step) => step.kind)

describe('taking a thing in steps one can see', () => {
  it('a rifle swings onto its sling before the hand reaches, closes and lifts', () => {
    const plan = planHands({ hands: 1, weapons: { R: { id: 'm4a1', hands: 2, slot: 'sling' } }, slots: ['hip', 'sling'] })
    const sequence = planTakeSequence(plan)
    expect(kinds(sequence.steps)).toEqual(['sling', 'reach', 'close', 'lift'])
    expect(sequence.steps[0]?.move?.weapon).toBe('m4a1')
    expect(sequence.duration).toBeCloseTo(HANDS_TIMING.sling + HANDS_TIMING.reach + HANDS_TIMING.close + HANDS_TIMING.lift)
  })

  it('both hands for a big thing: the knife in the off hand is tossed first (the pistol took the holster), then the pistol is holstered', () => {
    const plan = planHands({ hands: 2, weapons: { R: { id: 'glock_17', hands: 1, slot: 'hip' }, L: { id: 'knife', hands: 1, slot: 'hip' } }, slots: ['hip'] })
    expect(kinds(planTakeSequence(plan).steps)).toEqual(['drop', 'stow', 'reach', 'close', 'lift'])
    expect(planTakeSequence(plan).steps[0]?.move?.hand).toBe('L')
  })

  it('empty hands only reach, close and lift; a push only frees the hands', () => {
    const plan = planHands({ hands: 1, weapons: {}, slots: [] })
    expect(kinds(planTakeSequence(plan).steps)).toEqual(['reach', 'close', 'lift'])
    expect(planTakeSequence(plan, { take: false }).steps).toEqual([])
  })

  it('the timeline reports each step once, in order, whatever the frame length', () => {
    const plan = planHands({ hands: 1, weapons: { R: { id: 'm4a1', hands: 2, slot: 'sling' } }, slots: ['sling'] })
    const timeline = createTakeTimeline(planTakeSequence(plan))
    const started: string[] = []
    const ended: string[] = []
    let last = timeline.advance(0)
    started.push(...kinds(last.started))
    expect(last.step?.kind).toBe('sling')
    expect(last.progress).toBe(0)
    for (const dt of [0.1, 0.5, 0.016, 0.3, 0.2, 0.9]) {
      last = timeline.advance(dt)
      started.push(...kinds(last.started))
      ended.push(...kinds(last.ended))
      expect(last.progress).toBeGreaterThanOrEqual(0)
      expect(last.progress).toBeLessThanOrEqual(1)
    }
    expect(last.done).toBe(true)
    expect(started).toEqual(['sling', 'reach', 'close', 'lift'])
    expect(ended).toEqual(['sling', 'reach', 'close', 'lift'])
  })

  it('progress eases in and out inside a step', () => {
    const timeline = createTakeTimeline(planDrawSequence([{ hand: 'R', weapon: 'm4a1', move: 'sling', slot: 'sling' }]))
    timeline.advance(0)
    const early = timeline.advance(HANDS_TIMING.draw * 0.1).progress
    const middle = timeline.advance(HANDS_TIMING.draw * 0.4).progress
    expect(early).toBeLessThan(0.1)
    expect(middle).toBeCloseTo(0.5, 5)
  })
})
