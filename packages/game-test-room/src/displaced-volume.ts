import { partVolume } from '@adatechnology/game-destruction'
import type { DestructibleSpec, ObjectState } from '@adatechnology/game-destruction'

/** A part in one of these states left the body: what it displaced goes with it. */
const LEFT_THE_BODY: ReadonlySet<string> = new Set(['broken', 'melted', 'ashes'])

/**
 * Cubic metres of liquid a body pushes aside when it goes under: the volumes of the parts it still has, as the spec drew them (a hammer is a handle
 * and a head, not the box round the two; a steel wrench is as thin as it is), never more than `boundsVolume`, the box round the piece. Without a spec
 * or a state the box is all there is to go by.
 */
export function displacedVolume(spec: DestructibleSpec | undefined, state: ObjectState | null | undefined, boundsVolume: number): number {
  if (!spec || !state) return boundsVolume
  const present = new Set(state.parts.filter((part) => !LEFT_THE_BODY.has(part.status)).map((part) => part.id))
  let solid = 0
  for (const part of spec.parts) if (present.has(part.id)) solid += partVolume(part.shape)
  return solid > 0 ? Math.min(solid, boundsVolume) : boundsVolume
}
