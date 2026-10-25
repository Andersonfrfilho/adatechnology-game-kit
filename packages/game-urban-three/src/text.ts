type Three = any

/** What `document.createElement('canvas')` needs; a fake works in Node. */
export type CanvasFactory = { createElement(tag: string): any }

export type TextTextureOptions = { width: number; height: number; background: string; foreground: string; font: string }

const FIT = 0.92

/** Canvas texture with centred lines of text, shrunk to fit 92 % of the width, on a filled background. */
export function createTextTexture(THREE: Three, document: CanvasFactory, lines: readonly string[], o: TextTextureOptions): any {
  const canvas = document.createElement('canvas')
  canvas.width = o.width
  canvas.height = o.height
  const g = canvas.getContext('2d')
  g.fillStyle = o.background
  g.fillRect(0, 0, o.width, o.height)
  g.fillStyle = o.foreground
  g.font = o.font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const base = g.font
  lines.forEach((text, index) => {
    g.font = base
    const measured = g.measureText(text).width
    if (measured > o.width * FIT) g.font = base.replace(/(\d+(?:\.\d+)?)px/, (_match: string, size: string) => ((Number(size) * o.width * FIT) / measured).toFixed(1) + 'px')
    g.fillText(text, o.width / 2, o.height / 2 + (index - (lines.length - 1) / 2) * (o.height / lines.length))
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  return texture
}
