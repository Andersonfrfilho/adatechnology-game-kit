import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createKitWorld } from '@adatechnology/game-kit-defaults/world'
import type { KitWorld } from '@adatechnology/game-kit-defaults/world'
import { makeRoom, stubRenderer } from './helpers'
import type { TestRoom } from '../src'

type Registration = { readonly id: string | undefined; readonly phase: string; readonly order: number }

const registrations: Registration[][] = []

// the scheduler has no list of what was added to it: record each `add` of every scheduler made while this file runs
vi.mock('@adatechnology/game-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@adatechnology/game-runtime')>()
  return {
    ...actual,
    createScheduler: (options?: Parameters<typeof actual.createScheduler>[0]) => {
      const scheduler = actual.createScheduler(options)
      const list: Registration[] = []
      registrations.push(list)
      const add = scheduler.add.bind(scheduler)
      scheduler.add = (system, systemOptions) => {
        list.push({ id: systemOptions.id, phase: systemOptions.phase, order: systemOptions.order ?? 0 })
        return add(system, systemOptions)
      }
      return scheduler
    },
  }
})

let room: TestRoom | undefined
let world: KitWorld | undefined
afterEach(() => {
  world?.dispose()
  room?.dispose()
  world = undefined
  room = undefined
  registrations.length = 0
})

describe('the host and the room schedule the same systems', () => {
  it('gives every system the host owns the phase and order the room gives it', async () => {
    room = makeRoom({ blastPacing: {}, audio: false })
    const roomList = registrations[0] ?? []
    world = await createKitWorld(THREE, { container: document.createElement('div'), renderer: stubRenderer(), bounds: [-14, -14, 14, 14], physics: 'own', workers: 0, audio: false })
    const hostList = registrations[1] ?? []
    expect(roomList.length).toBeGreaterThan(0)
    expect(hostList.map((system) => system.id)).toEqual(world.frame.systems().map((system) => system.id))
    const byId = new Map(roomList.map((system) => [system.id, system]))
    for (const system of hostList) expect(byId.get(system.id), `${system.id} in the room`).toEqual(system)
  })
})
