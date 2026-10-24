/** `[x, y, z]` in metres (or a direction). */
export type Vec3 = readonly [number, number, number]
/** `[x, y]`. */
export type Vec2 = readonly [number, number]
/** A column-major 4 x 4 matrix (the layout of three's `Matrix4.elements`). */
export type Mat4 = readonly number[]
/** `0xRRGGBB` or `'#rrggbb'`. */
export type Color = number | string
/** Euler order, as three names it. */
export type RotationOrder = 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY'

/** An atlas cell: the primitive's uvs are remapped into it (`u0 + u x (u1 - u0)`). */
export interface UvRect {
  readonly u0: number
  readonly v0: number
  readonly u1: number
  readonly v1: number
}

/**
 * A local transform. Either `position` / `rotation` / `rotationOrder` / `scale` (composed as three's `Object3D` does: Euler, quaternion, matrix),
 * or `heading` with `position` (a pure rotation about +y built as a rotation matrix, the turn of an item on the floor), or a whole `matrix`.
 */
export interface Transform {
  readonly position?: Vec3
  readonly rotation?: Vec3
  readonly rotationOrder?: RotationOrder
  readonly scale?: number | Vec3
  readonly heading?: number
  readonly matrix?: Mat4
}

/** One copy of an instanced node: where it goes (between the parent and the node) and, optionally, its own colour. */
export interface InstanceSpec extends Transform {
  readonly color?: Color
}

/** Fields every node may carry. */
export interface NodeCommon extends Transform {
  /** Named range: the vertices and indices this node adds are listed per batch in `ranges`. */
  readonly name?: string
  /** Starts a movable part (see the README): the node's transform is the part's pivot, relative to the root; its children are baked in the part's space. */
  readonly part?: string
  /** Material id, inherited by the children. */
  readonly material?: string
  /** Vertex colour, inherited by the children. */
  readonly color?: Color
  /** Atlas cell of the uvs, inherited by the children. */
  readonly uv?: UvRect
  /** Instancing hint: draw this node once per entry instead of merging it. */
  readonly instances?: readonly InstanceSpec[]
  /** Left out of the LOD levels whose `detail` is below this. */
  readonly minDetail?: number
  /** Free strings carried to the node's `ranges`. */
  readonly tags?: readonly string[]
}

