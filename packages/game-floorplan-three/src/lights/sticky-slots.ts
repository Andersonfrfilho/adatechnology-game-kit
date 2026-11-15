/** How much nearer, in metres, a light that already holds a slot counts than one that does not: a room must be clearly nearer to take the slot. */
export const STICKY_SLOT_BONUS = 2.5

/**
 * Seats the chosen lights (nearest first) in the budget's slots without moving the ones already seated: a light keeps the slot it had, as long as that slot
 * is of the same kind (the first `shadowSlots` cast shadows), so a shadow map is not redrawn and a room's light does not jump slots while the player walks.
 */
export function seatLights<T>(chosen: readonly T[], keyOf: (light: T) => string, previous: readonly (string | undefined)[], slots: number, shadowSlots: number): (T | undefined)[] {
  const seats: (T | undefined)[] = new Array(slots).fill(undefined)
  const unseated: T[] = []
  chosen.slice(0, slots).forEach((light, rank) => {
    const was = previous.indexOf(keyOf(light))
    const sameKind = was >= 0 && was < slots && (was < shadowSlots) === (rank < shadowSlots)
    if (sameKind && seats[was] === undefined) seats[was] = light
    else unseated.push(light)
  })
  for (const light of unseated) {
    const rank = chosen.indexOf(light)
    const wantsShadow = rank < shadowSlots
    const free = seats.findIndex((seat, i) => seat === undefined && (i < shadowSlots) === wantsShadow)
    const any = free >= 0 ? free : seats.findIndex((seat) => seat === undefined)
    if (any >= 0) seats[any] = light
  }
  return seats
}
