# @adatechnology/game-weapons-three

three.js presentation for `@adatechnology/game-weapons`: the real models of the arsenal, the weapon in the hands, ejected casings, sounds (recipes on `@adatechnology/game-audio`; `createWeaponAudio(volume, { engine })` plays on a shared engine) and the weapons test area.

The muzzle flash, the smoke, the backblast of a launched rocket and the flame jet of the weapon in the hands are not built here: they are recipes of `@adatechnology/game-vfx` (`viewmodel_muzzle_flash`, `weapon_smoke_puff`, `launcher_backblast`, `flame_jet`) that draw them as the gallery does, as solids (an open cone, four small cones and a core for 55 ms growing from 0.6 to 1.5 times their size, a light of `4 k` that holds, spheres of smoke that rise and grow, icosahedra of fire), with the gallery's numbers and the barrel's whole turn (`orientation`, pitch and roll included). `createWeaponFx({ effects })` plays them through the host's effect sink (the test area passes `host.effects`); with no sink the viewer makes a world of effects of its own, stepped and drawn with the weapon. Casings, magazines, the rocket itself and the burning droplets stay meshes of this package.

**Hands.** The weapon in the hands tells the host where the hands go (`host.setHandTargets`, `HandTargets` of `game-contracts`): the right on the pistol grip (the `grip` pivot of the model, else under the receiver), the left on the handguard, on the pump of a pump gun (it moves with the pump), under the right on a handgun, and to the magazine while it is changed; the generic props take the right hand on the `handle` and the left under the `head` of a long gun. Sizes come from the model, the hands shrink with a model drawn small.

