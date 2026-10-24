/** One bird of a flock this frame: where it is, its heading and its roll, its wing phase, and whether it is close enough to draw. */
export type FlockBird = { x: number; y: number; z: number; yaw: number; roll: number; wing: number; visible: boolean }

export type FlockMode =
  /** The vultures (G 66700-66708): circle the centre of the bodies on the ground, each at its own speed, radius and height. */
  | 'carrion'
  /** The birds of the live map (Bancada de Hordas G 53609-53615): a loose ring that rises and falls. */
  | 'orbit'

export type FlockOptions = {
  readonly count: number
  readonly mode: FlockMode
  /** Visible within this distance of the view (carrion 260 m; orbit always). */
  readonly visibleWithin?: number
}

export type Flock = {
  readonly birds: readonly FlockBird[]
  /** Moves the flock to time `t` (seconds) around `center`; `view` decides what is visible. */
  update(t: number, dt: number, center: readonly [number, number], view?: readonly [number, number]): void
}

/** The centre the vultures circle: the mean of the bodies on the ground when there are three or more, else `fallback` (a carcass). */
export const carrionCenter = (corpses: readonly { readonly x: number; readonly z: number }[], fallback: readonly [number, number] | null): [number, number] => {
  let ux = 0
  let uz = 0
  let un = 0
  for (const c of corpses) {
    ux += c.x
    uz += c.z
    un++
  }
  if (un >= 3) return [ux / un, uz / un]
  // as in the game: with one or two bodies and no carcass the sums stay (G 66702)
  return fallback ? [fallback[0], fallback[1]] : [ux, uz]
}

/** A flock of birds by formula: the game's vultures or the live map's ring (literal formulas from the deliveries). */
export function createFlock(options: FlockOptions): Flock {
  const birds: FlockBird[] = Array.from({ length: options.count }, () => ({ x: 0, y: 0, z: 0, yaw: 0, roll: 0, wing: 0, visible: true }))
  const within = options.visibleWithin ?? (options.mode === 'carrion' ? 260 : Infinity)
  return {
    birds,
    update(t, dt, [cx, cz], view) {
      birds.forEach((U, i) => {
        if (options.mode === 'carrion') {
          const a = t * (0.18 + i * 0.04) + i * 2.1
          const r = 7 + i * 2
          U.x = cx + Math.cos(a) * r
          U.y = 16 + i * 2.5
          U.z = cz + Math.sin(a) * r
          U.yaw = -a
          U.roll = 0.35
          U.visible = !view || Math.hypot(cx - view[0], cz - view[1]) < within
          if (U.visible) U.wing += dt * 1.2 * 2 * Math.PI
        } else {
          const a = t * 0.3 + i * 0.4
          const r = 20 + (i % 7) * 4
          U.x = cx + Math.cos(a) * r
          U.y = 25 + Math.sin(t + i) * 2
          U.z = cz + Math.sin(a) * r
          U.yaw = -a
          U.roll = 0
          U.visible = !view || Math.hypot(cx - view[0], cz - view[1]) < within
        }
      })
    },
  }
}
