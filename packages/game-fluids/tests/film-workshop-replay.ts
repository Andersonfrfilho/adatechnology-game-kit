import { createSeededRandom, hashText } from '@adatechnology/golden-tool'
import { WORKSHOP_LAYOUT, createFilm, filmProfileOf } from '../src'
import type { Film, FilmProfile, FilmSource } from '../src'
import { Vector } from './film-vector'

/** The Workshop's `fluidos` effect (`site/pages/efeitos/oficina-vfx.html`, W562-744), driven like `vfx-workshop.js --param mode=fluids`. */
export const WORKSHOP_OPTIONS = [
  { liquid: 'blood', dryingSpeed: 50 },
  { liquid: 'motor_oil', dryingSpeed: 1 },
  { liquid: 'fuel', dryingSpeed: 4 },
  { liquid: 'bile', dryingSpeed: 70 },
] as const

export interface WorkshopTrace {
  /** Dripping arm position for each frame (options 0 and 3), as the page computed it. */
  sources: Vector[]
  /** Cumulative `Math.random` calls the page had made at the start of each frame (and after the last). */
  draws: number[]
}

const CELL = 0.0125
const ORIGIN_X = -2.2
const WALL_Z = -4.497
const WALL_ROWS = 160
const FRAME_MS = 1000 / 60
const FRAMES = 600
const PARTICLE_DRAWS = 8
const SHAKE_DRAWS = 3
const HAZE_RATE = 12

interface Timer {
  time: number
  run: () => void
}

const cellOf = (x: number, z: number): [number, number] => [WALL_ROWS + Math.round((z - WALL_Z) / CELL), Math.round((x - ORIGIN_X) / CELL)]

export interface WorkshopReplay {
  film: Film
  /** Runs one option for `FRAMES` frames, calling `onInstant` after the frames the capture sampled. Returns the launches made and the draws counted at each frame start. */
  runOption(option: number, trace: WorkshopTrace, onInstant: (seconds: number, launches: number) => void): { draws: number[] }
}

