import { resolveSlabPanels, slabPanelView } from '@adatechnology/game-floorplan-structure';

export interface PanelView {
  /** The panels the slabs of the structure are cut into (as `toDestructibleSpec` names them), each with `slab`, the id of the slab it comes from. */
  panels: any[]
  /** Ids of the slabs that the spec no longer has (a panel for each room, or less, took their place). */
  replaced: string[]
  supports: any[]
}

const NONE: PanelView = { panels: [], replaced: [], supports: [] };
const MEMO = new WeakMap<object, PanelView>();

/**
 * The slab panels of the structure of a plan, for the pieces the house draws: the floor, the ceiling and the roof slab of each room are tagged with the
 * panel they belong to, so a panel that fails drops alone. Only a house bound to a destruction world (`enabled`) is drawn in panels: without a world the
 * floors are the tiles the Visor de casas 3D draws, bit for bit. The same for every build of the same plan (the structure is the key).
 */
export function panelViewOf(structure: any, enabled: boolean): PanelView {
  if (!enabled || !structure || !structure.parts) return NONE;
  let view = MEMO.get(structure);
  if (!view) {
    const options = resolveSlabPanels(true);
    view = options ? slabPanelView(structure, options) : NONE;
    MEMO.set(structure, view);
  }
  return view;
}
