import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createSurfaceMaterial } from '../src'

/** The fragment shader the ground's material ends up with. */
function fragmentOf(): string {
  const material = createSurfaceMaterial(THREE)
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} }
  material.onBeforeCompile(shader as never, undefined as never)
  return shader.fragmentShader
}

describe('the ground seen from afar', () => {
  it('measures how much ground a pixel covers and draws only the average of a pattern finer than that', () => {
    const fragment = fragmentOf()
    expect(fragment).toMatch(/tsPixel = max\(length\(dFdx\(xz\)\), length\(dFdy\(xz\)\)\)/)
    expect(fragment).toContain('smoothstep(FAR_PIXEL_FROM, FAR_PIXEL_TO, tsPixel)')
  })

  it('draws a joint no thinner than a pixel, and paler as much as it was widened, so it does not break into dots', () => {
    expect(fragmentOf()).toMatch(/float drawn = max\(width, tsPixel\);[\s\S]*\* \(width \/ drawn\)/)
  })
})
