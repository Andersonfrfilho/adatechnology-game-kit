import { defaultVehicleFleet } from '@adatechnology/game-kit-defaults'
import { expect } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { createVehiclesTestModule } from '../src'
import { fakeDocument } from './fake-dom'

export type VehiclesModule = ReturnType<typeof createVehiclesTestModule>

/** The vehicles a test lays: the whole fleet of the page (8 vehicles and 2 burnt wrecks), or only the sedan for a test about one car. */
export type Fleet = 'whole' | 'sedan'

export const stubRenderer = (): never => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as never
}

export const roomOf = (locale: string): TestRoom => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return createTestRoom({ THREE, container, locale, catalog: [], renderer: stubRenderer(), ui: false })
}

/**
 * A room with the vehicles module loaded (its contract checks passed). Each vehicle is built several times on the way (the item's clips, the
 * room's throwaway contract build, the area), most of a second each: a test about one car lays only the sedan.
 */
export const roomWithVehicles = (locale = 'pt-BR', fleet: Fleet = 'whole'): { room: TestRoom; module: VehiclesModule } => {
  const room = roomOf(locale)
  const module = createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale, document: fakeDocument as never, three: THREE, ...(fleet === 'sedan' ? { vehicles: ['midsize_sedan'], wrecks: [] } : {}) })
  const report = room.loadModule(module as never)
  expect(report.problems).toEqual([])
  return { room, module }
}

/**
 * Lets the worker read vitest's replies before the next long synchronous stretch: vitest gives up on a report it has not heard back from in
 * 60 s, and a reply that lands while a build holds the thread is read only once the thread is free (`setImmediate` runs after the I/O poll).
 */
export const breathe = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))
