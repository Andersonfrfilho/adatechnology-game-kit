/**
 * Minimal canvas/document fakes so the kit can create its canvas textures in Node (three.js only stores the canvas).
 * The UI tests use the real happy-dom document instead.
 */
function makeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} }
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    putImageData() {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  }
  // every other method is a no-op and every property write is accepted: three only stores the canvas
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k as string]
      if (typeof k === 'symbol') return undefined
      return () => {}
    },
    set() {
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

function makeCanvas(): HTMLCanvasElement {
  const ctx = makeContext()
  return { width: 0, height: 0, getContext: () => ctx, style: {}, addEventListener() {}, tagName: 'CANVAS' } as unknown as HTMLCanvasElement
}

/** A document with just what the kit and three.js create: canvases (and plain elements for the rest). */
export const fakeDocument = {
  createElement: (tag: string): HTMLCanvasElement => (tag === 'canvas' ? makeCanvas() : ({ style: {}, appendChild() {}, setAttribute() {} } as unknown as HTMLCanvasElement)),
  createElementNS: () => ({ style: {}, setAttribute() {} }),
}
