import { depositBlob, depositCell, depositSplat, depositStroke, wetCellCount } from './deposit'
import type { DepositContext } from './deposit'
import { createDropPool } from './drops'
import { createCpuSimulator } from './simulate'
import { updateDrags, updateDrip, updateSources } from './sources'
import type { Film, FilmField, FilmOptions, FilmProfile, FilmWeather } from './types'

const DEFAULT_STEP_RATE = 180
const DEFAULT_MAX_STEPS = 6

/**
 * A running film of one liquid over one layout: drops land as impacts, a drip, sources and drag smears add to it, and a 180 Hz
 * thin-film step spreads it limited to the wet box, at most `maxSteps` per frame. It never calls `Math.random`: the host gives the random stream.
 */
export function createFilm(options: FilmOptions): Film {
  const { layout, random } = options
  const cellCount = layout.width * layout.height
  const field: FilmField = {
    width: layout.width,
    height: layout.height,
    thickness: new Float32Array(cellCount),
    dryness: new Float32Array(cellCount),
    dampness: new Float32Array(cellCount),
  }
  let weatherState: FilmWeather = { rain: 0 }
  let currentProfile: FilmProfile = options.profile
  const context: DepositContext = { field, random, profile: () => currentProfile }
  const drops = createDropPool(layout, context)
  const createSimulator = options.simulator ?? createCpuSimulator
  const simulator = createSimulator(field, layout, () => currentProfile, {
    stepRate: options.stepRate ?? DEFAULT_STEP_RATE,
    maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
    weather: () => weatherState,
  })

  const film: Film = {
    layout,
    field,
    drops: drops.state,
    bead: { visible: false, position: [0, 0, 0], radius: 0, swell: 0 },
    simulator,
    get profile() {
      return currentProfile
    },
    set profile(profile: FilmProfile) {
      currentProfile = profile
    },
    drip: undefined,
    sources: [],
    drags: [],
    launch: (position, velocity, radius) => drops.launch(position, velocity, radius),
    splat: (row, column, size, directionColumn, directionRow, sinAngle, amount) => depositSplat(context, row, column, size, directionColumn, directionRow, sinAngle, amount),
    blob: (row, column, along, across, directionColumn, directionRow, amount, roughness) => depositBlob(context, row, column, along, across, directionColumn, directionRow, amount, roughness),
    stroke: (fromRow, fromColumn, toRow, toColumn, startWidth, endWidth, amount) => depositStroke(context, fromRow, fromColumn, toRow, toColumn, startWidth, endWidth, amount),
    deposit: (row, column, amount) => depositCell(context, row, column, amount),
    update({ dt, dryingSeconds }) {
      drops.update(dt)
      updateDrip(film.drip, film.bead, layout, random, drops.launch, dt)
      updateSources(film.sources, context, dt)
      updateDrags(film.drags, context, layout, drops.launch, dt)
      simulator.advance({ dt, dryingSeconds })
    },
    setWeather(weather) {
      weatherState = { rain: Math.min(1, Math.max(0, weather.rain ?? weatherState.rain)) }
    },
    weather: () => ({ ...weatherState }),
    clear() {
      field.thickness.fill(0)
      field.dryness.fill(0)
      field.dampness.fill(0)
      drops.clear()
      film.drip = undefined
      film.bead.visible = false
      film.sources.length = 0
      film.drags.length = 0
      simulator.refreshBounds()
    },
    wetCells: () => wetCellCount(field),
  }
  return film
}
