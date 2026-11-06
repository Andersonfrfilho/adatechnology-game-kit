// What the test pages publish on `window` for the scripts that drive them (Playwright `page.evaluate`): the room, its three.js and the
// reports each area writes. Read by tsconfig.scripts.json only.
import type { TestRoom } from '@adatechnology/game-test-room'
import type * as THREE from 'three'

declare global {
  interface Window {
    /** The test room once its content is loaded (`examples/test-room/src/main.js`). */
    __testRoom: TestRoom
    /** The room of a deferred page, before its areas are open. */
    __bootRoom?: TestRoom
    __THREE: typeof THREE
  }
}
export {}
