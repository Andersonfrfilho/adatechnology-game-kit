/** A `document` whose canvases swallow every 2D call: the renderer only needs the textures to exist, the scene hash never reads their pixels. */
function makeContext(): any {
  const gradient = { addColorStop() {} }
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    measureText: (text: unknown) => ({ width: String(text).length * 6 }),
    putImageData() {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  }
  return new Proxy(target, {
    get(t, key) {
      if (key in t) return t[key as string]
      if (typeof key === 'symbol') return undefined
      return () => {}
    },
    set() {
      return true
    },
  })
}

export const fakeDocument: any = {
  createElement: (tag: string) => {
    if (tag !== 'canvas') return { style: {}, appendChild() {}, setAttribute() {} }
    const context = makeContext()
    return { width: 0, height: 0, getContext: () => context, style: {}, addEventListener() {}, tagName: 'CANVAS' }
  },
  createElementNS: () => ({ style: {}, setAttribute() {} }),
}
