/** A fake `document` whose canvases record the fills made on their 2D context. */
export interface FakeCtx {
  fillStyle: string
  fills: Array<{ style: string; x: number; y: number; w: number; h: number }>
  fillRect(x: number, y: number, w: number, h: number): void
}

export function fakeDocument(): { createElement(tag: 'canvas'): any } {
  return {
    createElement() {
      const ctx: FakeCtx = {
        fillStyle: '',
        fills: [],
        fillRect(x, y, w, h) {
          this.fills.push({ style: this.fillStyle, x, y, w, h })
        },
      }
      return { width: 0, height: 0, getContext: () => ctx, ctx }
    },
  }
}