export interface GroupNode extends NodeCommon {
  readonly kind: 'group'
  readonly children?: readonly ShapeNode[]
}
export interface BoxNode extends NodeCommon {
  readonly kind: 'box'
  /** `[width, height, depth]`, default `[1, 1, 1]`. */
  readonly size?: Vec3
  /** `[widthSegments, heightSegments, depthSegments]`, default `[1, 1, 1]`. */
  readonly segments?: readonly [number, number, number]
}
export interface CylinderNode extends NodeCommon {
  readonly kind: 'cylinder'
  readonly radiusTop?: number
  readonly radiusBottom?: number
  readonly height?: number
  readonly radialSegments?: number
  readonly heightSegments?: number
  readonly openEnded?: boolean
  readonly thetaStart?: number
  readonly thetaLength?: number
}
export interface ConeNode extends NodeCommon {
  readonly kind: 'cone'
  readonly radius?: number
  readonly height?: number
  readonly radialSegments?: number
  readonly heightSegments?: number
  readonly openEnded?: boolean
  readonly thetaStart?: number
  readonly thetaLength?: number
}
export interface SphereNode extends NodeCommon {
  readonly kind: 'sphere'
  readonly radius?: number
  readonly widthSegments?: number
  readonly heightSegments?: number
  readonly phiStart?: number
  readonly phiLength?: number
  readonly thetaStart?: number
  readonly thetaLength?: number
}
export interface PlaneNode extends NodeCommon {
  readonly kind: 'plane'
  readonly width?: number
  readonly height?: number
  readonly widthSegments?: number
  readonly heightSegments?: number
}
export interface CircleNode extends NodeCommon {
  readonly kind: 'circle'
  readonly radius?: number
  readonly segments?: number
  readonly thetaStart?: number
  readonly thetaLength?: number
}
export interface RingNode extends NodeCommon {
  readonly kind: 'ring'
  readonly innerRadius?: number
  readonly outerRadius?: number
  readonly thetaSegments?: number
  readonly phiSegments?: number
  readonly thetaStart?: number
  readonly thetaLength?: number
}
export interface LatheNode extends NodeCommon {
  readonly kind: 'lathe'
  /** The profile, `[x, y]` with x the distance from the axis. */
  readonly points: readonly Vec2[]
  readonly segments?: number
  readonly phiStart?: number
  readonly phiLength?: number
}
export interface TorusNode extends NodeCommon {
  readonly kind: 'torus'
  readonly radius?: number
  readonly tube?: number
  readonly radialSegments?: number
  readonly tubularSegments?: number
  readonly arc?: number
}
/** A straight-edged outline (curves are sampled by the caller), with optional holes. */
export interface ShapeOutline {
  readonly outer: readonly Vec2[]
  readonly holes?: readonly (readonly Vec2[])[]
}
export interface BevelSpec {
  readonly thickness?: number
  readonly size?: number
  readonly offset?: number
  readonly segments?: number
}
export interface ExtrudeNode extends NodeCommon {
  readonly kind: 'extrude'
  readonly shape: ShapeOutline
  /** Default 1, as three. */
  readonly depth?: number
  readonly steps?: number
  /** `false` for no bevel; default three's (`thickness 0.2`, `size thickness - 0.1`, `offset 0`, `segments 3`). */
  readonly bevel?: false | BevelSpec
}
/** A rectangle `min`..`max` in the box's xy plane (centred coordinates) cut through the whole depth. */
export interface HoleSpec {
  readonly min: Vec2
  readonly max: Vec2
}
/** A box minus rectangular prisms that go all the way through it along z: walls with windows and doors. */
export interface DifferenceNode extends NodeCommon {
  readonly kind: 'difference'
  readonly size: Vec3
  readonly subtract: readonly HoleSpec[]
}
/** Raw triangles. Normals are computed as three's `computeVertexNormals` when missing; uvs default to zero. */
export interface MeshNode extends NodeCommon {
  readonly kind: 'mesh'
  readonly positions: readonly number[]
  readonly normals?: readonly number[]
  readonly uvs?: readonly number[]
  readonly indices?: readonly number[]
}
/** An anchor (a light, a muzzle, a seat): reported in `points`, at `position` in its parent's space. */
export interface PointNode extends NodeCommon {
  readonly kind: 'point'
  readonly data?: unknown
}
/** A node made by a generator the host registered (`registerGenerator`). */
export interface CustomNode extends NodeCommon {
  readonly kind: 'custom'
  readonly generator: string
  readonly params?: unknown
}

export type PrimitiveNode =
  | BoxNode
  | CylinderNode
  | ConeNode
  | SphereNode
  | PlaneNode
  | CircleNode
  | RingNode
  | LatheNode
  | TorusNode
  | ExtrudeNode
  | DifferenceNode
  | MeshNode
export type ShapeNode = GroupNode | PrimitiveNode | PointNode | CustomNode
export type ShapeKind = ShapeNode['kind']

/** Renderer-agnostic hints for a material id; `game-shapes-three` turns them into a material when the host gives none. */
export interface MaterialHint {
  readonly color?: Color
  readonly roughness?: number
  readonly metalness?: number
  readonly opacity?: number
  readonly transparent?: boolean
  readonly emissive?: Color
  readonly emissiveIntensity?: number
  readonly side?: 'front' | 'back' | 'double'
  readonly flatShading?: boolean
  readonly vertexColors?: boolean
  readonly depthWrite?: boolean
}

/** A level after the base one. */
export interface LodLevel {
  /** Camera distance from which this level is drawn. */
  readonly distance: number
  /** Multiplies the segment counts of round primitives (0 < detail <= 1). */
  readonly detail: number
  /** Leaf nodes whose bounding radius is below this are left out. */
  readonly minSize?: number
  /** Segment counts never go below this (default 3). */
  readonly minSegments?: number
}

/** The document: a node tree and how to draw it. */
export interface ShapeSchema {
  readonly version: 1
  readonly name?: string
  readonly materials?: Readonly<Record<string, MaterialHint>>
  readonly root: ShapeNode
  readonly lod?: readonly LodLevel[]
  readonly cullDistance?: number
}

/** A group of the index of a primitive, as three's `BufferGeometry.groups`. */
export interface GeometryGroup {
  readonly start: number
  readonly count: number
  readonly materialIndex: number
}

