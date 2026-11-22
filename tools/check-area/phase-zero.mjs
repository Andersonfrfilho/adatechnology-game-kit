// @ts-check
// Helpers of the phase 0 reference prints (specs 013, 015, 016): a fixed clock for the recorded frames, the third-person camera pose, a camera that frames a body, and strips of frames side by side.
// Only what the room exposes is used (pause, update, clear, applyCamera, setDebugCamera, look, playerPosition): nothing here adds to the room.
import { writeFileSync } from 'node:fs'

/** The step of the room's fixed clock (s): every recorded pose is a whole number of these after the room was cleared, so a print is the same frame on every run. */
export const FIXED_STEP = 1 / 60

/**
 * Runs in the page: the camera as the room puts it for the picture in the current camera mode (applyCamera moves it to the third-person pose and gives back the way to restore it).
 * @returns {{ position: number[], target: number[], fovDeg: number }}
 */
export function gameCameraPoseInPage() {
  const room = /** @type {any} */ (window).__testRoom
  const restore = room.applyCamera()
  const camera = room.camera
  camera.updateMatrixWorld(true)
  const direction = new camera.position.constructor(0, 0, -1).applyQuaternion(camera.quaternion)
  const position = [camera.position.x, camera.position.y, camera.position.z]
  const target = [position[0] + direction.x * 5, position[1] + direction.y * 5, position[2] + direction.z * 5]
  restore()
  const round = (/** @type {number[]} */ list) => list.map((value) => +value.toFixed(3))
  return { position: round(position), target: round(target), fovDeg: +camera.fov.toFixed(2) }
}

/**
 * Runs in the page: puts the debug camera at `distance` from the player's feet, `azimuthDeg` around him (0 = in front of him, 90 = on his right side), looking at the middle of his body, so the whole body plus the weapon is in the frame.
 * @param {{ azimuthDeg: number, distance: number, fovDeg: number, lookHeight: number }} frame
 */
export function frameBodyInPage({ azimuthDeg, distance, fovDeg, lookHeight }) {
  const room = /** @type {any} */ (window).__testRoom
  const player = room.playerPosition
  const feet = Array.isArray(player) ? player : [player.x, player.y ?? 0, player.z]
  // the player looks along -z (the scripts aim him with room.look), so "in front of him" is -z and his right is +x
  const angle = (azimuthDeg * Math.PI) / 180
  const position = [feet[0] + Math.sin(angle) * distance, lookHeight + 0.25, feet[2] - Math.cos(angle) * distance]
  const target = [feet[0], lookHeight, feet[2]]
  room.setDebugCamera({ position, target, fov: fovDeg })
  const round = (/** @type {number[]} */ list) => list.map((value) => +value.toFixed(3))
  return { position: round(position), target: round(target), fovDeg }
}

/**
 * Puts the frames (PNG buffers) side by side in one PNG, each with its label on top, drawn in a blank page of the context.
 * @param {{ context: any, frames: { png: Buffer, label: string }[], file: string, columns?: number, cellWidth?: number }} options
 * @returns {Promise<{ width: number, bytes: number }>}
 */
export async function writeStrip({ context, frames, file, columns = frames.length, cellWidth = 480 }) {
  const page = await context.newPage()
  try {
    const result = await page.evaluate(async (/** @type {{ images: string[], labels: string[], columns: number, cellWidth: number }} */ input) => {
      const bitmaps = await Promise.all(input.images.map(async (base64) => createImageBitmap(new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], { type: 'image/png' }))))
      const first = bitmaps[0]
      if (!first) return null
      const cellHeight = Math.round((input.cellWidth * first.height) / first.width)
      const rows = Math.ceil(bitmaps.length / input.columns)
      const canvas = document.createElement('canvas')
      canvas.width = input.cellWidth * input.columns
      canvas.height = cellHeight * rows
      const draw = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
      for (const [at, bitmap] of bitmaps.entries()) {
        const x = (at % input.columns) * input.cellWidth
        const y = Math.floor(at / input.columns) * cellHeight
        draw.drawImage(bitmap, x, y, input.cellWidth, cellHeight)
        draw.fillStyle = 'rgba(0,0,0,.72)'
        draw.fillRect(x, y, input.cellWidth, 20)
        draw.fillStyle = '#fff'
        draw.font = '600 14px monospace'
        draw.fillText(input.labels[at] ?? '', x + 6, y + 15)
      }
      return canvas.toDataURL('image/png').split(',')[1]
    }, { images: frames.map((frame) => frame.png.toString('base64')), labels: frames.map((frame) => frame.label), columns, cellWidth })
    if (!result) throw new Error(`strip ${file}: no frames`)
    const bytes = Buffer.from(result, 'base64')
    writeFileSync(file, bytes)
    return { width: cellWidth * columns, bytes: bytes.length }
  } finally {
    await page.close()
  }
}

/** The share of the 8-bit pixels of two equal-size PNGs that differ (0..1), for frames that must differ from one another. @param {any} context @param {Buffer} a @param {Buffer} b */
export async function differenceShare(context, a, b) {
  const page = await context.newPage()
  try {
    return await page.evaluate(async (/** @type {string[]} */ [first, second]) => {
      const decode = async (/** @type {string} */ base64) => {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], { type: 'image/png' }))
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const draw = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }))
        draw.drawImage(bitmap, 0, 0)
        return draw.getImageData(0, 0, bitmap.width, bitmap.height)
      }
      const [left, right] = await Promise.all([decode(first ?? ''), decode(second ?? '')])
      let different = 0
      for (let at = 0; at < left.data.length; at += 4) if (Math.max(Math.abs((left.data[at] ?? 0) - (right.data[at] ?? 0)), Math.abs((left.data[at + 1] ?? 0) - (right.data[at + 1] ?? 0)), Math.abs((left.data[at + 2] ?? 0) - (right.data[at + 2] ?? 0))) > 12) different++
      return different / (left.width * left.height)
    }, [a.toString('base64'), b.toString('base64')])
  } finally {
    await page.close()
  }
}
