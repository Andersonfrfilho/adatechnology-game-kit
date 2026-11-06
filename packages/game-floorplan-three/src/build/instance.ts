import type { DocumentLike } from '@adatechnology/game-props3d';
import type { Damageable } from '../types.js';
import type { HouseInstance, Kernel, KernelBuildInstance, SavedHouseState, Shared } from '../kernel-types.js';

export function installBuildInstance(K: Kernel, shared: Shared): void {
  const { PROPS, THREE, DOC, cfg, HP, createInteractiveMaterials, createMaterials, typeTable } = K;
      // ====================== instance: tables and materials ======================
  const props = PROPS.create(THREE, { document: DOC as DocumentLike | undefined /* null passes through as before */, emit: () => { } });
  const TYPES = typeTable(props);
  shared.mats = createMaterials(props);
  createInteractiveMaterials(shared.mats);
  if (cfg.materials) for (const k of Object.keys(cfg.materials)) { const v = cfg.materials[k]; shared.mats[k] = typeof v === 'function' ? (v(shared.mats[k], k) || shared.mats[k]) : v; }
   // material swap by the app (e.g. the game's materials)

  const newState = (): SavedHouseState => ({ doors: new Map(), inter: new Map(), water: null, iv: null });
   // state of doors/parts/lights; pass the same object to build() to rebuild without closing everything
  function enter(h: HouseInstance): void { shared.ctx = h.ctx; shared.inter = h.inter; shared.doorState = h.state.doors; shared.partState = h.state.inter; shared.mirrors = h.mirrors; shared.quality = h.quality; }
  const tagDamage = (type: string): Damageable => ({ type, hp: HP[type] as number, hpMax: HP[type] as number }); /* an unknown class keeps the team's undefined hp */
  const defined: KernelBuildInstance = { props, TYPES, newState, enter, tagDamage };
  Object.assign(K, defined);
}
