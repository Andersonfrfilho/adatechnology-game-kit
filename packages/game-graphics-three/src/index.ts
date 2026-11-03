/**
 * @adatechnology/game-graphics-three: the graphics settings of `@adatechnology/game-graphics` on a three.js renderer (pixel ratio, the sun's shadow, the far
 * plane), the GPU's name for the calibration and a GPU timer for whole frames.
 */
export { VIEW_DISTANCE_METERS, createGraphicsView, gpuName } from './apply'
export type { GraphicsView, GraphicsViewOptions } from './apply'
export { createGpuFrameTimer } from './gpu-timer'
export type { GpuFrameTimer } from './gpu-timer'
