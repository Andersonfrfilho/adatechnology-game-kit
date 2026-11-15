import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createRoomGraphics } from '../src/graphics'

const fakeRenderer = (): { gl: THREE.WebGLRenderer; ratios: number[] } => {
  const ratios: number[] = []
  let ratio = 1
  const gl = {
    getPixelRatio: () => ratio,
    setPixelRatio: (value: number) => {
      ratio = value
      ratios.push(value)
    },
    getContext: () => ({ getExtension: () => null, getParameter: () => 'test gpu', RENDERER: 1 }),
    shadowMap: { enabled: true },
  } as unknown as THREE.WebGLRenderer
  return { gl, ratios }
}

describe('the room graphics and the canvas', () => {
  it('resizes the canvas (a new resolution scale) at the start of a frame, never after it was drawn: that frame would show black', () => {
    const { gl, ratios } = fakeRenderer()
    const camera = new THREE.PerspectiveCamera()
    const sun = new THREE.DirectionalLight()
    const loading = { active: false, begin: () => ({ step: () => undefined, end: () => undefined }) } as never
    const graphics = createRoomGraphics({ gl, camera, sun, container: {} as HTMLElement, loading, locale: 'en', label: 'x', ui: false, options: { storage: null, calibrationSeconds: 0, calibrate: 'manual' } })
    graphics.beforeRender(camera)
    graphics.afterRender()
    const drawn = ratios.length
    graphics.controller.set({ ...graphics.controller.settings, resolutionScale: 0.6 })
    graphics.frameEnd()
    expect(ratios.length).toBe(drawn)
    graphics.beforeRender(camera)
    expect(ratios.length).toBe(drawn + 1)
    expect(ratios[ratios.length - 1]).toBeLessThan(1)
    graphics.dispose()
  })
})
