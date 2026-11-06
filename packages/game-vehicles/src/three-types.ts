/**
 * The three.js types the package names, in one place. The core binds to no three.js at runtime (the host passes its `THREE`, layer
 * rule `core-no-three`); these are types only, erased from the build, and this is the one file that reads them from `@types/three`.
 */
export type * as THREE_NS from 'three'
export type {
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ColorRepresentation,
  Curve,
  ExtrudeGeometryOptions,
  Group,
  HSL,
  InterleavedBufferAttribute,
  Intersection,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Ray,
  Raycaster,
  Shape,
  Sphere,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector2,
  Vector3,
} from 'three'
