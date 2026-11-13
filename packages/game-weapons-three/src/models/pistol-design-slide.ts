import type * as THREE from 'three'
import type { ModelKit } from './kit'
import { heatify } from './kit'
import type { DesignName, PistolDesign } from './pistol-design-config'
import type { ModelParts } from './types'

/** The slide of a design: body, serrations, ejection port, barrel tip, sights and the cuts that tell the pistols apart. */
export function buildDesignSlide(kit: ModelKit, slide: THREE.Group, parts: ModelParts, name: DesignName, design: PistolDesign, length: number): void {
  const { M, box, cylinderX } = kit
  const { slideHeight: sh, slideWidth: sw } = design
  kit.roundness = design.slideRoundness
  box(slide, length, sh, sw, M.metal, length / 2, 0, 0)
  kit.roundness = null
  for (let i = 0; i < design.rearSerrations; i++) box(slide, 0.0022, sh * 0.78, sw + 0.0014, M.dark, 0.008 + i * 0.0056, -0.001, 0, design.rearSerrationTilt)
  for (let i = 0; i < design.frontSerrations; i++) box(slide, 0.0022, sh * 0.62, sw + 0.0014, M.dark, length * 0.74 + i * 0.0052, -0.001, 0)
  box(slide, length * 0.16, 0.004, sw * 0.55, M.hole, length * 0.6, sh / 2, sw * 0.12)
  box(slide, length * 0.13, 0.003, sw * 0.4, M.steelL, length * 0.6, sh / 2 + 0.0025, sw * 0.1)
  if (name === 'p320') {
    box(slide, 0.012, sh * 0.38, sw + 0.001, M.dark, length - 0.012, -sh * 0.05, 0, 0.5)
    box(slide, 0.006, 0.003, sw * 0.8, M.dark, length - 0.003, sh / 2 - 0.001, 0, -0.5)
  }
  if (name === 'usp') {
    box(slide, length * 0.94, 0.0012, sw + 0.001, M.dark, length / 2, -sh * 0.18, 0)
    box(slide, length * 0.5, 0.002, sw + 0.001, M.steelL, length * 0.4, sh * 0.34, 0)
  }
  if (name === 'p99') {
    box(slide, length * 0.3, 0.0045, sw + 0.001, M.hole, length * 0.3, sh * 0.2, 0)
    box(slide, 0.016, 0.003, 0.009, M.steelL, length * 0.52, sh / 2 + 0.0004, 0)
    box(slide, length * 0.34, sh * 0.8, sw + 0.004, M.metal, length * 0.81, -sh * 0.02, 0)
  }
  heatify(parts.glow, cylinderX(slide, 0.0062, 0.004, M.dark, length + 0.0015, 0.002, 0, 18))
  cylinderX(slide, 0.0034, 0.005, M.hole, length + 0.0025, 0.002, 0, 12)
  const top = sh / 2
  box(slide, 0.004, 0.007, 0.004, M.dark, length - 0.008, top + 0.0035, 0)
  box(slide, 0.0022, 0.0022, 0.0046, M.white, length - 0.008, top + 0.0058, 0)
  box(slide, 0.008, 0.007, 0.016, M.dark, 0.009, top + 0.0035, 0)
  box(slide, 0.0022, 0.0022, 0.0166, M.white, 0.009, top + 0.0058, 0)
}
