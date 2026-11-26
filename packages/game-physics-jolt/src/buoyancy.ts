import type { BodyId, FluidDesc } from '@adatechnology/game-physics'

import type { JoltWorldHost } from './world-host'

/** The water pushes the body for one fixed step (`ApplyBuoyancyImpulse`, with the world's gravity); false when no part of it is below the surface. */
export const applyBuoyancy = (w: JoltWorldHost, id: BodyId, fluid: FluidDesc): boolean => {
  const e = w.entry(id)
  w.r1.Set(fluid.surface[0], fluid.surface[1], fluid.surface[2])
  w.v1.Set(fluid.normal[0], fluid.normal[1], fluid.normal[2])
  const flow = fluid.flow ?? [0, 0, 0]
  w.v2.Set(flow[0], flow[1], flow[2])
  return w.bi.ApplyBuoyancyImpulse(e.id, w.r1, w.v1, fluid.buoyancy, fluid.linearDrag, fluid.angularDrag, w.v2, w.system.GetGravity(), w.fixedStep)
}
