/**
 * Throwaway meshes that use every kind of material a renderer makes later on demand (a hole decal, a stream of liquid, a puff of smoke). A host adds `group` to its scene for
 * ONE render, so that the shader programs are built then and not in the middle of play (the first shot or leak stalls the frame otherwise), and calls `dispose` afterwards.
 * `group` is the three.js `Object3D`: `unknown` here because the contracts do not depend on three.js.
 */
export interface WarmUpProbes {
  readonly group: unknown
  dispose(): void
}
