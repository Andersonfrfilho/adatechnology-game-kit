import { RASTER_HEIGHT, RASTER_PADDING, RASTER_WIDTH, svgOfRaster } from './silhouette'
import { TONE_EMPTY, TONE_METAL, TONE_SOLID } from './raster'

/** A picture reduced to tones: 0 empty, 1 solid, 2 light; row by row. */
export interface ToneBitmap {
  readonly width: number
  readonly height: number
  readonly tone: Uint8Array
}

/** Cells that are empty but cannot be reached from the border without crossing the drawing: the inside of an outline-only drawing. Filled with the light tone. */
export function fillEnclosed(bitmap: ToneBitmap): Uint8Array {
  const { width, height } = bitmap
  const tone = Uint8Array.from(bitmap.tone)
  const outside = new Uint8Array(width * height)
  const stack: number[] = []
  const push = (x: number, y: number): void => {
    const index = y * width + x
    if (x < 0 || y < 0 || x >= width || y >= height || outside[index] === 1 || tone[index] !== TONE_EMPTY) return
    outside[index] = 1
    stack.push(index)
  }
  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }
  while (stack.length > 0) {
    const index = stack.pop() as number
    const x = index % width
    const y = (index - x) / width
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }
  for (let index = 0; index < tone.length; index++) if (tone[index] === TONE_EMPTY && outside[index] === 0) tone[index] = TONE_METAL
  return tone
}

/**
 * The same SVG as a model silhouette, from a picture: the drawing is cropped to what it shows, fitted into the padded 4:1 raster (uniform scale, centred, nearest cell),
 * its enclosed areas are filled and it is traced. Nothing of the original markup is kept, only its outline, so the file cannot carry anything but two paths.
 */
export function bitmapSilhouetteSvg(bitmap: ToneBitmap): string | undefined {
  const filled = fillEnclosed(bitmap)
  let minX = bitmap.width
  let minY = bitmap.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      if (filled[y * bitmap.width + x] === TONE_EMPTY) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) return undefined
  const boxWidth = maxX - minX + 1
  const boxHeight = maxY - minY + 1
  const scale = Math.min((RASTER_WIDTH - 2 * RASTER_PADDING) / boxWidth, (RASTER_HEIGHT - 2 * RASTER_PADDING) / boxHeight)
  const offsetX = (RASTER_WIDTH - boxWidth * scale) / 2
  const offsetY = (RASTER_HEIGHT - boxHeight * scale) / 2
  const tone = new Uint8Array(RASTER_WIDTH * RASTER_HEIGHT)
  for (let y = 0; y < RASTER_HEIGHT; y++) {
    for (let x = 0; x < RASTER_WIDTH; x++) {
      const sourceX = Math.floor((x + 0.5 - offsetX) / scale) + minX
      const sourceY = Math.floor((y + 0.5 - offsetY) / scale) + minY
      if (sourceX < minX || sourceX > maxX || sourceY < minY || sourceY > maxY) continue
      tone[y * RASTER_WIDTH + x] = filled[sourceY * bitmap.width + sourceX] === TONE_SOLID ? TONE_SOLID : filled[sourceY * bitmap.width + sourceX] === TONE_EMPTY ? TONE_EMPTY : TONE_METAL
    }
  }
  return svgOfRaster(tone)
}
