import type { FilmAdvanceInput, FilmBounds, FilmField, FilmLayout, FilmProfile, FilmSimulator, FilmWeather } from './types'

export interface CpuSimulatorOptions {
  /** Flow steps per second of real time (the pages use 180). */
  stepRate: number
  /** Most flow steps in one advance (6 in the Fluid Standard, 9 in the Workshop). */
  maxSteps: number
  weather: () => FilmWeather
}

const RAIN_SPREAD = 0.5
const BOUNDS_MARGIN = 8

/**
 * The thin-film step of the Fluid Standard (F94-114), literal: only film above the pin moves, a dry cell needs the front thickness,
 * walls run sideways at 0.22 and the flow is limited to the wet bounding box. Drying starts from the thin edge.
 */
export function createCpuSimulator(field: FilmField, layout: FilmLayout, profileOf: () => FilmProfile, options: CpuSimulatorOptions): FilmSimulator {
  const { width, height, thickness, dryness, dampness } = field
  const { bed, pin: pinning, vertical } = layout
  const delta = new Float32Array(width * height)
  const bounds: FilmBounds = { firstRow: 0, lastRow: -1, firstColumn: 0, lastColumn: -1 }
  let accumulated = 0

  function refreshBounds(): void {
    let firstRow = height
    let lastRow = -1
    let firstColumn = width
    let lastColumn = -1
    for (let row = 0; row < height; row++) {
      const offset = row * width
      let isWet = false
      for (let column = 0; column < width; column++) {
        if (thickness[offset + column]! > 0) {
          isWet = true
          if (column < firstColumn) firstColumn = column
          if (column > lastColumn) lastColumn = column
        }
      }
      if (isWet) {
        if (row < firstRow) firstRow = row
        lastRow = row
      }
    }
    if (lastRow < 0) {
      bounds.firstRow = 0
      bounds.lastRow = -1
      bounds.firstColumn = 0
      bounds.lastColumn = -1
      return
    }
    bounds.firstRow = Math.max(0, firstRow - BOUNDS_MARGIN)
    bounds.lastRow = Math.min(height - 1, lastRow + BOUNDS_MARGIN)
    bounds.firstColumn = Math.max(0, firstColumn - BOUNDS_MARGIN)
    bounds.lastColumn = Math.min(width - 1, lastColumn + BOUNDS_MARGIN)
  }

  const mobility = (index: number): number => {
    const dry = dryness[index]!
    return dry < 0.25 ? 1 : dry > 0.6 ? 0 : 1 - (dry - 0.25) / 0.35
  }

  function flowStep(): void {
    const { firstRow, lastRow, firstColumn, lastColumn } = bounds
    if (lastRow < 0) return
    const profile = profileOf()
    const flow = profile.flow * (1 + RAIN_SPREAD * options.weather().rain)
    const referenceSquared = profile.referenceThickness * profile.referenceThickness
    const slopeCap = profile.slopeCap
    const pinLevel = profile.pin
    const front = profile.front
    for (let row = firstRow; row <= lastRow; row++) {
      const offset = row * width
      for (let column = firstColumn; column <= lastColumn; column++) delta[offset + column] = 0
    }
    for (let row = firstRow; row <= lastRow; row++) {
      const offset = row * width
      for (let column = firstColumn; column <= lastColumn; column++) {
        const index = offset + column
        const own = thickness[index]!
        for (let edge = 0; edge < 2; edge++) {
          let neighbour: number
          if (edge === 0) {
            if (column >= lastColumn) continue
            neighbour = index + 1
          } else {
            if (row >= lastRow) continue
            neighbour = index + width
          }
          const other = thickness[neighbour]!
          if (own < 0.005 && other < 0.005) continue
          let bedDrop = bed[index]! - bed[neighbour]!
          if (bedDrop > slopeCap) bedDrop = slopeCap
          else if (bedDrop < -slopeCap) bedDrop = -slopeCap
          let head = bedDrop + own - other
          let source = index
          let destination = neighbour
          if (head < 0) {
            head = -head
            source = neighbour
            destination = index
          }
          const sourceThickness = thickness[source]!
          const verticalFactor = vertical[source]!
          const pinThreshold = pinLevel * pinning[source]! * (verticalFactor < 1 ? 0.5 : 1)
          if (sourceThickness <= pinThreshold) continue
          if (thickness[destination]! < 0.03 && sourceThickness < front * pinning[source]! * verticalFactor) continue
          const mobile = mobility(source)
          if (mobile <= 0) continue
          let moved = flow * mobile * ((sourceThickness * sourceThickness) / (sourceThickness * sourceThickness + referenceSquared)) * head * (verticalFactor < 1 ? (edge === 0 ? 0.22 : 1) : 4)
          const limit = (sourceThickness - pinThreshold) * 0.24
          if (moved > limit) moved = limit
          delta[source]! -= moved
          delta[destination]! += moved
        }
      }
    }
    for (let row = firstRow; row <= lastRow; row++) {
      const offset = row * width
      for (let column = firstColumn; column <= lastColumn; column++) {
        const index = offset + column
        let next = thickness[index]! + delta[index]!
        if (next < 1e-4) next = 0
        else dampness[index] = 1
        thickness[index] = next
      }
    }
  }

  function age(dryingSeconds: number): void {
    const { firstRow, lastRow, firstColumn, lastColumn } = bounds
    if (lastRow < 0) return
    const profile = profileOf()
    const rainScale = 1 - options.weather().rain
    const seconds = dryingSeconds * rainScale * (options.weather().drying ?? 1)
    for (let row = firstRow; row <= lastRow; row++) {
      const offset = row * width
      for (let column = firstColumn; column <= lastColumn; column++) {
        const index = offset + column
        const own = thickness[index]!
        if (own > 0) {
          const thin = 1 - Math.min(1, own / 1.6)
          if (profile.dryTime > 0 && dryness[index]! < 1) dryness[index] = Math.min(1, dryness[index]! + (seconds / profile.dryTime) * (0.45 + 1.7 * thin))
          if (profile.evaporation > 0) {
            const next = own - profile.evaporation * seconds * (0.5 + 1.5 * thin)
            thickness[index] = next > 0.004 ? next : 0
          }
        } else if (dampness[index]! > 0) {
          dampness[index] = Math.max(0, dampness[index]! - seconds / (profile.evaporation > 0 ? 25 : 1e9))
        }
      }
    }
  }

  return {
    bounds,
    refreshBounds,
    advance({ dt, dryingSeconds }: FilmAdvanceInput): number {
      accumulated += dt
      let steps = 0
      refreshBounds()
      while (accumulated >= 1 / options.stepRate && steps < options.maxSteps) {
        flowStep()
        accumulated -= 1 / options.stepRate
        steps++
      }
      if (steps === options.maxSteps) accumulated = 0
      age(dryingSeconds)
      return steps
    },
    resetClock() {
      accumulated = 0
    },
  }
}
