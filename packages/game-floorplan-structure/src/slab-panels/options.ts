/**
 * How a concrete slab of a house is cut into panels with beams under their edges, and where pillars are added so that every beam spans a
 * reasonable distance (design T10-estrutura-real.md §10). Every number is a choice of the design and can be changed per call
 * (`toDestructibleSpec({ slabPanels: { maxSpan: 4 } })`).
 */
export interface SlabPanelOptions {
  /** Longest side of a panel and longest stretch of a beam or bond beam without a support, metres (default 5). */
  maxSpan: number
  /** A cut never leaves a piece narrower than this, metres (default 1.5). */
  minPanel: number
  /** Share of a line of the panel a wall must cover (doors included) for the line to be a room boundary the panel is cut along (default 0.6). */
  lineCoverage: number
  /** A gap in a line of walls up to this wide is a door and counts as wall, metres (default 1.3). */
  doorGap: number
  /** Walls whose lines are this close are one line, metres (default 0.2). */
  lineTolerance: number
  /** A panel with less than this share of its area inside the footprint of the slab is left out (default 0.5). */
  footprintShare: number
  /** Thickness of a panel is its short side over this (default 40: `h = L/40`). */
  thicknessRatio: number
  /** Thinnest floor slab, metres (default 0.10). */
  floorMinThickness: number
  /** Thinnest roof slab, metres (default 0.08). */
  roofMinThickness: number
  /** Depth of a beam is its span over this (default 10: `h = L/10`, a simply supported beam of NBR 6118, and deep enough for the frame to carry the loss of one pillar; continuous beams are L/12). */
  beamDepthRatio: number
  /** Shallowest beam, metres (default 0.25). */
  beamMinDepth: number
  /** Depth of beams and bond beams is rounded up to a multiple of this, metres (default 0.05). */
  beamStep: number
  /** Width of a beam is the thickness of the wall it hides in, or its depth over this when that is wider (default 3). */
  beamWidthRatio: number
  /** Side of the pillars that are added, metres (default 0.20; NBR 6118 13.2.3 asks for 19 cm). */
  columnSide: number
}

export const SLAB_PANEL_DEFAULTS: Readonly<SlabPanelOptions> = {
  maxSpan: 5, minPanel: 1.5, lineCoverage: 0.6, doorGap: 1.3, lineTolerance: 0.2, footprintShare: 0.5, thicknessRatio: 40, floorMinThickness: 0.1, roofMinThickness: 0.08,
  beamDepthRatio: 10, beamMinDepth: 0.25, beamStep: 0.05, beamWidthRatio: 3, columnSide: 0.2,
}

export const resolveSlabPanels = (options?: boolean | Partial<SlabPanelOptions>): SlabPanelOptions | undefined => {
  if (options === false) return undefined
  const given = options === true || options === undefined ? {} : options
  const out = { ...SLAB_PANEL_DEFAULTS }
  for (const key of Object.keys(given) as (keyof SlabPanelOptions)[]) if (given[key] !== undefined) out[key] = given[key]!
  return out
}
