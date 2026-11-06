import type { ModelKit } from './kit'
import { buildDesignGrip } from './pistol-design-grip'
import type { DesignName } from './pistol-design-config'
import { PISTOL_DESIGNS } from './pistol-design-config'
import { buildDesignSlide } from './pistol-design-slide'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

/** A modern polymer pistol drawn as its photo: slide, rail, grip, guard, trigger and the hammer of the ones that have one. Used by the weapons that name a `design`. */
export function buildDesignedPistol(kit: ModelKit, options: ModelOptions, name: DesignName): BuiltModel {
  const { M, box } = kit
  const design = PISTOL_DESIGNS[name]
  const length = ((options.L ?? 0) / 1000) * 0.97
  const { slideHeight: sh, slideWidth: sw } = design
  const group = kit.group()
  const parts: ModelParts = { family: 'pistol', kick: 0.6, glow: [] }
  const slide = kit.pivot(group)
  parts.slide = slide
  parts.stroke = length * 0.15
  buildDesignSlide(kit, slide, parts, name, design, length)
  const frameMaterial = design.frameFinish === 'olive' ? M.olive : design.frameFinish === 'tan' ? M.tan : M.poly
  kit.roundness = 0.1
  box(group, length * 0.9, 0.019, sw * 0.94, frameMaterial, length * 0.5, -sh / 2 - 0.0085, 0)
  box(group, length * 0.34, 0.012, sw * 0.94, frameMaterial, length * 0.82, -sh / 2 - 0.0165, 0)
  kit.roundness = null
  if (design.railSlots) for (let i = 0; i < design.railSlots; i++) box(group, 0.004, 0.003, sw * 0.96, M.dark, length * 0.8 + i * 0.0085, -sh / 2 - 0.0235, 0)
  if (name === 'usp') box(group, length * 0.34, 0.003, sw * 0.94 + 0.001, M.dark, length * 0.74, -sh / 2 - 0.0125, 0)
  if (name === 'p99') for (let i = 0; i < 3; i++) box(group, length * 0.26, 0.0022, sw * 0.94 + 0.001, M.dark, length * 0.8, -sh / 2 - 0.0095 - i * 0.0045, 0)
  box(group, 0.03, 0.007, sw * 0.9, frameMaterial, 0.012, -sh / 2 - 0.001, 0, 0.12)
  const guardFrontX = length - design.guardFront
  const guardBackX = guardFrontX - design.guardLength
  const guardBottom = -sh / 2 - design.guardDrop
  const frontAt = buildDesignGrip(kit, group, parts, design, frameMaterial, { x: guardBackX, y: guardBottom + 0.004 })
  const postTop = -sh / 2 - 0.02
  box(group, design.guardLength + 0.006, 0.005, 0.009, frameMaterial, (guardFrontX + guardBackX) / 2, guardBottom, 0)
  box(group, 0.005, postTop - guardBottom, 0.009, frameMaterial, guardFrontX, (postTop + guardBottom) / 2, 0, design.guardHook ? 0.16 : 0)
  if (design.guardHook) box(group, 0.01, 0.005, 0.009, frameMaterial, guardFrontX + 0.003, guardBottom + 0.002, 0, 0.35)
  const triggerX = frontAt(guardBottom + 0.02) + 0.014
  parts.trigger = box(group, 0.004, 0.018, 0.005, M.steel, triggerX, guardBottom + 0.02, 0, 0.3)
  box(group, 0.016, 0.004, 0.004, M.dark, triggerX - 0.012, -sh / 2 - 0.006, sw / 2 + 0.0014)
  box(group, 0.016, 0.004, 0.004, M.dark, triggerX - 0.012, -sh / 2 - 0.006, -sw / 2 - 0.0014)
  parts.safety = box(group, 0.01, 0.006, 0.004, M.dark, triggerX - 0.03, -sh / 2 - 0.0035, sw / 2 + 0.0016)
  box(group, 0.01, 0.006, 0.004, M.dark, triggerX - 0.03, -sh / 2 - 0.0035, -sw / 2 - 0.0016)
  if (design.hasHammer) {
    const hammer = kit.pivot(group, 0.002, sh * 0.1, 0)
    parts.hammer = hammer
    box(hammer, 0.014, 0.012, 0.008, M.dark, -0.006, 0.002, 0, 0.5)
    box(hammer, 0.01, 0.006, 0.012, M.dark, -0.011, 0.008, 0, 0.5)
  }
  parts.muzzle = kit.mark(group, length + 0.006, 0.002, 0)
  parts.eject = kit.mark(group, length * 0.6, sh / 2, sw * 0.25)
  return { group, parts }
}
