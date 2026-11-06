// What the test pages publish on `window` for the scripts that drive them (Playwright `page.evaluate`): the room, its three.js and the
// reports each area writes. Read by tsconfig.scripts.json only.
import type { TestRoom } from '@adatechnology/game-test-room'
import type * as THREE from 'three'

declare global {
  /** A node of the page's scene as the scripts read it while they walk it: any object, with what a mesh, line, points or sprite adds when it is one. */
  type ScriptSceneNode = THREE.Object3D & {
    isMesh?: boolean
    isLine?: boolean
    isPoints?: boolean
    isSprite?: boolean
    isInstancedMesh?: boolean
    material?: THREE.Material | THREE.Material[]
    geometry?: THREE.BufferGeometry
    count?: number
  }

  interface Window {
    /** The test room once its content is loaded (`examples/test-room/src/main.js`). */
    __testRoom: TestRoom
    /** The room of a deferred page, before its areas are open. */
    __bootRoom?: TestRoom
    __THREE: typeof THREE
  }
}
export {}
