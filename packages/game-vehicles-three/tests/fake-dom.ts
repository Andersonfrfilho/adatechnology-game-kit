/**
 * Minimal canvas/document fakes so the kit can create its canvas textures in Node (three.js only stores the canvas).
 * The UI tests use the real happy-dom document instead.
 */
function makeContext(): any {
  const gradient = { addColorStop() {} }
  const target: Record<string, any> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    putImageData() {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  }
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k as string]
      if (typeof k === 'symbol') return undefined
      return () => {}
    },
    set() {
      return true
    },
  })
}

function makeCanvas(): any {
  const ctx = makeContext()
  return { width: 0, height: 0, getContext: () => ctx, style: {}, addEventListener() {}, tagName: 'CANVAS' }
}

export const fakeDocument: any = {
  createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : { style: {}, appendChild() {}, setAttribute() {} }),
  createElementNS: () => ({ style: {}, setAttribute() {} }),
}

/**
 * A document that fakes only canvases and delegates everything else to the real (happy-dom) one: the UI needs real elements,
 * while vehicle textures need a canvas context that happy-dom does not provide.
 */
export function hybridDocument(real: Document): any {
  return {
    createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : real.createElement(tag)),
    createElementNS: (ns: string, tag: string) => real.createElementNS(ns, tag),
    createTextNode: (text: string) => real.createTextNode(text),
    getElementById: (id: string) => real.getElementById(id),
    get head() {
      return real.head
    },
  }
}
