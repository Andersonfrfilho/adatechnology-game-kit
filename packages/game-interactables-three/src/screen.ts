import type { CanvasFactory, ThreeLib, ThreeNS } from './types'

export interface ScreenOptions {
  /** Where the canvas is created (the global `document`, or a fake). */
  document: CanvasFactory
  /** Canvas size in pixels. Default 128 x 72. */
  w?: number
  h?: number
  /** Seed of the static noise. Default 1. */
  seed?: number
  /** Redraws per second while on. Default 15. */
  fps?: number
  /** Emissive strength while on. Default 1. */
  intensity?: number
}

export interface Screen {
  material: ThreeNS.MeshStandardMaterial
  texture: ThreeNS.CanvasTexture
  canvas: any
  readonly on: boolean
  readonly channel: number
  setOn(on: boolean): void
  setChannel(channel: number): void
  /** Advance the animation; redraws the canvas at `fps` while on. */
  update(dt: number): void
  dispose(): void
}

const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A screen material backed by a canvas texture. Off: black canvas, no emission. On: the channel's content (0 color bars,
 * 1 static noise, 2 animated landscape, higher numbers repeat them with shifted hues) lights the surface.
 */
export function createScreen(THREE: ThreeLib, options: ScreenOptions): Screen {
  const w = options.w ?? 128
  const h = options.h ?? 72
  const canvas = options.document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  // the canvas is uploaded to the GPU every redraw: tell the browser so it keeps a CPU-backed canvas (no readback warning)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const rand = mulberry(options.seed ?? 1)
  const period = 1 / Math.max(1, options.fps ?? 15)
  const intensity = options.intensity ?? 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 0.25,
    metalness: 0,
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0,
  })

  let on = false
  let channel = 0
  let clock = 0
  let acc = 0

  const fill = (style: string, x: number, y: number, rw: number, rh: number): void => {
    if (!ctx) return
    ctx.fillStyle = style
    ctx.fillRect(x, y, rw, rh)
  }

  const drawBars = (): void => {
    const n = BARS.length
    for (let i = 0; i < n; i++) fill(BARS[(i + channel) % n], Math.floor((i * w) / n), 0, Math.ceil(w / n), Math.floor(h * 0.75))
    fill('#101010', 0, Math.floor(h * 0.75), w, h - Math.floor(h * 0.75))
    const x = ((clock * 20) % (w + 12)) - 12
    fill('#ffffff', x, Math.floor(h * 0.8), 12, Math.floor(h * 0.1))
  }

  const drawNoise = (): void => {
    const cell = Math.max(2, Math.floor(w / 48))
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const g = Math.floor(rand() * 220 + 20)
        fill(`rgb(${g},${g},${g})`, x, y, cell, cell)
      }
    }
  }

  const drawScene = (): void => {
    const hue = (channel * 40) % 360
    fill(`hsl(${(200 + hue) % 360},60%,${55 + 10 * Math.sin(clock * 0.3)}%)`, 0, 0, w, Math.floor(h * 0.65))
    fill(`hsl(${(110 + hue) % 360},40%,32%)`, 0, Math.floor(h * 0.65), w, h - Math.floor(h * 0.65))
    const sx = (0.5 + 0.4 * Math.sin(clock * 0.5)) * w
    const sy = (0.3 - 0.15 * Math.cos(clock * 0.5)) * h
    fill('#ffe680', sx - 5, sy - 5, 10, 10)
    const bx = (clock * 25) % (w + 16) - 16
    fill('#e03030', bx, Math.floor(h * 0.7), 16, 10)
  }

  const draw = (): void => {
    if (!on) {
      fill('#000000', 0, 0, w, h)
    } else if (channel % 3 === 0) {
      drawBars()
    } else if (channel % 3 === 1) {
      drawNoise()
    } else {
      drawScene()
    }
    texture.needsUpdate = true
  }

  const apply = (): void => {
    material.emissiveIntensity = on ? intensity : 0
    material.color.setHex(on ? 0x111111 : 0x000000)
    draw()
  }
  apply()

  return {
    material,
    texture,
    canvas,
    get on() {
      return on
    },
    get channel() {
      return channel
    },
    setOn(value) {
      on = !!value
      acc = 0
      apply()
    },
    setChannel(n) {
      channel = Math.max(0, Math.floor(n))
      if (on) draw()
    },
    update(dt) {
      if (!on) return
      clock += dt
      acc += dt
      if (acc >= period) {
        acc %= period
        draw()
      }
    },
    dispose() {
      texture.dispose()
      material.dispose()
    },
  }
}
