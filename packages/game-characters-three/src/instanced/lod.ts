/** Radial segments of the three instanced body geometries (G 65541 `BODY_LOD`): close, middle and far. */
export const LOD_SEGMENTS = [16, 10, 5] as const
/** Detail factors the rich builder bakes at for the same three levels (G ZVAR). */
export const LOD_BAKE = [1, 0.5, 0.28] as const
/** Distances in metres where the middle and the far level start (G `LOD_D`). */
export const LOD_DISTANCES = [18, 55] as const
/** Instances each level's batch holds for baked variants (G ZVAR). */
export const LOD_BATCH_CAPACITY = [160, 700, 2600] as const
/** The far level casts no shadow. */
export const LOD_CASTS_SHADOW = [true, true, false] as const

/** 0, 1 or 2 for a body `distance` metres from the camera. */
export const lodAt = (distance: number, distances: readonly [number, number] = LOD_DISTANCES): 0 | 1 | 2 => (distance < distances[0] ? 0 : distance < distances[1] ? 1 : 2)
