import type { Kernel, Shared } from '../kernel-types.js';

export function buildApi(K: Kernel, shared: Shared): any {
  const { cfg, VERSION, ATLAS, TEX, applyPart, carGroup, carModel, props, TYPES, roomLightMask, lighting, newState, build } = K;
  return {
        version: VERSION, build, newState, types: TYPES, mv: props, applyPart,
        get materials() { return shared.mats; }, roomLightMask, lighting,
        setNight(n) { shared.mats.glass.emissive.set(n ? 0x8a5a20 : 0x000000); shared.mats.glass.opacity = n ? 0.4 : 0.24; },
        cars: { model: carModel, group: carGroup, info: (k, seed) => { const m = carModel(k, seed); return m && { parts: m.parts.length, tris: m.tris, L: m.L, W: m.W, H: m.H }; } },
        dispose() { if (shared.vegMaterials) { shared.vegMaterials.dispose(); shared.vegMaterials = null; } for (const m of Object.values<any>(shared.mats)) { if (m && m.dispose) m.dispose(); } for (const [k, t] of Object.entries<any>(TEX)) if (t && t.dispose && !(cfg.textures && cfg.textures[k])) t.dispose(); for (const t of Object.values<any>(ATLAS)) if (t && t.dispose) t.dispose(); },
      };
}
