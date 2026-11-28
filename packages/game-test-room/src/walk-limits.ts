/** What the walking body of the room steps onto, walks under and kicks out of its way. */

/** Highest top (m above the feet) the player steps onto: low debris; higher stops the walk. */
export const STEP_UP = 0.45
/** Height of the walking body (m): what starts above it is walked under. */
export const BODY_HEIGHT = 1.75
/** Pieces lighter than this (kg) are kicked out of the way instead of stepped on or stopping the player; how high above the feet they still are. */
export const KICK_MASS = 6
export const KICK_HEIGHT = 0.6
/** Restitution of a shoe's sole on what it kicks (rubber on a can, a bottle, a book: about 0.5): a still thing leaves at up to 1.5 times the speed of the walk. */
export const KICK_RESTITUTION = 0.5
