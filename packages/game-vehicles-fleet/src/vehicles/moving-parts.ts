/**
 * The small moving parts the car builders share: a wiper arm turned on its own spindle and a sliding sunroof (a tinted pane over a dark opening,
 * sliding back over the roof as a spoiler sunroof does). The pieces stay where the builder drew them (the vehicle is the same, byte for byte, parked);
 * the context lists what moves them, and `createVehicleBody` of `game-vehicles-three` turns a wiper about its spindle while it sweeps.
 */
type Vector = { x: number; y: number; z: number }
type Node = { userData: Record<string, unknown>; name: string }

/** Angle a wiper sweeps from rest to the top of its arc, radians. */
export const WIPER_SWEEP = 1.5

/** What a wiper piece carries: its arm, the spindle it turns about and the axis (the windshield's normal), in the vehicle's frame. */
export type WiperTag = { readonly arm: number; readonly sweep: number; readonly spindle: readonly [number, number, number]; readonly axis: readonly [number, number, number] }

/** Lists the wiper pieces on the vehicle's context (`c.wipers`), so the drawing itself carries nothing new. */
export function tagWiper(params: { context: { wipers?: Array<{ part: Node; tag: WiperTag }> }; parts: readonly Node[]; spindle: Vector; normal: Vector; index: number }): void {
  const tag: WiperTag = { arm: params.index, sweep: WIPER_SWEEP, spindle: [params.spindle.x, params.spindle.y, params.spindle.z], axis: [params.normal.x, params.normal.y, params.normal.z] }
  params.context.wipers ??= []
  for (const part of params.parts) params.context.wipers.push({ part, tag })
}

/** Marks a sliding sunroof pane: it slides `slide` metres back (−x of the kit frame) when opened. */
export function markSunroof(pane: Node, slide: number): Node {
  pane.name = 'sunroof'
  pane.userData.sunroof = { slide }
  return pane
}
