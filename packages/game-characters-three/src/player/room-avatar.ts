import type { PlayerAvatar } from './avatar'
import type { THREE_NS } from '../three'

/** What `@adatechnology/game-test-room` calls a `RoomAvatar`, restated here so this package does not depend on the room. */
export type RoomAvatarLike = {
  root: THREE_NS.Object3D
  update(dt: number, state: { speed: number; running: boolean; crouch: boolean; down: boolean; armed: boolean; pitch: number }): void
  hand(side: 'R' | 'L'): THREE_NS.Object3D
  /** The avatar it wraps. */
  readonly avatar: PlayerAvatar
}

/**
 * Fits the player's body to the test room's `RoomAvatar` (`room.setAvatar(toRoomAvatar(createPlayerAvatar(THREE)))`). The one thing it changes is the sign of the pitch: the room
 * counts a look up as positive, the team game's `view.pitch` (what `AvatarUpdate.pitch` reads) counts a look down as positive.
 */
export const toRoomAvatar = (avatar: PlayerAvatar): RoomAvatarLike => ({
  root: avatar.root,
  avatar,
  update: (dt, state) => avatar.update(dt, { speed: state.speed, running: state.running, crouch: state.crouch, down: state.down, armed: state.armed, pitch: -state.pitch }),
  hand: (side) => avatar.hand(side),
})
