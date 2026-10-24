import type * as THREE from 'three'
import type { ModelKit } from './kit'
import { heatify } from './kit'
import type { Material, PistolSize, PistolStyle } from './pistol-style'
import type { ModelOptions, ModelParts } from './types'

const PI = Math.PI

/** The slide: its body by style, serrations, ejection port, barrel tip, sights and the small controls that ride on it. */
export function buildSlide(kit: ModelKit, slide: THREE.Group, parts: ModelParts, options: ModelOptions, style: PistolStyle, size: PistolSize, metal: Material): void {
  const { M, box, cylinderX } = kit
  const { length: L, width: w } = size
  const slideHeight = style.inset ? size.height * 0.92 : size.height
  const slideWidth = style.inset ? w * 0.86 : w
  kit.roundness = style.rf
  if (style.tri) box(slide, L * 0.42, slideHeight, slideWidth, metal, L * 0.21, 0, 0)
  else if (style.open) {
    box(slide, L * 0.45, slideHeight, slideWidth, metal, L * 0.225, 0, 0)
    box(slide, L * 0.55, slideHeight * 0.62, slideWidth, metal, L * 0.72, -slideHeight * 0.19, 0)
  } else box(slide, L, slideHeight, slideWidth, metal, L / 2, 0, 0)
  if (style.slope) box(slide, L * 0.25, slideHeight * 0.5, slideWidth * 0.98, metal, L * 0.86, slideHeight * 0.35, 0, -0.22)
  kit.roundness = null
  for (let i = 0; i < (style.flush ? 9 : 7); i++) box(slide, 0.0022, slideHeight * 0.72, slideWidth + 0.0014, M.dark, 0.007 + i * 0.0052, -0.002, 0, 0)
  if (style.frontSer) for (let i = 0; i < 5; i++) box(slide, 0.0022, slideHeight * 0.6, slideWidth + 0.0014, M.dark, L * 0.76 + i * 0.0052, -0.003, 0)
  if (style.port) {
    box(slide, L * style.port, 0.004, slideWidth * 0.55, M.hole, L * 0.6, slideHeight / 2 - 0.001, slideWidth * 0.12)
    box(slide, L * style.port * 0.85, 0.003, slideWidth * 0.4, M.steelL, L * 0.6, slideHeight / 2 - 0.0004, slideWidth * 0.1)
    box(slide, 0.012, 0.004, 0.002, M.dark, L * 0.55, slideHeight * 0.15, slideWidth / 2 + 0.0008)
  }
  if (style.open) {
    heatify(parts.glow, cylinderX(slide, 0.0062, L * 0.56, M.steelL, L * 0.7, slideHeight * 0.12, 0, 18))
    box(slide, 0.03, 0.004, slideWidth * 0.6, M.hole, L * 0.48, slideHeight / 2 - 0.001, 0)
  }
  if (style.tri) {
    const tube = new kit.THREE.Mesh(new kit.THREE.CylinderGeometry(0.016, 0.016, L * 0.6, 3), metal)
    tube.castShadow = tube.receiveShadow = true
    tube.rotation.set(0, 0, -PI / 2)
    tube.rotateY(PI / 6)
    tube.position.set(L * 0.7, slideHeight * 0.08, 0)
    slide.add(tube)
    heatify(parts.glow, tube)
    box(slide, L * 0.6, 0.006, 0.012, metal, L * 0.7, slideHeight * 0.38, 0)
    for (let i = 0; i < 6; i++) box(slide, 0.008, 0.003, 0.013, M.hole, L * 0.45 + i * 0.04, slideHeight * 0.41, 0)
  }
  if (style.bushing) {
    heatify(parts.glow, cylinderX(slide, 0.0078, 0.006, M.steelL, L + 0.002, 0.001, 0, 18))
    cylinderX(slide, 0.0045, 0.004, M.steel, L + 0.002, -0.012, 0, 12)
  }
  const muzzleY = style.tri ? slideHeight * 0.08 : 0.002
  heatify(parts.glow, cylinderX(slide, style.tri ? 0.0072 : 0.0062, 0.004, M.dark, L + 0.0015, muzzleY, 0, 18))
  cylinderX(slide, 0.0034, 0.005, M.hole, L + 0.0025, muzzleY, 0, 12)
  const top = slideHeight / 2
  if (style.sight === 'u' || style.sight === '3dot') {
    box(slide, 0.004, 0.007, 0.004, M.dark, L - 0.008, top + 0.0035, 0)
    box(slide, 0.0022, 0.0022, 0.0046, M.white, L - 0.008, top + 0.0058, 0)
    box(slide, 0.008, 0.007, 0.016, M.dark, 0.009, top + 0.0035, 0)
    if (style.sight === 'u') box(slide, 0.004, 0.002, 0.0122, M.white, 0.009, top + 0.006, 0)
    else box(slide, 0.0022, 0.0022, 0.0166, M.white, 0.009, top + 0.0058, 0)
  } else {
    box(slide, 0.006, 0.004, 0.003, M.dark, L - 0.006, top + 0.002, 0)
    box(slide, 0.006, 0.004, 0.012, M.dark, 0.008, top + 0.002, 0)
  }
  if (style.decock === 'slide') {
    box(slide, 0.012, 0.008, 0.004, M.dark, 0.02, slideHeight * 0.15, slideWidth / 2 + 0.002, 0.3)
    box(slide, 0.012, 0.008, 0.004, M.dark, 0.02, slideHeight * 0.15, -slideWidth / 2 - 0.002, 0.3)
  }
  if (style.safety === 'slide') parts.safety = box(slide, 0.012, 0.008, 0.004, M.dark, 0.018, slideHeight * 0.1, -slideWidth / 2 - 0.002, 0.2)
  if (options.sel) {
    const selector = box(slide, 0.01, 0.008, 0.003, M.dark, 0.014, -slideHeight * 0.2, slideWidth / 2 + 0.0014)
    parts.safety ??= selector
  }
}

