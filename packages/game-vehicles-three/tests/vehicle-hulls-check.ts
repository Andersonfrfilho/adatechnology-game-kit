import * as THREE from 'three'

import { hullVolume, convexFaces, MAX_STANDOFF_INSIDE, MAX_STANDOFF_OUTSIDE, vehicleHulls } from '../src'
import type { VehicleHull } from '../src'
import { build } from './vehicle-colliders-support'
import { RAY_DIRECTIONS, SOLID_CHECKED, compareRays, depthMap, drawnTriangles, frameFor, hullTriangles, solidOf } from './vehicle-hulls-support'

/** H3: the share of rays that meet the drawn shell and also a hull within the band. */
export const COVERAGE = 0.95
/** H5: the hull of a solid part holds at least this share of its drawn volume, and no more than its volume plus this skin (m). */
export const SOLID_VOLUME_SHARE = 0.9
export const SOLID_SKIN = 0.01

export interface HullReport {
  readonly id: string
  readonly hulls: number
  readonly maxPoints: number
  readonly rays: number
  readonly coverage: number
  readonly standingOut: number
  readonly worstOutMetres: number
  readonly phantom: number
  readonly solidChecked: number
  readonly solidFailures: string[]
  readonly hullMs: number
}

/** The hulls of the model made whole and measured against what is drawn: H2 to H6 of the design (10.3). */
export const checkHulls = (id: string): HullReport => {
  const { vehicle, frame, dispose } = build(id)
  try {
    const started = performance.now()
    const hulls: VehicleHull[] = vehicleHulls(THREE, vehicle, frame)
    const hullMs = performance.now() - started
    const root = vehicle.vehicle.vehicle as THREE.Object3D
    const drawn = drawnTriangles(root, frame)
    const solid = hullTriangles(hulls)
    let rays = 0, covered = 0, standingOut = 0, phantom = 0, worstOut = 0
    for (const direction of RAY_DIRECTIONS) {
      const rayFrame = frameFor(direction, [drawn, solid])
      const counts = compareRays(depthMap(drawn, rayFrame), depthMap(solid, rayFrame), MAX_STANDOFF_OUTSIDE, MAX_STANDOFF_INSIDE)
      rays += counts.drawn
      covered += counts.covered
      standingOut += counts.standingOut
      phantom += counts.phantom
      worstOut = Math.max(worstOut, counts.worstOut)
    }
    const solidFailures: string[] = []
    let solidChecked = 0
    for (const part of vehicle.model.parts) {
      if (!SOLID_CHECKED.has(part.role)) continue
      const own = Float32Array.from(vehicle.objectsOf(part.id).flatMap((object) => [...drawnTriangles(object, frame)]))
      const shape = solidOf(own)
      if (!shape || shape.volume < 1e-6) continue
      solidChecked++
      const mine = hulls.filter((hull) => hull.id === part.id)
      let volume = 0
      for (const hull of mine) {
        const faces = convexFaces(hull.points)
        if (faces) volume += hullVolume(hull.points, faces)
      }
      if (volume < SOLID_VOLUME_SHARE * shape.volume || volume > shape.volume + SOLID_SKIN * shape.area) solidFailures.push(`${part.id}: hull ${volume.toFixed(5)} m3 against drawn ${shape.volume.toFixed(5)} m3 (area ${shape.area.toFixed(3)})`)
    }
    return {
      id, hulls: hulls.length, maxPoints: Math.max(0, ...hulls.map((hull) => hull.points.length / 3)), rays, coverage: rays === 0 ? 1 : covered / rays,
      standingOut, worstOutMetres: worstOut, phantom, solidChecked, solidFailures, hullMs,
    }
  } finally {
    dispose()
  }
}
