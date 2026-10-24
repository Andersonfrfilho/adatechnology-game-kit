import type { Three, THREE_NS } from '../three'

import { createBodyChunk } from './body-chunk'
import type { BodyChunkOptions } from './body-chunk'

export type BodyMaterialParams = {
  /** The depth material for shadows (true) or the lit body (false). */
  readonly depth?: boolean
  /** The shared clock the shader reads (`uTime`): `{ value }` the host advances once per frame. */
  readonly time: { value: number }
  readonly chunk?: BodyChunkOptions
}

/**
 * The instanced body's material: the pose chunk in the vertex shader and the per-instance tints (skin by tone and infection, shirt, pants, hair,
 * glowing eyes) in the fragment shader (G 65473 `bodyMaterial`).
 */
export const createBodyMaterial = (three: Three, { depth = false, time, chunk }: BodyMaterialParams): THREE_NS.Material => {
  const bodyChunk = createBodyChunk(chunk)
  const material = depth ? new three.MeshDepthMaterial({ depthPacking: three.RGBADepthPacking }) : new three.MeshLambertMaterial({ color: 0xffffff })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
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
    if (!depth) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTint; varying float vGlow;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = vTint;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n if (vGlow > 0.5) gl_FragColor = vec4(vTint*0.0 + gl_FragColor.rgb*0.0 + EYE*2.4, 1.);')
      shader.vertexShader = shader.vertexShader.replace('varying vec3 vTint;', 'varying vec3 vTint; varying vec3 vEyeC;').replace('vGlow = mat==3.', 'vEyeC = iEye; vGlow = mat==3.')
      shader.fragmentShader = shader.fragmentShader.replace('varying vec3 vTint;', 'varying vec3 vTint; varying vec3 vEyeC;').replace('EYE', 'vEyeC')
    }
  }
  return material
}
