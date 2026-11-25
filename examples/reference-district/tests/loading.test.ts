import { describe, expect, it } from 'vitest'

import { createLoading } from '@adatechnology/game-kit-defaults/world'
import type { LoadingState } from '@adatechnology/game-kit-defaults/world'

import { DISTRICT_LOADING_TEXT, DISTRICT_STEPS, startDistrictProgress } from '../src/game/loading'

describe('the loading card of the district', () => {
  it('opens one opaque task with a notch per step, names each step as it starts and takes the card down at the end', async () => {
    // draw: false keeps the state and tells it through `on`, with no page: the same indicator the page draws
    const loading = createLoading({ container: {} as HTMLElement, draw: false, working: DISTRICT_LOADING_TEXT.working })
    const seen: Array<LoadingState | undefined> = []
    loading.on((state) => seen.push(state))
    const progress = startDistrictProgress(loading, DISTRICT_LOADING_TEXT)
    expect(loading.state()).toMatchObject({ label: DISTRICT_LOADING_TEXT.title, text: DISTRICT_LOADING_TEXT.working, done: 0, total: DISTRICT_STEPS.length, opaque: true })
    for (const step of DISTRICT_STEPS) await progress.step(step)
    expect(loading.active).toBe(true)
    progress.end()
    expect(loading.active).toBe(false)
    const steps = seen.slice(1, -1)
    expect(steps.map((state) => state?.text)).toEqual(DISTRICT_STEPS.map((step) => DISTRICT_LOADING_TEXT.steps[step]))
    expect(steps.map((state) => state?.done)).toEqual(DISTRICT_STEPS.map((_, index) => index))
    expect(seen.at(-1)).toBeUndefined()
    loading.dispose()
  })

  it('leaves the card up with the error on it when the assembly fails, so the page is never left black', async () => {
    const loading = createLoading({ container: {} as HTMLElement, draw: false, working: DISTRICT_LOADING_TEXT.working })
    const progress = startDistrictProgress(loading, DISTRICT_LOADING_TEXT)
    await progress.step('world')
    progress.fail(new Error('no WebGL'))
    expect(loading.active).toBe(true)
    expect(loading.state()).toMatchObject({ label: DISTRICT_LOADING_TEXT.title, text: `${DISTRICT_LOADING_TEXT.failed}no WebGL` })
    loading.dispose()
  })

  it('shows nothing without a sink and still runs the steps', async () => {
    const progress = startDistrictProgress(undefined, DISTRICT_LOADING_TEXT)
    for (const step of DISTRICT_STEPS) await progress.step(step)
    expect(() => progress.end()).not.toThrow()
  })

  it('has a line for every step', () => {
    for (const step of DISTRICT_STEPS) expect(DISTRICT_LOADING_TEXT.steps[step].length).toBeGreaterThan(0)
  })
})