**Safety (destravar).** Turning the safety on or off (the `safety` event, B in the test room) plays `safety_on` / `safety_off` on every model: the weapon cants to the right and rises a little toward the eye, the shooting hand slides up its grip so the thumb reaches the lever (`thumb_safety` in `src/data/hand-work.json`; an AK-style rifle's support hand goes over to the big lever on the right, `lever_right`), the lever flicks (when the model draws one, the `safety` part) and the weapon settles. The seconds and radians are `SAFETY_MOTION` of `src/animation/shot-clips.ts`.

**Weapons the gallery did not model.** The melee weapons and tools with no gallery model (the bat, the axe, the machete, the knife, the hammer, the crowbar, the crossbow, the wrench, the extinguisher, the blowtorch...) are drawn with the team's item model of `@adatechnology/game-items-three` (Itens do Vale Cinzento), on the counters and in the hands: `buildItemWeaponModel` lays it along +x, flat, the head at +x, with an empty `handle` where the hand closes. The item is the one with the weapon's id, or the one `registerWeaponItemModel(weaponId, { item, turn, flip })` names (`wrench` → `adjustable_wrench`); `registerWeaponItemModel(id, null)` keeps the low-poly prop. The host lends the item models as `items` (`createWeaponFx`, `createWeaponsTestModule`, `createExplosivesTestModule`, `buildWeaponModel`, `worldExplosiveItem`): pass `itemModels` of `@adatechnology/game-items-three` (the recommended path; the kit's preset does). Without `items` the weapons still draw with `itemModels` of `game-items-three` as before; that default is deprecated and removed in the next major. Only a weapon with neither model falls back to the low-poly boxes of its category (`weaponProp`), and the kit's scene check (`tools/kit-audit/scene.mjs`) lists those as pending.

**Reload sounds.** Each step of a reload makes its noise where the clip says: the clips carry `sound` cues (`cue(t, 'sound', { id })`), so the sound follows the animation and scales with the weapon's reload time (`mag_release`, `mag_out`, `mag_insert`, `mag_seat`, `slide_release`, `charging_handle_pull/release`, `bolt_lift/pull/push/lock`, `shell_insert` once per round, `pump_back/forward`, `lever_open/close`, `cylinder_open/eject/close`, `speedloader`, `barrels_open/close`, `belt_cover_open/close`, `belt_insert`, `rocket_load/seat`, `grenade_load`, `breech_open/close`, `tube_drop/seat`). The recipes are data (`src/data/reload-sounds.json`: layers of the game-audio primitives); a profile (`soundProfileOf`: weight light/medium/heavy from the model family, steel or polymer from a list in the data) changes their pitch and level, and `createWeaponAudio(volume, { reloadCues })` replaces or adds recipes. `createWeaponFx({ onSound })` is told at each cue (the test area logs it as a `sound` entry); `WeaponFx.clips` says which reload variant is playing. `tests/reload-sounds.test.ts` checks the cue order of every weapon and kind, one recipe per cue, and the per-round sounds.

## Geometry

The models' geometry comes from [`game-shapes`](../game-shapes): the model kit's `THREE` is `shapeGeometries(host)` (box, cylinder, cone, sphere,
torus with the same bytes and classes as three's, from a template cache; icosahedron and tube are still three's). `tests/exact-golden.test.ts`
holds every bit of the models, accessories, cartridges and props as the old path made them (`UPDATE_EXACT=1` rewrites it).

## Licenses

The code is MIT. The `assets/weapon-svg/` thumbnails are not code and have their own licenses, which is why the `license` field is an expression:

- `assets/weapon-svg/generated/`: MIT, projected from the 3D models of this kit.
- `assets/weapon-svg/commons/`: outlines traced from drawings of Wikimedia Commons, each under the license of the original (CC BY-SA 4.0 and 3.0, CC BY 3.0, CC0, public domain). CC BY-SA stays CC BY-SA and CC BY needs the author's credit.

Read `assets/weapon-svg/LICENSE-NOTE.md` before redistributing the folder and keep `assets/weapon-svg/CREDITS.md` (author, license, link and modifications of every file) and `manifest.json` with it. The kit's demo site shows the same credits at `weapon-svg/credits.html`.

Unused generated fallbacks: every weapon keeps its `generated/` file even when it has a `commons/` one; the manifest does not reference those, they are what the weapon returns to if the Commons file is removed.

## Models of thrown and fired explosives

`projectileModel(THREE, { weapon, explosive, kind })` gives a host the model of the round a launcher fires (the RPG-7's PG-7V, the Carl Gustaf's 84 mm round, the rocket of the disposable tubes; the same code the weapon in the hands uses to fly it), long axis +x, or `null`. It is the hook the test room's `projectileModel` option takes. The gallery has no model yet for the throwables (M67, molotov, pipe bomb, dynamite, C4, Claymore, flashbang) nor for the grenade launchers (M203, GP-25, AG36: their rounds), so those answer `null`.

`createWeaponsTestModule({ flyRocket: false })` (and `createWeaponFx`) keeps the viewmodel from flying a rocket of its own out of the launcher, for a host that draws the projectile itself (the test room does, with `projectileModel`): one round flies, not two. The backblast stays.

## Área de explosivos (`explosives_area`)
O botijão P13 de cozinha com o modelo real do time (`lpg_cylinder_13kg`, 0,353 x 0,49 x 0,358 m), numa quina de cozinha junto da parede de tijolo: geladeira, balcão, fogão e mesa, um zumbi a 3 m, um sobrevivente a 8 m, anéis no chão a 5 m (letal) e 14 m (ferimento) e o jogador a cerca de 6 m (fora do anel letal). Abre por `?area=explosives_area` (ou `?area=Explosivos`; em inglês `Explosives`); a página padrão da sala já a carrega.
| Id | Tipo | O que faz |
|---|---|---|
| `shoot` | botão | "Atirar no botijão": 9 mm no casco; jato branco, tocha em 0,8 s, explosão em 1,4 s |
| `valve` | botão | "Abrir o registro": vaza sem fogo; sem chama não explode |
| `light` | botão | "Acender (isqueiro)": a chama acende o vazamento, vira tocha e explode 1,4 s depois |
| `fire` | botão | "Jogar no fogo": poça de fogo a 700 °C; o casco passa de 300 °C e explode |
| `reset` | botão | "Reiniciar": refaz a cena |
| `blast_scale` | número 0,25 a 3 (padrão 1) | "Força da explosão (multiplicador de jogo)": multiplica energia e raios do botijão a cada novo botijão |
| `rings` | camada | os anéis de 5 m e 14 m |
| `gas`, `clock`, `phase` | métricas | gás que resta, relógio desde o gatilho e fase |

Cada fase conta no registro da sala, em pt-BR e en, e vira JSON no registro de comportamento. Depois do estouro o casco voa com rastro de fogo e o fogo residual dura 7 s; 2 s depois o registro diz quem morreu e o que a parede e os móveis perderam.

**Onde ajustar a força:** o multiplicador da bancada é só do teste. No jogo, energia, raios, tempos e gás ficam no arsenal: `createArsenal({ patch: { explosives: { propane_p13: { energy, lethalRadius, injuryRadius, chain: { shot, fire, explosion }, leak: { igniteDelay, liters, hissSeconds }, shell: { launchSpeed, trailSeconds } } } } })` (`ArsenalOptions.patch.explosives`). `createExplosivesTestModule({ blastScale })` muda o ponto de partida da bancada.

Cenários: `explosives_p13_shot`, `explosives_p13_valve`, `explosives_p13_fire`, `explosives_p13_chain`.
