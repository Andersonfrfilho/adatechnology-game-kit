import { PADRAO_LAYOUT, createFilm, createFilmLcg, filmProfileOf } from '../src'
import type { Film, FilmDrag, FilmProfile, FilmSource } from '../src'
import { Vector } from './film-vector'

/** The Fluid Standard page's scenes and loop (`site/pages/efeitos/padrao-fluidos.html`), driven the way `tools/golden/captures/fluid-standard.js` drives it. */
export const SCENE_KEYS = ['parede', 'fonte', 'pinga', 'arrasto', 'formas'] as const
export const FLUID_KEYS = ['sangue', 'antigo', 'bile', 'oleo', 'gasolina'] as const
export type SceneKey = (typeof SCENE_KEYS)[number]
export type FluidKey = (typeof FLUID_KEYS)[number]

const LIQUID_OF: Record<FluidKey, string> = { sangue: 'blood', antigo: 'old_blood', bile: 'bile', oleo: 'motor_oil', gasolina: 'fuel' }
// The Standard splats every liquid, with the long spikes and its own thickness cap.
const STANDARD_OVERRIDES: Record<FluidKey, Partial<FilmProfile>> = {
  sangue: {},
  antigo: {},
  bile: { spikes: 1, maxAmount: 2.6 },
  oleo: { landsAsBlob: false },
  gasolina: { landsAsBlob: false },
}

const CELL = 0.0125
const WALL_ROWS = 144
const ORIGIN_X = -1.6
const SIDEWALK_Y = 0.15
const FRAME_MS = 1000 / 60
const SPEED = 20

interface TimelineEvent {
  time: number
  run: () => void
  done: boolean
}

export interface StandardReplay {
  film: Film
  /** Starts a scene from its seed formula and steps `frames` frames; returns the launches made since the scene began. */
  runScene(scene: SceneKey, fluid: FluidKey): void
  stepFrames(count: number): void
  launchesSinceScene(): number
}

