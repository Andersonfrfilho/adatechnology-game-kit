# vehicles-catalog

Tool of the repository (not published). Reads the team deliveries for vehicles and writes the data of `game-vehicles-fleet` as JSON.

- `pnpm --filter @adatechnology/vehicles-catalog-tool catalog` writes `dims.json` (DIMS of the Frota Leve, by SDK id), `paint.json` (civil and military palettes), `stats.json` (the six 0-10 ratings, noise radius, top speed of the Frota cards) and `cards.pt-BR.json` (the card texts) in `packages/game-vehicles-fleet/src/data/`.
- `catalog --check` fails when the files are out of date. `catalog:game` writes the game slice (`specs/.../game-slice/vehicles/`, the Garagem game plugin) for the zombiada repository.
- `compare` runs the Garagem artifact, the site v4 page and the SDK in Node (three r128, fake canvas) for the 69 vehicles in the three states and writes `specs/.../comparacoes/veiculos/`. It takes about 20 minutes.
