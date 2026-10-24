import type { Vec3 } from '../types'
import { depositCell } from './deposit'
import type { DepositContext } from './deposit'
import type { FilmBead, FilmDrag, FilmDrip, FilmLayout, FilmRandom, FilmSource } from './types'

type Launch = (position: Vec3, velocity: Vec3, radius: number) => void

const range = (random: FilmRandom, from: number, to: number): number => from + random() * (to - from)

/** The drip (F282, W-style): a bead swells at the fingertip, detaches and falls. Updates `bead` for the renderer and returns nothing. */
export function updateDrip(drip: FilmDrip | undefined, bead: FilmBead, layout: FilmLayout, random: FilmRandom, launch: Launch, dt: number): void {
  if (!drip) {
    bead.visible = false
    return
  }
  drip.elapsed += dt
  const swell = Math.min(1, drip.elapsed / drip.every)
  const radius = drip.radius * (0.35 + 0.65 * swell)
  const isWorkshop = layout.rules.dripStyle === 'workshop'
  bead.visible = true
  bead.swell = swell
  bead.radius = radius
  bead.position[0] = drip.position[0]
  bead.position[1] = drip.position[1] + (isWorkshop ? -radius * 0.0012 * (1 + swell * 0.7) : -radius * 0.0012)
  bead.position[2] = drip.position[2]
  if (drip.elapsed < drip.every) return
  const origin: Vec3 = [bead.position[0], bead.position[1] + -radius * 0.001, bead.position[2]]
  if (isWorkshop) {
    const sideX = range(random, -0.025, 0.025)
    const sideZ = range(random, -0.025, 0.025)
    launch(origin, [sideX, -0.2, sideZ], drip.radius * range(random, 0.85, 1.15))
    drip.elapsed = 0
    drip.every = drip.base * range(random, 0.75, 1.25)
    return
  }
  const sideX = (random() - 0.5) * 0.05
  const sideZ = (random() - 0.5) * 0.05
  launch(origin, [sideX, -0.2, sideZ], drip.radius * (0.85 + random() * 0.3))
  drip.elapsed = 0
  drip.every = drip.base * (0.75 + random() * 0.5)
}

/** Continuous sources (a wound at the feet, a tipped can): a pulsing thickness added over a small disc (F288). */
export function updateSources(sources: readonly FilmSource[], context: DepositContext, dt: number): void {
  const random = context.random
  for (const source of sources) {
    source.elapsed += dt
    if (source.elapsed < 0 || source.elapsed > source.duration) continue
    const pulse = 0.6 + 0.4 * Math.max(0, Math.sin(source.elapsed * 5.2))
    const amount = source.rate * dt * pulse
    for (let part = 0; part < 3; part++) {
      const angle = random() * 6.28
      const distance = random() * source.radius
      depositCell(context, source.row + Math.sin(angle) * distance, source.column + Math.cos(angle) * distance, amount / 3)
    }
  }
}

/** Drag smears (F291): a striped band that loses load and crumbles at the end, with side drops stretched along the travel. */
export function updateDrags(drags: readonly FilmDrag[], context: DepositContext, layout: FilmLayout, launch: Launch, dt: number): void {
  const random = context.random
  for (const drag of drags) {
    if (drag.done) continue
    drag.elapsed += dt
    const progress = Math.min(1, drag.elapsed / drag.duration)
    const here = drag.path(progress)
    const ahead = drag.path(Math.min(1, progress + 0.01))
    let directionColumn = ahead.column - here.column
    let directionRow = ahead.row - here.row
    const length = Math.hypot(directionColumn, directionRow) || 1
    directionColumn /= length
    directionRow /= length
    const sideColumn = -directionRow
    const sideRow = directionColumn
    const load = Math.pow(1 - progress, 1.3)
    for (let offset = -drag.width; offset <= drag.width; offset += 0.5) {
      const across = offset / drag.width
      const stripe = drag.stripes[Math.round((offset + drag.width) * 2)]!
      const edge = 1 - across * across
      const amount = drag.amount * load * (0.25 + 0.75 * stripe) * edge
      if (load < 0.45 && random() > load * 2.2) continue
      depositCell(context, Math.round(here.row + sideRow * offset), Math.round(here.column + sideColumn * offset), amount * dt * 30)
    }
    if (drag.hand && random() < dt * 14 * load + 0.02) {
      const world = layout.cellToWorld(here.row, here.column)
      const origin: Vec3 = [world[0] + (random() - 0.5) * 0.06, drag.hand.height + random() * 0.3, world[2] + (random() - 0.5) * 0.06]
      const velocity: Vec3 = [directionColumn * drag.hand.speed, 0 * drag.hand.speed, directionRow * drag.hand.speed]
      velocity[0] += (random() - 0.5) * 0.3
      velocity[1] += 0.2
      velocity[2] += (random() - 0.5) * 0.3
      launch(origin, velocity, 2 + random() * 2.2)
    }
    if (progress >= 1) drag.done = true
  }
}