/** One primitive on its own, not baked: exactly the arrays the three generator of `type` builds. */
export interface PrimitiveBuffers {
  /** The three geometry this reproduces (`'BoxGeometry'`...), or `'BufferGeometry'`. */
  readonly type: string
  /** The parameters, as three's `geometry.parameters` would hold them. */
  readonly parameters: Readonly<Record<string, unknown>>
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  /** Absent for non-indexed geometry (extrusions). */
  readonly indices?: Uint16Array | Uint32Array
  readonly groups: readonly GeometryGroup[]
}

/** The vertices and indices a named node added to a batch. */
export interface NamedRange {
  readonly name: string
  readonly tags?: readonly string[]
  readonly vertexStart: number
  readonly vertexCount: number
  readonly indexStart: number
  readonly indexCount: number
}

export interface Bounds {
  readonly min: [number, number, number]
  readonly max: [number, number, number]
}

/** Everything of one (part, material): baked, ready for one draw call. */
export interface ShapeBatch {
  readonly material: string
  /** `null` for the static body. */
  readonly part: string | null
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly colors?: Float32Array
  readonly indices?: Uint16Array | Uint32Array
  readonly ranges: readonly NamedRange[]
  readonly bounds: Bounds
}

/** A node drawn many times: its geometry once (in the node's space) and one matrix per copy (in the part's space). */
export interface InstancedBatch {
  readonly material: string
  readonly part: string | null
  readonly name?: string
  readonly geometry: PrimitiveBuffers
  /** 16 floats per instance, column-major. */
  readonly matrices: Float32Array
  /** rgb per instance, when the instances have colours. */
  readonly colors?: Float32Array
  readonly count: number
}

export interface ShapeLevel {
  readonly distance: number
  readonly detail: number
  readonly batches: readonly ShapeBatch[]
  readonly instanced: readonly InstancedBatch[]
}

/** A movable part: its pivot transform, relative to the root, as given in the schema, and as a matrix. */
export interface ShapePart extends Transform {
  readonly id: string
  readonly matrix: Mat4
}

export interface ShapePoint {
  readonly name?: string
  readonly part: string | null
  readonly position: [number, number, number]
  readonly data?: unknown
  readonly tags?: readonly string[]
}

export interface ShapeStats {
  readonly vertices: number
  readonly triangles: number
  readonly batches: number
  readonly instances: number
  readonly primitives: number
}

/** What `generate` returns. Every array owns its buffer (transferable). */
export interface ShapeBuffers {
  readonly key: string
  readonly name?: string
  readonly levels: readonly ShapeLevel[]
  readonly parts: readonly ShapePart[]
  readonly points: readonly ShapePoint[]
  readonly materials?: Readonly<Record<string, MaterialHint>>
  readonly cullDistance?: number
  /** Of level 0. */
  readonly stats: ShapeStats
}

/** What a custom generator receives besides its params. */
export interface GeneratorContext {
  /** Seeded stream in [0, 1), its own per (seed, generator, node path). */
  readonly random: () => number
  readonly seed: number | string
  readonly detail: number
  readonly path: string
}
export type ShapeGenerator = (params: any, context: GeneratorContext) => ShapeNode

export interface GenerateOptions {
  /** Seed of the custom generators. Default 0. */
  readonly seed?: number | string
  /** Vertex colours: `'linear'` (three's working space, default), `'srgb'` (the channels over 255) or `'none'`. */
  readonly colors?: 'linear' | 'srgb' | 'none'
  /** Index the batches (default true). */
  readonly indexed?: boolean
  /** Material ids the host draws; any other id becomes `fallbackMaterial`. Default: every id is kept. */
  readonly materials?: readonly string[]
  readonly fallbackMaterial?: string
  /** Ids that share a draw: `{ metal: 'plain' }` puts metal into the plain batches (after `materials`). */
  readonly materialAlias?: Readonly<Record<string, string>>
  /** Instance identical leaf primitives repeated at least `minCount` times. Off by default. */
  readonly instancing?: { readonly minCount: number }
  /** Only these level indices (0 is the base). Default all. */
  readonly levels?: readonly number[]
  /** Generators besides the registered ones. */
  readonly generators?: Readonly<Record<string, ShapeGenerator>>
  /** Validate the schema first (default true). */
  readonly validate?: boolean
}
