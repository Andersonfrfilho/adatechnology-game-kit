import type { Three, THREE_NS } from '../three'

import { TROUSER_PALETTE, glslColor } from './identity-layout'
import { IMPOSTOR_ANGLES, IMPOSTOR_BONE_SCALE, IMPOSTOR_FRAMES, IMPOSTOR_MATERIAL_SCALE } from './impostor-atlas'
import type { ImpostorAtlas } from './impostor-atlas'

export type ImpostorBatchOptions = {
  /** Instances the batch holds. */
  readonly max: number
  /** The light the baked shade is multiplied by (the impostor is not lit by the scene; default 0.85 grey). */
  readonly light?: { readonly r: number; readonly g: number; readonly b: number }
}

/** One far body: the same `iA`, `iC` and shirt as the near body, the scale of its variant, its silhouette (the atlas block) and the ground height. */
export type ImpostorInstance = {
  readonly a: readonly [number, number, number, number]
  /** Height and width scale (the near body's `b[0]` and `b[1]`). */
  readonly scale: readonly [number, number]
  readonly silhouette: number
  readonly y?: number
  readonly c: readonly [number, number, number, number]
  readonly color: { readonly r: number; readonly g: number; readonly b: number }
  readonly d?: readonly [number, number, number, number]
}

export type ImpostorBatch = {
  readonly mesh: THREE_NS.Mesh & { count: number }
  readonly material: THREE_NS.ShaderMaterial
  readonly count: number
  begin(): void
  push(instance: ImpostorInstance): void
  end(): void
}

const ATTRIBUTES: readonly (readonly [string, number])[] = [['iA', 4], ['iB', 4], ['iC', 4], ['iCol', 3], ['iD', 4]]
const TROUSERS = `const vec3 TROUSERS[16] = vec3[16](${TROUSER_PALETTE.map(glslColor).join(',')});`

const VERTEX = `
  attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec3 iCol; attribute vec4 iD;
  uniform vec4 uBox[SILHOUETTES]; uniform vec2 uCell; uniform vec2 uGrid;
  varying vec2 vUv; varying vec4 vC; varying vec3 vShirt; varying float vTrousers;
  void main(){
    vec3 toCam = vec3(cameraPosition.x - iA.x, 0., cameraPosition.z - iA.y);
    toCam /= max(length(toCam), 0.001);
    vec3 right = vec3(toCam.z, 0., -toCam.x);
    float c = cos(iA.z), s = sin(iA.z);
    vec3 local = vec3(c*toCam.x - s*toCam.z, 0., s*toCam.x + c*toCam.z);
    float angle = mod(floor(atan(local.x, local.z)/6.2831853*ANGLES + 0.5), ANGLES);
    float frame = floor(fract(iA.w)*FRAMES);
    float cell = (iB.z*FRAMES + frame)*ANGLES + angle;
    vec4 box = uBox[int(iB.z)];
    vec2 inset = 0.5/uCell;
    vec2 within = mix(inset, 1. - inset, position.xy);
    vUv = vec2(mod(cell, uGrid.x) + within.x, floor(cell/uGrid.x) + within.y)/uGrid;
    vec3 world = vec3(iA.x, iB.w, iA.y) + right*((position.x - 0.5)*2.*box.x*iB.y) + vec3(0., box.y + position.y*box.z, 0.)*iB.x;
    vC = iC; vShirt = iCol; vTrousers = mod(iD.y, 16.);
    gl_Position = projectionMatrix*viewMatrix*vec4(world, 1.);
  }
`

