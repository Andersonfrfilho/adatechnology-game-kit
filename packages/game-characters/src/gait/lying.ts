/** Prone crawl on the arms (the Elenco's leg-less body): joint targets at `time`; `figTilt` is the body's tilt target, which the caller approaches at `dt · 4`. */
export type CrawlPose = {
  readonly figTilt: number
  readonly hipY: number
  readonly hipZRotation: number
  readonly upper: { readonly x: number; readonly y: number }
  readonly headX: number
  readonly arms: readonly { readonly shoulder: number; readonly shoulderZ: number; readonly elbow: number }[]
  readonly legs: readonly { readonly hip: number; readonly knee: number }[]
}

export const CRAWL_TILT_RATE = 4
export const DEAD_TILT_RATE = 3

export const crawlPose = (time: number, phase: number, sides: readonly [1 | -1, 1 | -1]): CrawlPose => {
  const cycle = time * 2.2 + phase
  const wave = Math.sin(cycle)
  return {
    figTilt: 1.38,
    hipY: 0.2 + Math.abs(wave) * 0.02,
    hipZRotation: wave * 0.05,
    upper: { x: 0, y: wave * 0.12 },
    headX: -0.95,
    arms: sides.map((side) => ({ shoulder: -2.55 + side * wave * 0.45, shoulderZ: side * 0.25, elbow: -0.35 - Math.max(0, -side * wave) * 0.6 })),
    legs: [
      { hip: 0.1, knee: 0 },
      { hip: 0.12 + wave * 0.08, knee: 0.25 },
    ],
  }
}

export type DeadPose = {
  readonly figTilt: number
  readonly hipY: number
  readonly headY: number
  readonly arms: readonly { readonly shoulder: number; readonly shoulderZ: number; readonly elbow: number }[]
  readonly legs: readonly { readonly hip: number; readonly hipZ: number; readonly knee: number }[]
}

/** A body on the ground (the Elenco's death pose); the caller approaches `figTilt` at `dt · 3`. */
export const deadPose = (armSides: readonly [1 | -1, 1 | -1]): DeadPose => ({
  figTilt: -1.45,
  hipY: 0.22,
  headY: 0.5,
  arms: armSides.map((side) => ({ shoulder: -0.2, shoulderZ: side * 1.1, elbow: -0.3 })),
  legs: [-0.15, 0.15].map((hipZ) => ({ hip: 0, hipZ, knee: 0.1 })),
})
