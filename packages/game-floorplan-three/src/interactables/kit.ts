import type { Kernel, Shared } from '../kernel-types.js';

export function installInteractablesKit(K: Kernel, shared: Shared): void {
  const { t, THREE, DOC, cfg, Reflector } = K;
  const roomLightMask = (...a: any[]): any => K.roomLightMask(...a); // installed after this module
  // cfg.interactives = { GameInteractables, GameInteractablesHousehold, GameInteractablesThree, adapter (an adapter or a factory with create()), locale, region, items, effects, camera, onEvent, onSeat }.
  // Everything is injected by the caller; this package never reads globals.
  const IVK = (() => {
    const o = cfg.interactives; if (!o) return null;
    const GI = o.GameInteractables || null, HH = o.GameInteractablesHousehold || null, GT = o.GameInteractablesThree || null, AD = o.adapter || null;
    if (!GI || !HH || !GT || !AD) { console.warn(t('warn.interactablesIncomplete')); return null; }
    const A = AD.plan ? AD : AD.create({ GameInteractables: GI, GameInteractablesHousehold: HH, locale: o.locale, region: o.region });
    return { GI, HH, GT, A, gfx: GT.createThreeAdapter(THREE, { document: DOC, Reflector }), items: o.items !== false, effects: o.effects !== false, camera: o.camera || null, onEvent: o.onEvent || null, onSeat: o.onSeat || null };
  })();
  // Vegetation package (cfg.vegetation = { GameVegetation, GameVegetationSpecies }); without it the props' plant builders stay in use.
  const VEG = (() => { const l = cfg.vegetation || null, G = l && (l.GameVegetation || (l.buildLot ? l : null)), S = l && (l.GameVegetationSpecies || (l.toSpec ? l : null)); return G && S && G.buildLot && S.toSpec ? { G, S } : null; })();
  shared.vegMaterials = null;
  const vegMaterials = () => shared.vegMaterials || (shared.vegMaterials = (() => { const m = VEG.G.createVegetationMaterials(THREE); for (const k of ['wood', 'foliage', 'flowers', 'fruit', 'spines']) roomLightMask(m[k]); return m; })());
  Object.assign(K, { IVK, VEG, vegMaterials });
}
