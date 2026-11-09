import type { VfxWorld } from '@adatechnology/game-vfx'

/**
 * The effects world as the renderer emits into it: every sprite, fire and explosion made while `current()` names an object carries that object as its
 * `source` (unless the call gave one), so `VfxWorld.clearSource` can take them away when the object leaves. Everything else reads through to `vfx`.
 */
export function stampSource(vfx: VfxWorld, current: () => string | undefined): VfxWorld {
  const stamped = Object.create(vfx) as VfxWorld
  stamped.burst = (kind, point, normal, count, speed, options) => {
    const source = current()
    vfx.burst(kind, point, normal, count, speed, source === undefined || options?.source !== undefined ? options : { ...options, source })
  }
  stamped.spawn = (kind, point, velocity, options) => {
    const source = current()
    vfx.spawn(kind, point, velocity, source === undefined || options?.source !== undefined ? options : { ...options, source })
  }
  stamped.explosion = (id, point, options) => {
    const source = current()
    return vfx.explosion(id, point, source === undefined || options?.source !== undefined ? options : { ...options, source })
  }
  stamped.fire = (options) => {
    const source = current()
    return vfx.fire(source === undefined || options.source !== undefined ? options : { ...options, source })
  }
  return stamped
}