export function createStandardReplay(): StandardReplay {
  const random = createFilmLcg(1)
  const film = createFilm({ layout: PADRAO_LAYOUT, profile: filmProfileOf('blood')!, random })
  let timeline: TimelineEvent[] = []
  let sceneTime = 0
  let lastNow = 0
  let elapsed = 0
  let launchesAtStart = 0
  let fluid: FluidKey = 'sangue'

  const at = (time: number, run: () => void): void => {
    timeline.push({ time, run, done: false })
  }
  const launch = (position: Vector, velocity: Vector, radius: number): void => film.launch(position.toArray(), velocity.toArray(), radius)
  const randomStripes = (): number[] => Array.from({ length: 64 }, () => Math.pow(random(), 0.7))
  const addSource = (source: Omit<FilmSource, 'elapsed'>): void => {
    film.sources.push({ ...source, elapsed: 0 })
  }
  const addDrag = (drag: Omit<FilmDrag, 'elapsed' | 'done'>): void => {
    film.drags.push({ ...drag, elapsed: 0, done: false })
  }

  const scenes: Record<SceneKey, () => void> = {
    parede() {
      const origin = new Vector(-0.25, 1.3, 0.75)
      at(0.05, () => {
        for (let drop = 0; drop < 220; drop++) {
          const direction = new Vector((random() - 0.5) * 1.3, (random() - 0.4) * 1.0, -1).normalize()
          launch(origin.clone(), direction.multiplyScalar(4 + random() * 6), 0.5 + random() * 1.1)
        }
        for (let drop = 0; drop < 110; drop++) {
          const direction = new Vector((random() - 0.5) * 0.9, (random() - 0.35) * 0.7, -1).normalize()
          const isBig = drop < 7
          launch(origin.clone().add(new Vector((random() - 0.5) * 0.04, (random() - 0.5) * 0.04, 0)), direction.multiplyScalar(isBig ? 5 : 3 + random() * 5), isBig ? 5.5 + random() * 2.5 : 1 + random() * random() * 4.5)
        }
      })
      at(0.12, () => {
        for (let drop = 0; drop < 26; drop++) {
          const direction = new Vector((random() - 0.5) * 1.2, 0.15 + random() * 0.4, -0.4 - random() * 0.4).normalize()
          launch(origin.clone(), direction.multiplyScalar(1.5 + random() * 2), 1.5 + random() * 2.5)
        }
      })
    },
    fonte() {
      const row = WALL_ROWS + Math.round(1.02 / CELL)
      const column = Math.round((0.12 - ORIGIN_X) / CELL)
      if (fluid === 'oleo' || fluid === 'gasolina') {
        const isFuel = fluid === 'gasolina'
        addSource({ row: WALL_ROWS + Math.round(1.0 / CELL), column, rate: isFuel ? 700 : 300, duration: isFuel ? 8 : 20, radius: 2 })
        return
      }
      const isBile = fluid === 'bile'
      addSource({ row: isBile ? row + 4 : row - 2, column, rate: isBile ? 320 : 240, duration: isBile ? 24 : 22, radius: 3 })
    },
    pinga() {
      const isArm = !(fluid === 'oleo' || fluid === 'gasolina')
      film.drip = { position: [-0.47, isArm ? 0.87 : 0.86, 0.45], every: 0.5, base: 0.5, elapsed: 0, radius: 4.4 }
    },
    arrasto() {
      addDrag({
        duration: 5,
        width: 4,
        amount: 1.6,
        stripes: randomStripes(),
        hand: { height: SIDEWALK_Y + 0.55, speed: 0.7 },
        path: (progress) => {
          const x = -1.25 + progress * 2.2
          const z = 0.35 + 0.55 * progress + 0.12 * Math.sin(progress * 5)
          return { row: WALL_ROWS + z / CELL, column: (x - ORIGIN_X) / CELL }
        },
      })
    },
    formas() {
      const row = WALL_ROWS + Math.round(0.55 / CELL)
      for (const [index, angle] of [90, 60, 35, 15].entries()) {
        const x = -1.0 + index * 0.4
        film.splat(row, (x - ORIGIN_X) / CELL, 3.1, 1, 0, Math.sin((angle * Math.PI) / 180), 1.5)
      }
      for (let step = 0; step < 7; step++) {
        const x = 0.65 + step * 0.11
        film.splat(WALL_ROWS + Math.round((0.4 + step * 0.035) / CELL), (x - ORIGIN_X) / CELL, 1.2, 1, 0.3, 0.42, 0.9)
      }
      for (let step = 0; step < 14; step++) {
        const t = step / 13
        const angle = -0.3 + t * 1.9
        const centerX = -0.6 + Math.cos(angle) * 0.55
        const centerY = 1.05 + Math.sin(angle) * 0.5
        film.splat((1.95 - centerY) / CELL, (centerX - ORIGIN_X) / CELL, 1.1, -Math.sin(angle), -Math.cos(angle), 0.3, 0.9)
      }
      for (let step = 0; step < 4; step++) film.splat(Math.round((1.95 - 1.45) / CELL), (0.55 + step * 0.07 - ORIGIN_X) / CELL, 2.4, 0, 1, 1, 1.6)
      const poolRow = WALL_ROWS + Math.round(1.2 / CELL)
      const poolColumn = (-0.9 - ORIGIN_X) / CELL
      film.splat(poolRow, poolColumn, 2.6, 1, 0, 1, 1.3)
      for (let step = 0; step < 10; step++) film.splat(poolRow + (random() - 0.5) * 8, poolColumn + (random() - 0.5) * 8, 1.2 + random() * 1.2, 1, 0, 1, 1)
      addSource({ row: poolRow, column: poolColumn, rate: 40, duration: 6, radius: 2 })
      addDrag({ duration: 1.4, width: 3, amount: 1.5, stripes: randomStripes(), path: (progress) => ({ row: poolRow - 6 + progress * 4, column: (0.05 - ORIGIN_X) / CELL + progress * 48 }) })
    },
  }

  const seedOf = (scene: SceneKey, fluidKey: FluidKey): number => (scene.length * 7919 + fluidKey.length * 104729 + 0 * 31) >>> 0

  return {
    film,
    runScene(scene, fluidKey) {
      fluid = fluidKey
      film.profile = filmProfileOf(LIQUID_OF[fluidKey] as never, STANDARD_OVERRIDES[fluidKey])!
      film.clear()
      timeline = []
      sceneTime = 0
      random.seed = seedOf(scene, fluidKey)
      launchesAtStart = film.drops.launched
      scenes[scene]()
      film.simulator.refreshBounds()
    },
    stepFrames(count) {
      for (let frame = 0; frame < count; frame++) {
        elapsed += FRAME_MS
        const dt = Math.min(0.05, (elapsed - lastNow) / 1000)
        lastNow = elapsed
        sceneTime += dt
        for (const event of timeline) {
          if (event.done || sceneTime < event.time) continue
          event.done = true
          event.run()
        }
        film.update({ dt, dryingSeconds: dt * SPEED })
      }
    },
    launchesSinceScene: () => film.drops.launched - launchesAtStart,
  }
}
