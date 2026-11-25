// @vitest-environment happy-dom
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPlayer } from '@adatechnology/game-player'

import { createDistrictHud } from '../src/game/assemble/hud'
import type { District, DistrictOptions } from '../src/game/options'
import { startDistrictSession } from '../src/game/session'
import { districtOptionsOf, parsePageChoice } from '../src/test/scenario'
import { scripts } from './helpers'

afterEach(() => document.body.replaceChildren())

const fakeRig = (isFirst: boolean) => {
  const player = createPlayer({ seed: 11 })
  const startSave = player.save()
  return { player, camera: { isFirstPerson: () => isFirst }, backToStart: vi.fn(() => player.load(startSave)) }
}

describe('district HUD', () => {
  it('shows the scenario, the body vitals and the crosshair in the first person', () => {
    const container = document.body.appendChild(document.createElement('div'))
    const rig = fakeRig(true)
    const hud = createDistrictHud({ container, rig, locale: 'pt-BR', title: 'Cena típica', onRestart: vi.fn() })
    rig.player.state.health = 20
    hud.frame()
    expect(container.querySelector('.gp-hud-title')?.textContent).toBe('Cena típica')
    expect(container.querySelector('.gp-hud-row output')?.textContent).toBe('20')
    expect((container.querySelector('.gp-hud-cross') as HTMLElement).style.display).toBe('block')
    expect((container.querySelector('.gp-hud-weapon') as HTMLElement).style.display).toBe('none')
    hud.dispose()
  })

  it('opens the death screen after the death settles; "back to the start" puts the body back alive', () => {
    const container = document.body.appendChild(document.createElement('div'))
    const rig = fakeRig(false)
    const onRestart = vi.fn()
    const canvas = container.appendChild(document.createElement('canvas'))
    const hud = createDistrictHud({ container, rig, locale: 'pt-BR', onRestart, canvas })
    hud.step(42)
    rig.player.die('killed')
    hud.frame()
    expect(container.querySelector('.gp-death.open')).toBeNull()
    rig.player.state.deathTime = 2
    hud.frame()
    expect(container.querySelector('.gp-death.open')?.textContent).toContain('Sobreviveu 0:42')
    const [restart, back] = [...container.querySelectorAll<HTMLButtonElement>('.gp-death-actions button')]
    back?.click()
    expect(rig.backToStart).toHaveBeenCalledTimes(1)
    hud.frame()
    expect(rig.player.state.alive).toBe(true)
    expect(container.querySelector('.gp-death.open')).toBeNull()
    expect(document.activeElement).toBe(canvas)
    rig.player.die('killed')
    rig.player.state.deathTime = 2
    hud.frame()
    restart?.click()
    expect(onRestart).toHaveBeenCalledTimes(1)
    hud.dispose()
  })
})

describe('restart', () => {
  it('gives the district back and builds it again from the same options (same seed, same scene)', async () => {
    const container = document.createElement('div')
    const options = districtOptionsOf({ scripts, choice: parsePageChoice('?cena=pior'), container })
    const built: DistrictOptions[] = []
    const disposed: number[] = []
    const start = async (_three: typeof THREE, given: DistrictOptions): Promise<District> => {
      const index = built.push(given) - 1
      return { dispose: () => void disposed.push(index) } as unknown as District
    }
    const started = vi.fn()
    const session = await startDistrictSession(THREE, options, { start, onStart: started })
    built[0]?.onRestart?.()
    await session.restart()
    expect(built).toHaveLength(2)
    expect(disposed).toEqual([0])
    expect(started).toHaveBeenCalledTimes(2)
    const { onRestart: firstRestart, ...first } = built[0] as DistrictOptions
    const { onRestart: secondRestart, ...second } = built[1] as DistrictOptions
    expect(second).toEqual(first)
    expect(secondRestart).toBe(firstRestart)
    expect(districtOptionsOf({ scripts, choice: parsePageChoice('?cena=pior'), container })).toEqual(options)
  })

  const fakeStart = () => {
    const disposed: number[] = []
    const gates: Array<(district: District) => void> = []
    let made = 0
    const start = (): Promise<District> => {
      const index = made++
      const district = { dispose: () => void disposed.push(index) } as unknown as District
      return index === 0 ? Promise.resolve(district) : new Promise((done) => gates.push(() => done(district)))
    }
    return { start, disposed, open: () => gates.shift()?.({} as District) }
  }

  it('dispose during a restart gives back the old district once and the new one as soon as it is built', async () => {
    const fake = fakeStart()
    const session = await startDistrictSession(THREE, districtOptionsOf({ scripts, choice: parsePageChoice(''), container: document.createElement('div') }), { start: fake.start })
    const restarting = session.restart()
    expect(session.restart()).toBe(restarting)
    session.dispose()
    fake.open()
    await expect(restarting).rejects.toThrow('disposed')
    expect(fake.disposed).toEqual([0, 1])
    expect(session.district).toBeUndefined()
  })

  it('reports a failed restart and lets a later one run', async () => {
    let calls = 0
    const start = async (): Promise<District> => {
      calls++
      if (calls === 2) throw new Error('boom')
      return { dispose: () => undefined } as unknown as District
    }
    const onError = vi.fn()
    let restartHook: (() => void) | undefined
    const session = await startDistrictSession(THREE, districtOptionsOf({ scripts, choice: parsePageChoice(''), container: document.createElement('div') }), {
      start: async (_three, given) => {
        restartHook = given.onRestart
        return start()
      },
      onError,
    })
    restartHook?.()
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    await expect(session.restart()).resolves.toBeDefined()
    expect(calls).toBe(3)
  })
})
