import type { ModuleScenario } from '@adatechnology/game-contracts'

/** The members of the test room's `ScenarioContext` these scenarios use (structural: this package does not depend on the room). */
interface ScenarioContext {
  room: {
    spawn(itemId: string, position?: [number, number, number], rotationY?: number): { objectId: string }
    setTool(id: string): unknown
    waitUntilReady(): number
    look(from: [number, number, number], to: [number, number, number]): void
    use(hold?: number): unknown
    world: { part(objectId: string, partId: string): { status: string; hp: number; maxHp: number; holes: Array<{ through?: boolean }>; dents: unknown[]; cracks: unknown[]; temperature?: number; melt?: number } | null }
    log: { entries(filter: { type?: string; objectId?: string }): Array<{ data?: Record<string, unknown> }> }
  }
  step(seconds: number): void
  expect(ok: boolean, label: string, data?: Record<string, unknown>): void
}

/** The target stands at (0, 0, TARGET_Z); its face is `FACE_Y` above the floor and looks toward +z (the shooter). */
const TARGET_Z = -4
const SHOOTER_Z = -1.5

/**
 * Scenarios of the weapons module against its own real targets (`target_steel_plate`, `target_plywood`, `target_concrete`) and real weapons: the 9 mm pistol
 * through steel, the same round stopped by concrete, the pump shotgun on plywood and the hammer on steel. They were the room's generic bullet-hole checks
 * before the room stopped shipping items of its own.
 */
