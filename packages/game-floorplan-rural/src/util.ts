import type { FloorplanEngine } from '@adatechnology/game-floorplan'

export type CreateRng = FloorplanEngine['createRng']

export const r2 = (x: number): number => Math.round(x * 100) / 100
export const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x))

/** Half the wall thickness: the margin between a room rectangle and its interior. */
export const MARGIN = 0.075

/** Steps of the entrances: one per 0.18 m the floor sits above the ground (a porch door always has at least one). */
export const stepCount = (elevation: number): number => Math.max(1, Math.ceil(elevation / 0.18))

type DoorLike = { b: string; steel?: boolean; type?: string; steps?: number }

/** Gives the ground-floor entrances their steps: the porch doors always, the other outside doors when the floor is above 0.1 m. */
export function withSteps<TDoor extends DoorLike>(doors: TDoor[], elevation: number): TDoor[] {
  for (const door of doors) {
    if (door.b !== 'outside' || door.steel || door.type === 'zip') continue
    if (door.type === 'steps' || elevation > 0.1) door.steps = stepCount(elevation)
  }
  return doors
}
