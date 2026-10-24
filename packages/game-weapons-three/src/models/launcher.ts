import type { ModelKit } from './kit'
import { buildFlamethrower, buildImprovisedFlamethrower } from './launcher-flame'
import { ROCKET_BUILDERS } from './launcher-rocket'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

/** Port of the gallery's `launcher`: the four rocket launchers and the two flamethrowers, picked by `lt`. */
export function buildLauncher(kit: ModelKit, options: ModelOptions): BuiltModel {
  const group = kit.group()
  const type = options.lt ?? ''
  const isFlame = type === 'flame' || type === 'flameDIY'
  const parts: ModelParts = { family: isFlame ? 'flame' : 'rocket', launcherType: type, glow: [] }
  if (type === 'flame') buildFlamethrower(kit, group, parts)
  else if (type === 'flameDIY') buildImprovisedFlamethrower(kit, group, parts)
  else ROCKET_BUILDERS[type]?.(kit, group, parts)
  parts.eject = parts.muzzle
  return { group, parts }
}
