// happy-dom has no 2D canvas: the house renderer that draws the furniture of game-floorplan-three (a counter, a shelf, a table) paints its textures on one. A context that swallows
// every call is enough, the tests never read the pixels.
const gradient = { addColorStop: () => undefined }
const context = (): unknown =>
  new Proxy(
    {
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      createPattern: () => null,
      createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      measureText: (text: unknown) => ({ width: String(text).length * 6 }),
    } as Record<string, unknown>,
    {
      get: (target, key) => (typeof key === 'symbol' ? undefined : key in target ? target[key] : () => undefined),
      set: () => true,
    },
  )

const canvas = globalThis.HTMLCanvasElement?.prototype as unknown as { getContext: (kind: string) => unknown } | undefined
if (canvas) {
  const original = canvas.getContext
  canvas.getContext = function (this: unknown, kind: string) {
    return kind === '2d' ? context() : original?.call(this, kind)
  }
}
