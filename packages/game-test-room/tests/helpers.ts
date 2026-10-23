import * as THREE from 'three'
import { createTestRoom, demoItems } from '../src'
import type { TestRoom, TestRoomOptions } from '../src'

/** A WebGLRenderer stand-in: the room only needs these members, and happy-dom cannot make a real GL context. */
export function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return {
    domElement: dom,
    shadowMap: { enabled: false, type: 0 },
    setSize: () => undefined,
    setPixelRatio: () => undefined,
    render: () => undefined,
    dispose: () => undefined,
  } as unknown as THREE.WebGLRenderer
}

export function makeRoom(extra: Partial<TestRoomOptions> = {}): TestRoom {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const locale = extra.locale ?? 'en'
  return createTestRoom({ THREE, container, locale, catalog: demoItems(locale), renderer: stubRenderer(), ui: false, ...extra })
}
