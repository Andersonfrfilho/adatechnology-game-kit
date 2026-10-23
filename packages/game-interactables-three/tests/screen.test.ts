import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createScreen } from '../src'
import { fakeDocument, type FakeCtx } from './helpers'

describe('createScreen', () => {
  it('is black and not emissive while off', () => {
    const s = createScreen(THREE, { document: fakeDocument(), w: 64, h: 36 })
    const ctx = s.canvas.ctx as FakeCtx
    expect(s.on).toBe(false)
    expect(s.material.emissiveIntensity).toBe(0)
    expect(ctx.fills.length).toBe(1)
    expect(ctx.fills[0]).toEqual({ style: '#000000', x: 0, y: 0, w: 64, h: 36 })
    s.update(1)
    expect(ctx.fills.length).toBe(1) // nothing is redrawn while off
  })

  it('draws content when on and goes back to black', () => {
    const s = createScreen(THREE, { document: fakeDocument(), w: 64, h: 36, fps: 10 })
    const ctx = s.canvas.ctx as FakeCtx
    s.setOn(true)
    expect(s.material.emissiveIntensity).toBe(1)
    expect(new Set(ctx.fills.map((f) => f.style)).size).toBeGreaterThan(4) // colour bars
    const n = ctx.fills.length
    s.update(0.05)
    expect(ctx.fills.length).toBe(n) // under the frame period
    s.update(0.06)
    expect(ctx.fills.length).toBeGreaterThan(n)
    s.setOn(false)
    expect(ctx.fills[ctx.fills.length - 1].style).toBe('#000000')
    expect(s.material.emissiveIntensity).toBe(0)
  })

  it('channels draw different content and noise is seeded', () => {
    const styles = (channel: number, seed = 1) => {
      const s = createScreen(THREE, { document: fakeDocument(), w: 64, h: 36, seed })
      s.setOn(true)
      s.setChannel(channel)
      return (s.canvas.ctx as FakeCtx).fills.map((f) => f.style).join('|')
    }
    expect(styles(0)).not.toBe(styles(1))
    expect(styles(1)).not.toBe(styles(2))
    expect(styles(1, 3)).toBe(styles(1, 3))
    expect(styles(1, 3)).not.toBe(styles(1, 4))
  })
})

describe('screen canvas context', () => {
  it('asks for a willReadFrequently 2D context (no browser readback warning) and never reads pixels back', () => {
    const calls: unknown[][] = []
    const base = fakeDocument()
    const doc = {
      createElement(tag: 'canvas') {
        const c = base.createElement(tag)
        const get = c.getContext
        c.getContext = (...a: unknown[]) => {
          calls.push(a)
          return get()
        }
        c.ctx.getImageData = () => {
          throw new Error('no readback')
        }
        return c
      },
    }
    const s = createScreen(THREE, { document: doc, w: 32, h: 18 })
    s.setOn(true)
    s.update(1)
    expect(calls).toEqual([['2d', { willReadFrequently: true }]])
  })
})
