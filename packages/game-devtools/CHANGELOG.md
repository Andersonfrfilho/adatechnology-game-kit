# @adatechnology/game-devtools

## 0.1.1

### Patch Changes

- 106c0f5: No `any` in the public types: `ShapeGenerator<TParams>`, `Composer<TParams>` and `PoleShapeBuilder<TSpec>` take the params type of the entry (a registry still holds entries with different params), and `Devtools.db` is a typed `MarksDatabase`.

## 0.1.0

### Minor Changes

- 4d19d97: Initial release (0.1.0): free-fly mode, position HUD, notes and marks, panel, scenarios runner and entity labels, ported to TypeScript with English naming and an `en` / `pt-BR` locale table.
