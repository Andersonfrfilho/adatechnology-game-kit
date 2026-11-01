import type { Three, THREE_NS } from '../three'

import { createBodyChunk } from './body-chunk'
import type { BodyChunkOptions } from './body-chunk'
import { SHOE_HEIGHT } from './impostor-atlas'
import type { SegmentClipUniforms } from './segment-clips'
import { ACCESSORY_PIVOT_DECLARATION, FRAGMENT_EXT, createBodyChunkExt } from './body-chunk-ext'

export type BodyMaterialParams = {
  /** The depth material for shadows (true) or the lit body (false). */
  readonly depth?: boolean
  /** The shared clock the shader reads (`uTime`): `{ value }` the host advances once per frame. */
  readonly time: { value: number }
  readonly chunk?: BodyChunkOptions
  /** The distance material the point-light shadow pass reads (`customDistanceMaterial`); the vertices move the same way. */
  readonly distance?: boolean
  /**
   * Adds the identity extension (T4b.7): the `iD` attribute drives the gait style, the stagger, the lean of a shove, the trousers palette and the wound splashes.
   * Off, the shader text is the game's, and the program key is three's own.
   */
  readonly identity?: boolean
  /** The material of an accessory batch: baked once at a reference pivot, moved and scaled per variant by `iAcc` (`vec4`: offset xyz, scale w). Implies `identity`. */
  readonly accessory?: boolean
  /** The clip texture (`createSegmentClipUniforms`), shared by every material that reads it: a body flagged `clips` in its `iD` walks from the clips (T4b.7, step 3). */
  readonly segmentClips?: SegmentClipUniforms
}

const PIVOT_DECLARATION = 'attribute vec3 pivot;'
const PANTS_LINE = 'vec3 pants = iCol*0.45 + vec3(0.08,0.09,0.12);'
const EYE_LINE = 'if (mat==3. && vGlow < 0.5) vTint = vec3(0.08);'
const VERTEX_INSTANCE_POSITION = 'bodyAnim(position, _n)'

/**
 * The instanced body's material: the pose chunk in the vertex shader and the per-instance tints (skin by tone and infection, shirt, pants, hair,
 * glowing eyes) in the fragment shader (G 65473 `bodyMaterial`).
 */
export const createBodyMaterial = (three: Three, { depth = false, distance = false, time, chunk, identity = false, accessory = false, segmentClips }: BodyMaterialParams): THREE_NS.Material => {
  const extended = identity || accessory
  const baseChunk = createBodyChunk(chunk)
  const bodyChunk = (accessory ? baseChunk.replace(PIVOT_DECLARATION, ACCESSORY_PIVOT_DECLARATION) : baseChunk) + (extended ? createBodyChunkExt({ ...chunk, segmentClips: segmentClips !== undefined }) : '')
  const shadowPass = depth || distance
  const material = distance ? new three.MeshDistanceMaterial() : depth ? new three.MeshDepthMaterial({ depthPacking: three.RGBADepthPacking }) : new three.MeshLambertMaterial({ color: 0xffffff })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    if (segmentClips) Object.assign(shader.uniforms, segmentClips)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + bodyChunk)
      .replace(
        '#include <begin_vertex>',
        `
        vec3 _n = normal;
        vec3 transformed = bodyAnim(position, _n);
        transformed *= vec3(iB.y, iB.x, iB.y);
        transformed = rY(iA.z)*transformed + vec3(iA.x, floor(iB.w/16.)/1000. - 2., iA.y);
        // pele: tons brasileiros variados, vai para cinza esverdeado (0x6f7a5c) com a infecção
        vec3 skin = mix(vec3(0.93,0.74,0.6), vec3(0.42,0.27,0.18), iC.w);
        skin = mix(skin, vec3(0.435,0.478,0.36), iC.y);
        vec3 pants = iCol*0.45 + vec3(0.08,0.09,0.12);
        float mat = vcol.w;
        vTint = mat==6. ? vcol.rgb : mat==0. ? skin : mat==1. ? (dot(vcol.rgb, vcol.rgb) > 0. ? mix(iCol, vcol.rgb, 0.3) : iCol) : mat==2. ? pants : mat==4. ? mix(vec3(0.12,0.09,0.07), vec3(0.5), iC.y*0.4) : mat==5. ? vec3(0.13) : vec3(0.9);
        vGlow = mat==3. && dot(iEye, iEye) > 0.01 ? 1. : 0.;
        if (mat==3. && vGlow < 0.5) vTint = vec3(0.08);
        `,
      )
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n { vec3 _nn = objectNormal; bodyAnim(position, _nn); objectNormal = rY(iA.z)*_nn; }')
    if (!shadowPass) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTint; varying float vGlow;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = vTint;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n if (vGlow > 0.5) gl_FragColor = vec4(vTint*0.0 + gl_FragColor.rgb*0.0 + EYE*2.4, 1.);')
      shader.vertexShader = shader.vertexShader.replace('varying vec3 vTint;', 'varying vec3 vTint; varying vec3 vEyeC;').replace('vGlow = mat==3.', 'vEyeC = iEye; vGlow = mat==3.')
      shader.fragmentShader = shader.fragmentShader.replace('varying vec3 vTint;', 'varying vec3 vTint; varying vec3 vEyeC;').replace('EYE', 'vEyeC')
    }
    if (extended) extendShader(shader, { shadowPass, accessory })
  }
  if (extended) material.customProgramCacheKey = () => `|body-ext:${accessory ? 'a' : 'i'}${segmentClips ? 's' : ''}`
  return material
}

type ShaderSource = { vertexShader: string; fragmentShader: string }

/** The replacements of the extension, after the game's: `bodyAnimX` for `bodyAnim`, the palette trousers, the wound varyings and, for an accessory, the variant's pivot and scale. */
const extendShader = (shader: ShaderSource, { shadowPass, accessory }: { readonly shadowPass: boolean; readonly accessory: boolean }): void => {
  const accessoryHead = accessory ? 'pivot = refPivot*iAcc.w + iAcc.xyz; vec3 _p = position*iAcc.w + iAcc.xyz;\n' : ''
  const source = accessory ? '_p' : 'position'
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', accessory ? '#include <common>\nattribute vec4 iAcc;' : '#include <common>')
    .replace(VERTEX_INSTANCE_POSITION, `bodyAnimX(${source}, _n)`)
    .replace('vec3 _n = normal;', `vec3 _n = normal;\n${accessoryHead}`)
    .replace('{ vec3 _nn = objectNormal; bodyAnim(position, _nn);', `{ ${accessoryHead.replace('vec3 _p', 'vec3 _pn')} vec3 _nn = objectNormal; bodyAnimX(${accessory ? '_pn' : 'position'}, _nn);`)
    .replace(PANTS_LINE, 'vec3 pants = trousersOf(iD.y);')
    .replace(EYE_LINE, `${EYE_LINE}\n        if (mat==6. && (bone==4.||bone==5.||bone==9.||bone==10.) && position.y > ${SHOE_HEIGHT}) vTint = mix(vTint, trousersOf(iD.y), 0.75);`)
  if (!shadowPass) {
    shader.vertexShader = shader.vertexShader.replace('vGlow = mat==3.', `vWound = vec4(${accessory ? '0.' : 'woundLevel()'}, idField(iD.x, 4096., 16.)/15., fract(iCol.r*7.31 + iCol.g*3.17 + iCol.b*5.93 + iD.x*0.0013), 0.); vLocal = position; vGlow = mat==3.`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAGMENT_EXT).replace('diffuseColor.rgb = vTint;', 'diffuseColor.rgb = woundTint(vTint);')
  }
}
