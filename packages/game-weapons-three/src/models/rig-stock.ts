import type * as THREE_NS from 'three'
import type { WeaponDef } from '@adatechnology/game-weapons'
import type { WeaponModel } from './index'
import type { StockMove } from './types'

const FOLD_AXIS_BY_SIDE: Readonly<Record<string, 'x' | 'y' | 'z'>> = { right: 'y', left: 'y', under: 'z', over: 'z' }

/** Where the hinge of a folding stock sits: at the rear of the receiver, on the side the rule folds it to (z is to the right), under it or over it. */
const hingeOf = (model: WeaponModel, side: string): [number, number, number] => {
  const frames = model.parts.frames
  const x = frames?.receiverStart ?? 0
  const halfWidth = (frames?.receiverWidth ?? 0.034) / 2
  const halfHeight = (frames?.receiverHeight ?? 0.06) / 2
  if (side === 'right') return [x, 0, halfWidth]
  if (side === 'left') return [x, 0, -halfWidth]
  if (side === 'under') return [x, -halfHeight, 0]
  return [x, halfHeight, 0]
}

/**
 * After the model is built: puts the stock the builder drew into one pivot named `stock`, so that the clips can fold it (a half turn about the side of the rule's `foldAxis`)
 * or slide it in (`dimensions.length - lengthCollapsed`). Done after the build so that the model the golden hashes is the one the builder made. A weapon whose stock does not move is left alone.
 */
export function rigStock(THREE: typeof THREE_NS, model: WeaponModel, def: Pick<WeaponDef, 'stock' | 'dimensions'>): void {
  const stock = def.stock
  const meshes = model.parts.stockMeshes
  if (!stock || stock.kind === 'fixed' || stock.kind === 'none' || !meshes || meshes.length === 0) return
  const isFolding = stock.kind === 'fold' || stock.kind === 'fold_retract'
  const side = stock.foldAxis ?? 'right'
  const hinge = isFolding ? hingeOf(model, side) : ([0, 0, 0] as [number, number, number])
  const pivot = new THREE.Group()
  pivot.name = 'stock'
  pivot.position.set(...hinge)
  model.inner.add(pivot)
  model.inner.updateMatrixWorld(true)
  for (const mesh of meshes) pivot.attach(mesh)
  const dimensions = def.dimensions
  const travel = dimensions?.lengthCollapsed === undefined ? 0 : (dimensions.length - dimensions.lengthCollapsed) / model.inner.scale.x
  const move: StockMove = isFolding ? { kind: 'fold', axis: FOLD_AXIS_BY_SIDE[side] ?? 'y', travel } : { kind: 'retract', axis: 'x', travel }
  model.parts.stock = pivot
  model.parts.stockMove = move
}
