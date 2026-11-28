import { PLAYER_RADIUS } from './locomotion'

/** Standing height of the player's body the debris pieces stop against, metres (the head of a grown person). */
const PLAYER_BODY_HEIGHT = 1.75

/** The part of the effects world the room turns the touch of the debris pieces on in (`WorkshopEngine.setDebrisContacts` of `game-vfx`). */
interface DebrisWorkshop {
  setDebrisContacts(obstacles: (() => readonly { x: number; z: number; bottom: number; top: number; radius: number }[]) | null): void
}

/**
 * The chips, flakes and slivers of a shot (a wall, a car) pile on each other and stop at the player, who pushes them walking through: the player's body is
 * an upright cylinder read where the player stands each frame (one object, no allocation a frame).
 */
export function bindDebrisToPlayer(workshop: DebrisWorkshop, player: { readonly position: readonly number[] }): void {
  const body = { x: 0, z: 0, bottom: 0, top: 0, radius: PLAYER_RADIUS }
  const bodies = [body]
  workshop.setDebrisContacts(() => {
    const [x = 0, y = 0, z = 0] = player.position
    body.x = x
    body.z = z
    body.bottom = y
    body.top = y + PLAYER_BODY_HEIGHT
    return bodies
  })
}
