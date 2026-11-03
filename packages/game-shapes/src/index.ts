export { generate, isPrimitiveNode, keyOptions, shapeKey } from './generate'
export {
  box,
  buildPrimitive,
  circle,
  clearTemplateCache,
  clonePrimitive,
  computeVertexNormals,
  cone,
  cylinder,
  difference,
  extrude,
  lathe,
  plane,
  primitiveParameters,
  ring,
  setTemplateCacheSize,
  sphere,
  templateCacheStats,
  torus,
} from './primitives'
export type { DetailOptions } from './primitives'
export { byteSizeOf, cloneBuffers, mergeTransformed, transferablesOf } from './merge'
export type { MergedArrays, TransformedPiece } from './merge'
export { SHAPE_SCHEMA, assertValidShape, validateShape } from './schema'
export { defaultShapeGenerators, getGenerator, listGenerators, registerGenerator, unregisterGenerator } from './registry'
export type { ShapeGenerators } from './registry'
export { createShapes } from './instance'
export type { Shapes, ShapesOptions } from './instance'
export { canonicalJson, hash64, hashValue } from './hash'
export { mulberry32, streamFor } from './random'
export { colorChannels, colorHex, srgbToLinear } from './color'
export { compose, headingMatrix, identity4, isAffine, matrixOf, multiply, normalMatrix, quaternionFromEuler, transformPoint } from './math'
export type { Matrix3, Matrix4 } from './math'
export type * from './types'
export { createShapeCache } from './cache'
export type { ShapeCache, ShapeCacheOptions, ShapeCacheStats } from './cache'
export { createShapePool } from './pool'
export type { ShapePool, ShapePoolOptions, ShapePoolStats, ShapeRequest, WorkerLike } from './pool'
export { installShapeWorker } from './worker'
export type { ShapeJob, ShapeReply, ShapeWorkerOptions, WorkerScopeLike } from './worker'
