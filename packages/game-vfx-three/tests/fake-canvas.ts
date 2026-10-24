import type { CanvasContextLike, CanvasLike } from '../src'

/** A canvas that accepts every drawing call and draws nothing: the marks only need a texture to exist. */
export function createFakeCanvas(): CanvasLike {
  const gradient = { addColorStop: () => {} }
  const context: CanvasContextLike = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {},
    strokeRect: () => {},
    createRadialGradient: () => gradient,
  }
  return { width: 0, height: 0, getContext: () => context }
}
