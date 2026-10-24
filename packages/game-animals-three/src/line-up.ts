import { lineUpLength } from '@adatechnology/game-animals'

import type { AnimalRig } from './types'

export type LineUpOptions = {
  /** X where the row starts (page: -19). */
  readonly start?: number
  /** Gap between animals (page: 0.85). */
  readonly gap?: number
  /** Heading of the animals, radians (page: 1.1; snakes 2.2). */
  readonly yaw?: number
  readonly snakeYaw?: number
}

/** Puts the animals in a row on the x axis, each given room by its length, the row centred on the origin, and keeps each place as `home` (page: the line-up). */
export const lineUpAnimals = (rigs: readonly AnimalRig[], options: LineUpOptions = {}): void => {
  const start = options.start ?? -19
  const gap = options.gap ?? 0.85
  let cursor = start
  for (const rig of rigs) {
    const length = lineUpLength(rig.species.body)
    cursor += length / 2
    rig.root.position.set(cursor, 0, 0)
    rig.home = rig.root.position.clone()
    rig.root.rotation.y = rig.species.body.kind === 'snake' ? (options.snakeYaw ?? 2.2) : (options.yaw ?? 1.1)
    cursor += length / 2 + gap
  }
  const offset = -(cursor - gap + start) / 2
  for (const rig of rigs) {
    rig.root.position.x += offset
    rig.home.x += offset
  }
}
