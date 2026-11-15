/** What damage did to a tool in hand: its handle snapped (no swing, no dig) and how far its blade is bent (radians, `PartState.bend`). */
export interface ToolCondition {
  readonly handleBroken: boolean
  readonly bend: number
}
