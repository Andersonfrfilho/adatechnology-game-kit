# weapons-catalog

Writes the reconciled weapons data of `@adatechnology/game-weapons` from the team deliveries, so every number has a traceable origin.

| Reads | What |
|---|---|
| Galeria 3D do Arsenal (`sources/armas-itens__galeria-3d-arsenal.js`) | `WEAP`, `CATS`, `AMMO`, `EXP`, `QUAL` (cut by bracket matching and evaluated in an empty `vm` context) |
| Arsenal (`artefatos/NNmz….html`) | tables §06 catalogue, §07 technical sheet, §12 noise, §13 explosives |
| Laboratório de Explosões (`sources/efeitos__laboratorio-explosoes.js`) | `PROF` blast profiles |
| Jogo (`artefatos/2UG1….../jogo.js`) | `EXP`, `ARMAS`, weapon switch time |
| `decisions.json` | every reconciliation choice as `{ value, source, reason }`, including the calibration questions Q1 to Q6 |

| Writes | |
|---|---|
| `packages/game-weapons/src/data/{calibers,firearms,launchers,explosives}.json` | generated |
| `packages/game-weapons-three/src/data/models.json` | generated: the gallery builder and options of each weapon |

`packages/game-weapons/src/data/archetypes.json` (handling numbers by weapon type) and `base/calibers.sdk.json` (the 18 calibres of the SDK, frozen) are inputs kept by hand.

```bash
pnpm --filter @adatechnology/weapons-catalog-tool build
pnpm --filter @adatechnology/weapons-catalog-tool catalog          # regenerate
pnpm --filter @adatechnology/weapons-catalog-tool catalog:check    # fail when the generated files are stale
```

To change a calibration answer, edit the value in `decisions.json` and regenerate. `tests/sources.test.ts` checks the generated data against the sources;
`tests/catalog-up-to-date.test.ts` is the same as `catalog:check`.