const FRAGMENT = `
  uniform sampler2D uAtlas; uniform sampler2D uColors; uniform vec3 uLight;
  varying vec2 vUv; varying vec4 vC; varying vec3 vShirt; varying float vTrousers;
  ${TROUSERS}
  bool missing(float bit){ return mod(floor(vC.x/bit), 2.) > 0.5; }
  void main(){
    vec4 texel = texture2D(uAtlas, vUv);
    if (texel.a < 0.5) discard;
    float bone = floor(texel.r*255./${IMPOSTOR_BONE_SCALE}.0 + 0.5);
    float material = floor(texel.g*255./${IMPOSTOR_MATERIAL_SCALE}.0 + 0.5);
    if ((bone==1.||bone==6.||bone==11.) && missing(1.)) discard;
    if (bone==11. && missing(512.)) discard;
    if ((bone==2.||bone==7.) && missing(2.)) discard; if ((bone==3.||bone==8.) && missing(4.)) discard;
    if ((bone==4.||bone==9.) && missing(8.)) discard; if ((bone==5.||bone==10.) && missing(16.)) discard;
    if (bone==7. && missing(32.)) discard; if (bone==8. && missing(64.)) discard;
    if (bone==9. && missing(128.)) discard; if (bone==10. && missing(256.)) discard;
    vec3 skin = mix(vec3(0.93,0.74,0.6), vec3(0.42,0.27,0.18), vC.w);
    skin = mix(skin, vec3(0.435,0.478,0.36), vC.y);
    vec3 baked = texture2D(uColors, vUv).rgb; baked *= baked;
    vec3 tint = material==1. ? vShirt : material==2. ? mix(baked, TROUSERS[int(vTrousers)], 0.75) : material==3. ? vec3(0.08) : baked;
    gl_FragColor = vec4(tint*texel.b*uLight, 1.);
    #include <colorspace_fragment>
  }
`

/** The far bodies as one draw call: a standing quad per body that picks its cell of the atlas by the view angle and the walk phase, tinted per instance. */
export const createImpostorBatch = (three: Three, atlas: ImpostorAtlas, { max, light = { r: 0.85, g: 0.85, b: 0.85 } }: ImpostorBatchOptions): ImpostorBatch => {
  const geometry = new three.InstancedBufferGeometry()
  geometry.setAttribute('position', new three.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  const attributes: Record<string, THREE_NS.InstancedBufferAttribute> = {}
  for (const [name, size] of ATTRIBUTES) {
    const attribute = new three.InstancedBufferAttribute(new Float32Array(max * size), size)
    attribute.setUsage(three.DynamicDrawUsage)
    geometry.setAttribute(name, attribute)
    attributes[name] = attribute
  }
  geometry.instanceCount = 0
  const material = new three.ShaderMaterial({
    defines: { SILHOUETTES: Math.max(1, atlas.silhouettes), ANGLES: `${IMPOSTOR_ANGLES}.0`, FRAMES: `${IMPOSTOR_FRAMES}.0` },
    uniforms: {
      uAtlas: { value: atlas.texture },
      uColors: { value: atlas.colorTexture },
      uLight: { value: new three.Vector3(light.r, light.g, light.b) },
      uCell: { value: new three.Vector2(atlas.cellWidth, atlas.cellHeight) },
      uGrid: { value: new three.Vector2(atlas.columns, atlas.rows) },
      uBox: { value: atlas.boxes.map((box) => new three.Vector4(box.halfWidth, box.bottom, box.height, 0)) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: three.DoubleSide,
  })
  material.customProgramCacheKey = () => '|impostor'
  const mesh = new three.Mesh(geometry, material) as unknown as THREE_NS.Mesh & { count: number }
  Object.defineProperty(mesh, 'count', { get: () => geometry.instanceCount, set: (value: number) => (geometry.instanceCount = value) })
  mesh.frustumCulled = false
  mesh.name = 'impostors'
  let count = 0
  return {
    mesh,
    material,
    get count() {
      return count
    },
    begin() {
      count = 0
    },
    push({ a, scale, silhouette, y = 0, c, color, d }) {
      if (count >= max) return
      const index = count++
      attributes.iA!.array.set(a, index * 4)
      attributes.iB!.array.set([scale[0], scale[1], silhouette, y], index * 4)
      attributes.iC!.array.set(c, index * 4)
      attributes.iCol!.array.set([color.r, color.g, color.b], index * 3)
      attributes.iD!.array.set(d ?? [0, 0, 0, 0], index * 4)
    },
    end() {
      geometry.instanceCount = count
      // three uploads every attribute flagged, drawn or not: an empty batch would send one empty upload per attribute each frame
      if (count === 0) return
      for (const attribute of Object.values(attributes)) {
        attribute.clearUpdateRanges()
        attribute.addUpdateRange(0, count * attribute.itemSize)
        attribute.needsUpdate = true
      }
    },
  }
}
