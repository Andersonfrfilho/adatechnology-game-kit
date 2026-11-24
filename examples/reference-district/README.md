# reference-district

The example a game copies (spec 011): a cut of a city (centre, river, popular quarter) built only through the public API of the kit.

- `data/*.json`: the plan (`game-urban` city plan), the site (lots, props, horde zones, `missing`) and the scripts. `src/game/main.ts` reads the first two.
- `src/game/main.ts`: `startDistrict(THREE, options)`. One `createKitWorld` call, then `assemble/*` puts each piece in through its owner package: streets and blocks (`game-urban`), a house on every lot (`game-floorplan`), vehicles and props, the horde (`game-crowd`), the weather, the player and the camera.
- `src/test/`: what only validates and measures (scenario by `?cena=tipico|pior|caos`, `?camera=third|first`, the `window.__district` probe). `src/game` never imports it (layer rule `scene-not-testing-*`).
- Run: `pnpm check:district` (builds, unit tests, opens the page and writes prints in `shots/`; GPU, never CI). Keys: WASD walk, shift run, V swaps the camera, click takes the mouse.
- HUD and death screen: `src/game/assemble/hud.ts` puts `@adatechnology/game-player/hud` over the view (vitals, the scenario's name, the crosshair in the first person; the body holds no weapon, so none is shown). When the body dies the death screen offers "Reiniciar cena" (Enter or R: `src/game/session.ts` disposes the district and builds it again from the same options, no reload) and "Voltar ao início" (the body back at its start, the world as it is). `?lang=en` writes it in English.

## Known limits

- The nav grid of the horde and the player holds each building at its own footprint (the gaps between buildings are open) and each house **as a solid rectangle**: nobody walks into a house through the grid, and the doors are not opened in it. Going in needs the house colliders and doors of `game-floorplan-three` wired to the player (L1/L6).
- Parked vehicles are scenery (lite build, no body in the world); the nav grid blocks them.
- A `missing` entry is a warning box with no collision and no physics; it goes when its task puts the real piece in.
