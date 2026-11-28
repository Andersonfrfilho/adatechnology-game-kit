// Copyright (c) 2026 Ada Technology. PolyForm Noncommercial 1.0.0.
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

import { makeRoom, stubRenderer } from './helpers'

/** The stub renderer plus what the program warm-up calls, with the parallel compile three r158+ has. */
function warmableRenderer() {
  const order: string[] = []
  const renderer = Object.assign(stubRenderer(), {
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
    debug: { checkShaderErrors: true },
    // the parallel link is game-render-three's own (`linkInParallel`: `compile`, then the wait on each program); `compileAsync` only marks a three that links in parallel
    compile: vi.fn(() => {
      order.push('compile')
      return new Set()
    }),
    compileAsync: vi.fn(async () => void order.push('compileAsync')),
    render: vi.fn(() => void order.push('render')),
    setRenderTarget: vi.fn(),
    initTexture: vi.fn(),
    getContext: () => ({ MAX_FRAGMENT_UNIFORM_VECTORS: 1, getParameter: () => 1024, linkProgram: () => undefined }),
    info: { programs: [], memory: { geometries: 0, textures: 0 }, render: { calls: 0, triangles: 0, points: 0, lines: 0, frame: 0 }, reset: () => undefined, autoReset: true },
  })
  return { renderer: renderer as unknown as THREE.WebGLRenderer, order }
}

describe('room.warmUpAsync', () => {
  it('links each fog state in parallel before drawing it and resolves, so a loading screen can await it', async () => {
    const { renderer, order } = warmableRenderer()
    const room = makeRoom({ renderer })
    try {
      await room.warmUpAsync()
      expect(order[0]).toBe('compile')
      expect(order.indexOf('render')).toBeGreaterThan(order.indexOf('compile'))
      // three r160's compileAsync throws from its timer on a material disposed while it links: the warm-up never calls it
      expect(order).not.toContain('compileAsync')
      expect((renderer as unknown as { debug: { checkShaderErrors: boolean } }).debug.checkShaderErrors).toBe(false)
    } finally {
      room.dispose()
    }
  })
})