export function weaponsScenarios(locale: string): Array<ModuleScenario<ScenarioContext>> {
  const pt = locale.toLowerCase().startsWith('pt')
  const T = (p: string, e: string): string => (pt ? p : e)
  const faceY = (id: string): number => (id === 'target_steel_plate' ? 1.35 : id === 'target_plywood' ? 1.5 : 1.2)
  const aimAt = (room: ScenarioContext['room'], id: string): void => room.look([0, faceY(id) + 0.05, SHOOTER_Z], [0, faceY(id), TARGET_Z])

  return [
    {
      id: 'target_steel_heavy_through_hole',
      name: T('Alvo de aço: um .50 BMG do Barrett M82A1 atravessa a chapa e o 9 mm só amassa', 'Steel target: the .50 BMG of the Barrett M82A1 goes through the plate and the 9 mm only dents it'),
      run: ({ room, step, expect }) => {
        const id = room.spawn('target_steel_plate', [0, 0, TARGET_Z]).objectId
        room.setTool('pistol_9mm')
        room.waitUntilReady()
        aimAt(room, 'target_steel_plate')
        room.use()
        step(0.3)
        const pistol = room.world.part(id, 'face')
        expect((pistol?.dents.length ?? 0) > 0 && !pistol?.holes.some((h) => h.through), T(`9 mm na chapa de 10 mm: amassados ${pistol?.dents.length ?? 0}, furos que atravessam ${pistol?.holes.filter((h) => h.through).length ?? 0} (esperado: amassa e não atravessa)`, `9 mm on the 10 mm plate: dents ${pistol?.dents.length ?? 0}, through holes ${pistol?.holes.filter((h) => h.through).length ?? 0} (expected: dents it, no through hole)`))
        room.setTool('barrett_m82a1')
        room.waitUntilReady()
        aimAt(room, 'target_steel_plate')
        room.use()
        step(0.3)
        const rifle = room.world.part(id, 'face')
        const hole = rifle?.holes.find((h) => h.through)
        expect(!!hole, T(`.50 BMG na chapa: furo que atravessa ${hole ? 'sim' : 'não'} (furos: ${rifle?.holes.length ?? 0})`, `.50 BMG on the plate: through hole ${hole ? 'yes' : 'no'} (holes: ${rifle?.holes.length ?? 0})`), { holes: rifle?.holes.length })
      },
    },
    {
      id: 'target_concrete_stops_bullet',
      name: T('Alvo de concreto: um 9 mm não atravessa o bloco', 'Concrete target: a 9 mm does not go through the block'),
      run: ({ room, step, expect }) => {
        const id = room.spawn('target_concrete', [0, 0, TARGET_Z]).objectId
        room.setTool('pistol_9mm')
        room.waitUntilReady()
        aimAt(room, 'target_concrete')
        room.use()
        step(0.2)
        const face = room.world.part(id, 'face')
        const through = face?.holes.some((h) => h.through) ?? true
        const marks = (face?.holes.length ?? 0) + (face?.dents.length ?? 0) + (face?.cracks.length ?? 0)
        expect(!through && marks > 0, T(`Bloco de concreto: atravessou ${through ? 'sim' : 'não'}, marcas ${marks} (esperado: não atravessar e marcar)`, `Concrete block: went through ${through ? 'yes' : 'no'}, marks ${marks} (expected: stopped and marked)`), { through, marks })
      },
    },
    {
      id: 'target_plywood_shotgun_holes',
      name: T('Alvo de compensado: a escopeta de ferrolho crava vários chumbos na madeira', 'Plywood target: the pump shotgun drives several pellets through the wood'),
      run: ({ room, step, expect }) => {
        const id = room.spawn('target_plywood', [0, 0, TARGET_Z]).objectId
        room.setTool('shotgun_pump_12')
        room.waitUntilReady()
        aimAt(room, 'target_plywood')
        room.use()
        step(1.1)
        const holes = room.world.part(id, 'face')?.holes.length ?? 0
        expect(holes >= 3, T(`Chumbos na madeira num tiro: ${holes} furos (esperado: 3 ou mais)`, `Pellets in the wood from one shot: ${holes} holes (expected: 3 or more)`), { holes })
      },
    },
    {
      id: 'target_steel_hammer_dents',
      name: T('Alvo de aço: a marreta amassa a chapa sem romper', 'Steel target: the hammer dents the plate without breaking it'),
      run: ({ room, step, expect }) => {
        const id = room.spawn('target_steel_plate', [0, 0, TARGET_Z]).objectId
        room.setTool('hammer')
        room.waitUntilReady()
        room.look([0, 1.4, TARGET_Z + 0.65], [0, 1.35, TARGET_Z])
        let swings = 0
        for (; swings < 8 && (room.world.part(id, 'face')?.dents.length ?? 0) === 0; swings++) {
          room.use()
          step(1)
        }
        const face = room.world.part(id, 'face')
        expect((face?.dents.length ?? 0) > 0 && face?.status !== 'broken', T(`Amassados na chapa depois de ${swings} golpe(s): ${face?.dents.length ?? 0}`, `Dents in the plate after ${swings} swing(s): ${face?.dents.length ?? 0}`), { swings })
      },
    },
    {
      id: 'target_steel_torch_melts',
      name: T('Alvo de aço: o maçarico de corte derrete a chapa', 'Steel target: the cutting torch melts the plate'),
      run: ({ room, expect }) => {
        const id = room.spawn('target_steel_plate', [0, 0, TARGET_Z]).objectId
        room.setTool('cutting_torch')
        room.waitUntilReady()
        room.look([0, faceY('target_steel_plate') + 0.05, TARGET_Z + 0.2], [0, faceY('target_steel_plate'), TARGET_Z])
        room.use(20)
        const face = room.world.part(id, 'face')
        expect((face?.melt ?? 0) > 0.02 || face?.status === 'melted' || (face?.holes.length ?? 0) > 0, T(`Chapa depois do maçarico: ${Math.round(face?.temperature ?? 0)} °C, derretido ${Math.round((face?.melt ?? 0) * 100)}%`, `Plate after the torch: ${Math.round(face?.temperature ?? 0)} °C, ${Math.round((face?.melt ?? 0) * 100)}% melted`), { temperature: face?.temperature, melt: face?.melt })
      },
    },
  ]
}
