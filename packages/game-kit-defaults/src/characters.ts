import { ATTACK_CLIPS, FIRST_PERSON_CLIPS } from '@adatechnology/game-characters-people'

/** The strike and first-person clips of `game-characters-people`, as the options `toRoomAvatar` of `game-characters-three` takes (`strikeClips`, `firstPersonClips`). */
export function defaultCharacterClips(): { strikeClips: typeof ATTACK_CLIPS; firstPersonClips: typeof FIRST_PERSON_CLIPS } {
  return { strikeClips: ATTACK_CLIPS, firstPersonClips: FIRST_PERSON_CLIPS }
}