export function createWorkshopReplay(instants: readonly number[]): WorkshopReplay {
  let drawCount = 0
  let nextRandom: () => number = () => 0
  const random = (): number => {
    drawCount++
    return nextRandom()
  }
  const range = (from: number, to: number): number => from + random() * (to - from)
  const film = createFilm({ layout: WORKSHOP_LAYOUT, profile: filmProfileOf('blood')!, random, maxSteps: 9 })
  let elapsed = 0
  let lastNow = 0
  const launchVector = (position: Vector, velocity: Vector, radius: number): void => film.launch(position.toArray(), velocity.toArray(), radius)
  const skipParticles = (count: number): void => {
    for (let draw = 0; draw < count * PARTICLE_DRAWS; draw++) random()
  }

  function schedule(option: number, timers: Timer[]): void {
    const at = (time: number, run: () => void): void => {
      timers.push({ time, run })
    }
    const addSource = (source: Omit<FilmSource, 'elapsed'> & { elapsed: number }): void => {
      film.sources.push(source)
    }
    if (option === 0 || option === 3) {
      const origin = new Vector(-1.3, 1.42, -3.7)
      const isBile = option === 3
      at(0.3, () => {
        skipParticles(isBile ? 8 : 16)
        if (isBile) {
          for (let drop = 0; drop < 26; drop++) {
            const direction = new Vector(range(-0.3, 0.3), range(-0.18, 0.22), -1).normalize()
            launchVector(origin.clone(), direction.multiplyScalar(range(3, 4.5)), drop < 12 ? range(9, 13) : range(4, 7))
          }
          return
        }
        for (let drop = 0; drop < 220; drop++) {
          const direction = new Vector(range(-0.65, 0.65), range(-0.4, 0.6), -1).normalize()
          launchVector(origin.clone(), direction.multiplyScalar(range(4, 10)), range(0.5, 1.6))
        }
        for (let drop = 0; drop < 110; drop++) {
          const direction = new Vector(range(-0.45, 0.45), range(-0.35, 0.35) + 0.0, -1).normalize()
          const isBig = drop < 8
          launchVector(origin.clone().add(new Vector(range(-0.02, 0.02), range(-0.02, 0.02), 0)), direction.multiplyScalar(isBig ? 5 : range(3, 8)), isBig ? range(5.5, 8.5) : 1 + random() * random() * 4.5)
        }
      })
      at(0.37, () => {
        for (let drop = 0; drop < (isBile ? 10 : 26); drop++) {
          const direction = new Vector(range(-0.6, 0.6), range(0.15, 0.55), -range(0.4, 0.8)).normalize()
          launchVector(origin.clone(), direction.multiplyScalar(range(1.5, 3.5)), isBile ? range(3, 6) : range(1.5, 4))
        }
      })
      const [row, column] = cellOf(-0.32, -3.7)
      addSource({ row, column, rate: isBile ? 320 : 220, elapsed: -2, duration: 12, radius: 3 })
      at(0.6, () => {
        film.drip = { position: [0, 0, 0], every: 0.45, base: 0.45, elapsed: 0, radius: isBile ? 5.5 : 4.4 }
      })
      return
    }
    const [row, column] = cellOf(-1.3, -4.02)
    at(0.1, () => film.blob(row + 8, column + 2, 17, 14, 0.6, 0.8, option === 1 ? 1.3 : 0.7, 0.22))
    addSource({ row, column, rate: option === 1 ? 450 : 700, elapsed: 0, duration: option === 1 ? 18 : 8, radius: 2 })
  }

  return {
    film,
    runOption(option, trace, onInstant) {
      const { liquid, dryingSpeed } = WORKSHOP_OPTIONS[option]!
      drawCount = 0
      nextRandom = createSeededRandom(parseInt(hashText(`fluidos:${option}`), 16))
      film.profile = filmProfileOf(liquid, {})! satisfies FilmProfile
      film.clear()
      film.simulator.resetClock()
      const timers: Timer[] = []
      schedule(option, timers)
      film.simulator.refreshBounds()
      const launchesAtStart = film.drops.launched
      const draws: number[] = []
      const instantFrames = new Map(instants.map((seconds) => [Math.round(seconds * 60), seconds]))
      let timeline = 0
      let hazeAccumulator = 0
      for (let frame = 0; frame < FRAMES; frame++) {
        draws.push(drawCount)
        elapsed += FRAME_MS
        const dt = Math.min(0.05, (elapsed - lastNow) / 1000)
        lastNow = elapsed
        timeline += dt
        for (let index = timers.length - 1; index >= 0; index--) {
          const timer = timers[index]!
          if (timeline < timer.time) continue
          timers.splice(index, 1)
          timer.run()
        }
        if (film.drip && (option === 0 || option === 3)) {
          const source = trace.sources[frame]!
          film.drip.position = [source.x, source.y, source.z]
        }
        film.update({ dt, dryingSeconds: dt * (timeline < 5 ? 3 : dryingSpeed) })
        if (option === 1 && timeline < 16 && random() < dt * 14) launchVector(new Vector(-1.3, 0.3, -4.05), new Vector(range(-0.05, 0.05), -0.2, range(0, 0.1)), range(2, 3.5))
        if (option === 2 && timeline < 12) {
          hazeAccumulator += HAZE_RATE * dt
          while (hazeAccumulator >= 1) {
            hazeAccumulator -= 1
            skipParticles(1)
          }
        }
        for (let draw = 0; draw < SHAKE_DRAWS; draw++) random()
        const seconds = instantFrames.get(frame + 1)
        if (seconds !== undefined) onInstant(seconds, film.drops.launched - launchesAtStart)
      }
      draws.push(drawCount)
      return { draws }
    },
  }
}
