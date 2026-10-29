/** One primitive of a far-away silhouette. Parts are listed in creation order; `parent` is the index of a group part (`-1` is the root). */
export type SilhouettePart =
  | { shape: 'group'; parent: number; x: number; y: number; z: number; ry: number }
  | { shape: 'box'; parent: number; x: number; y: number; z: number; width: number; height: number; depth: number; color: number; emissive: boolean; ry: number; rz: number; radius: number }
  | { shape: 'prism'; parent: number; x: number; y: number; z: number; width: number; height: number; depth: number; color: number; ry: number }
  | { shape: 'cylinder'; parent: number; x: number; y: number; z: number; radiusTop: number; radiusBottom: number; height: number; color: number; segments: number }
  | { shape: 'line'; parent: number; points: [number, number, number][]; color: number }
  | { shape: 'sign'; parent: number; x: number; y: number; z: number; width: number; height: number; ry: number; text: string; background: string; foreground: string }

/** A window the renderer draws as an instance (a lit one glows). `ry` is the facing; the size is width by height. */
export type SilhouetteWindow = { x: number; y: number; z: number; ry: number; width: number; height: number; isLit: boolean }

export type Silhouette = {
  parts: SilhouettePart[]
  windows: SilhouetteWindow[]
  /** Footprint on the ground: centre and size, for the LOD plan. */
  footprint: { x: number; z: number; width: number; depth: number; height: number }
}

export type RandomSource = () => number
