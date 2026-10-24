import { lehmer } from '@adatechnology/game-vfx'
import type { RandomStream } from '@adatechnology/game-vfx'
import type { CanvasContextLike, CanvasLike, ThreeLib } from './types'
import type * as THREE_NS from 'three'

const SCORCH_SEED = 5
const TEXTURE_SIZE = 256
const FULL_TURN = Math.PI * 2

/** Where a texture draws its randomness: the Lab seeded the page with 5 before it made the marks, so the textures do not touch the effect's own stream. */
export function createTextureStream(): RandomStream {
  return lehmer(SCORCH_SEED)
}

/** Without a DOM (a server, a test in Node) there is nothing to draw on: the textures stay blank and the marks still lay down their geometry. */
function blankCanvas(): CanvasLike {
  return { width: 0, height: 0, getContext: () => null }
}

function defaultCanvas(): CanvasLike {
  if (typeof document === 'undefined') return blankCanvas()
  return document.createElement('canvas') as unknown as CanvasLike
}

function paint(createCanvas: () => CanvasLike, draw: (context: CanvasContextLike, size: number) => void): CanvasLike {
  const canvas = createCanvas()
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const context = canvas.getContext('2d')
  if (context) draw(context, TEXTURE_SIZE)
  return canvas
}

function drawScorch(context: CanvasContextLike, size: number, random: RandomStream): void {
  context.clearRect(0, 0, size, size)
  const center = size / 2
  for (let ray = 0; ray < 60; ray++) {
    const angle = random.next() * FULL_TURN
    const length = center * (0.55 + random.next() * 0.42)
    context.strokeStyle = `rgba(8,6,5,${0.25 + random.next() * 0.35})`
    context.lineWidth = 2 + random.next() * 6
    context.beginPath()
    context.moveTo(center, center)
    context.lineTo(center + Math.cos(angle) * length, center + Math.sin(angle) * length)
    context.stroke()
  }
  const gradient = context.createRadialGradient(center, center, 0, center, center, center * 0.72)
  gradient.addColorStop(0, 'rgba(4,3,3,.96)')
  gradient.addColorStop(0.55, 'rgba(10,8,7,.85)')
  gradient.addColorStop(1, 'rgba(14,11,9,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  for (let spot = 0; spot < 26; spot++) {
    context.fillStyle = `rgba(60,40,28,${0.15 + random.next() * 0.2})`
    context.beginPath()
    context.arc(center + random.between(-0.4, 0.4) * center, center + random.between(-0.4, 0.4) * center, 2 + random.next() * 7, 0, 7)
    context.fill()
  }
}

function drawDirt(context: CanvasContextLike, size: number, random: RandomStream): void {
  const center = size / 2
  context.clearRect(0, 0, size, size)
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, 'rgba(92,72,52,1)')
  gradient.addColorStop(0.6, 'rgba(118,92,64,1)')
  gradient.addColorStop(0.82, 'rgba(80,64,50,.8)')
  gradient.addColorStop(1, 'rgba(40,36,34,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  for (let speck = 0; speck < 420; speck++) {
    const angle = random.next() * FULL_TURN
    const distance = Math.sqrt(random.next()) * center * 0.8
    context.fillStyle = random.next() < 0.5 ? 'rgba(40,30,22,.5)' : 'rgba(160,132,96,.5)'
    context.beginPath()
    context.arc(center + Math.cos(angle) * distance, center + Math.sin(angle) * distance, 1 + random.next() * 3.5, 0, 7)
    context.fill()
  }
}

export interface MarkTextures {
  readonly scorch: readonly THREE_NS.CanvasTexture[]
  readonly dirt: THREE_NS.CanvasTexture
}

/** The three scorch textures and the dirt one (L443-457), drawn once from a stream seeded like the page's. */
export function createMarkTextures(THREE: ThreeLib, createCanvas: (() => CanvasLike) | undefined): MarkTextures {
  const make = createCanvas ?? defaultCanvas
  const random = createTextureStream()
  const texture = (canvas: CanvasLike): THREE_NS.CanvasTexture => {
    const result = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement)
    result.colorSpace = THREE.SRGBColorSpace
    result.anisotropy = 4
    return result
  }
  const scorch = [0, 1, 2].map(() => texture(paint(make, (context, size) => drawScorch(context, size, random))))
  const dirt = texture(paint(make, (context, size) => drawDirt(context, size, random)))
  return { scorch, dirt }
}
