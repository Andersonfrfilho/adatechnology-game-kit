import type { TextureMarker } from '@adatechnology/game-animals'
import type * as THREE_NS from 'three'

import { createStream } from './context'
import type { CanvasLike, DocumentLike, Three } from './types'

type Painter = {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  fillRect(x: number, y: number, width: number, height: number): void
  beginPath(): void
  arc(x: number, y: number, radius: number, from: number, to: number): void
  stroke(): void
  fill(): void
}

const canvasTexture = (THREE: Three, document: DocumentLike, width: number, height: number, draw: (painter: Painter, width: number, height: number) => void): THREE_NS.CanvasTexture => {
  const canvas: CanvasLike = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d') as Painter, width, height)
  const texture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const spotsTexture = (THREE: Three, document: DocumentLike, base: string, spot: string): THREE_NS.CanvasTexture =>
  canvasTexture(THREE, document, 256, 256, (painter, width, height) => {
    painter.fillStyle = base
    painter.fillRect(0, 0, width, height)
    const next = createStream(11)
    for (let index = 0; index < 70; index++) {
      const x = next() * width
      const y = next() * height
      const radius = 5 + next() * 7
      painter.strokeStyle = spot
      painter.lineWidth = 3
      painter.beginPath()
      painter.arc(x, y, radius, 0, 7)
      painter.stroke()
      painter.fillStyle = 'rgba(120,70,20,.45)'
      painter.beginPath()
      painter.arc(x, y, radius * 0.6, 0, 7)
      painter.fill()
    }
    for (let index = 0; index < 60; index++) {
      painter.fillStyle = spot
      painter.beginPath()
      painter.arc(next() * width, next() * height, 1.5 + next() * 2.5, 0, 7)
      painter.fill()
    }
  })

const stripesTexture = (THREE: Three, document: DocumentLike, base: string, stripe: string): THREE_NS.CanvasTexture =>
  canvasTexture(THREE, document, 128, 128, (painter, width) => {
    painter.fillStyle = base
    painter.fillRect(0, 0, width, 128)
    painter.fillStyle = stripe
    for (let index = 0; index < 9; index++) painter.fillRect(0, index * 14 + (index % 2) * 3, width, 4)
  })

/** The coat texture a species spec asks for (cat stripes, jaguar rosettes), painted on a canvas. */
export const createCoatTexture = (THREE: Three, document: DocumentLike, marker: TextureMarker): THREE_NS.CanvasTexture =>
  marker.kind === 'stripes' ? stripesTexture(THREE, document, marker.base, marker.stripe) : spotsTexture(THREE, document, marker.base, marker.spot)
