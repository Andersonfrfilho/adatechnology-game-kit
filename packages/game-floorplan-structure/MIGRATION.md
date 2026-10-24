# Migration: structure of the Visor de casas 3D (VC3) to `@adatechnology/game-floorplan-structure`

What the team's `PlantasSDK.gerar` returned as `construcao`, `estrutura`, `telhado` and `caixaDagua`, and `Casa3DSDK.specDe`, now live here with English names. With `wallDetail: 'coarse'`
the output equals the team page in 900 recorded plans (`tests/team-golden-vc3-structure.test.ts`, which translates back with the tables below).

## Result

| VC3 | SDK |
|---|---|
| `res.construcao` | `result.construction` (`system`, `walls`, `floor`, `roof`, `frame`, `foundation`) |
| `res.estrutura` `{ pecas, apoios, niveis, elevacao }` | `result.structure` `{ parts, supports, levels, elevation, framed }` |
| `res.telhado` | `result.roof` (`shape`, `covering`, `material`, `pitch`, `bearingFloor`, `panes`, `trusses`, `axis`, `ridge`, `eave`, `y0`, `aabb`) |
| `res.caixaDagua` | `result.waterTank` (`place`, `floor`, `room`, `capacity`, `platform`, `stand`) |
| extras of the template (`chamine`, `poco`, `sotao`, `tendas`) | `result.structureExtras` (`chimney`, `well`, `attic`, `tents`) |
| `Casa3DSDK.specDe(est, { vedacao, fs, n1, fsOutros, filtro, projeto })` | `toDestructibleSpec(structure, { portico, safety, redundancy, safetyOthers, filter, sized })` |
| `Casa3DSDK.cargasProjeto` | `loadsAtRest` (internal; `sizeStructure` of game-destruction agrees except for beams of a framed building) |

## Part

| VC3 | SDK |
|---|---|
| `id` `role` `material` `aabb` `y0` `y1` `andar` `massa` | `id` `role` `material` `aabb` `y0` `y1` `floor` `mass` |
| `pilar`, `viga`, `laje`, `parede_portante`, `parede_vedacao`, `telhado`, `escada`, `caixa_dagua` | `column`, `beam`, `slab`, `wall`, `partition`, `roof`, `stair`, `none` (StructureRole of game-contracts) |
| `espacamento`, `tipoViga` (`prato`, `cinta`), `degraus`, `porta`, `cobertura`, `capacidade`, `inclinacao`, `barraca`, `forma`, `montantes` | `spacing`, `beamKind` (`plate`, `bond_beam`), `steps`, `door`, `cover`, `liters`, `pitch`, `tent`, `form`, `studs` |
| support `{ de, sobre, tipo }`, `'chao'` | `{ part, on, joint }`, `'ground'` |
| joints `mortar`, `rebar`, `bolt`, `resting`, `nail`, `rope` | the same except `rope` is `tie` (JointKind) |

## Part ids

| VC3 | SDK | VC3 | SDK |
|---|---|---|---|
| `w<floor>_<n>` | `wall_<floor>_<n>` | `prato_<f>_<n>` | `plate_<f>_<n>` |
| `pilar_<f>_<n>` | `column_<f>_<n>` | `pilar_predio_<n>` | `building_column_<n>` |
| `pilar_fund_<j>_<i>` | `footing_pier_<j>_<i>` | `pilar_sacada_<room>` | `balcony_column_<room>` |
| `viga_<f>_<n>` (barrotes) | `joist_<f>_<n>` | `viga_base_<n>` | `base_beam_<n>` |
| `viga_teto_<n>` | `ceiling_joist_<n>` | `laje_<f>` | `slab_<f>` |
| `laje_<f>_<room>` (sacada) | `slab_<f>_<room>` | `laje_base`, `laje_forro`, `laje_topo`, `laje_caixa`, `laje_sotao` | `slab_base`, `slab_ceiling`, `slab_top`, `tank_slab`, `attic_floor` |
| `fund_radier` | `foundation_raft` | `porao_laje`, `porao_parede_<lado>`, `porao_pilar_<n>`, `escada_porao` | `basement_slab`, `basement_wall_<side>`, `basement_column_<n>`, `basement_stairs` |
| `piso_varanda_<room>` | `porch_floor_<room>` | `pier_varanda_<room>_<n>`, `poste_varanda_<room>_<n>` | `porch_footing_<room>_<n>`, `porch_post_<room>_<n>` |
| `viga_varanda_<room>[_e\|_d]` | `porch_beam_<room>[_e\|_d]` | `telhado_varanda_<room>` | `porch_roof_<room>` |
| `escada_<porta>`, `escada_<de>_<para>` | `steps_<door>`, `stairs_<from>_<to>` | `tesoura[_<room>]_<n>` | `truss[_<room>]_<n>` (`rafter_a_<n>`, `rafter_b_<n>`, `ridge` in `panels`) |
| `telhado[_<room>]_a\|b\|anexo` | `roof[_<room>]_a\|b\|annex` | `caixa_dagua`, `chamine`, `poco` | `water_tank`, `chimney`, `well` |
| `pilar_caixa_<n>`, `pilar_cavalete_<n>`, `viga_cavalete_<n>` | `tank_column_<n>`, `trestle_column_<n>`, `trestle_beam_<n>` | `piso_<tenda>`, `lona_<tenda>`, `vareta_<tenda>_<n>`, `estaca_<tenda>_<n>`, `prumo_<f>_<n>_<k>` | `groundsheet_<tent>`, `canvas_<tent>`, `pole_<tent>_<n>`, `peg_<tent>_<n>`, `post_<f>_<n>_<k>` |
| `chao` (terreno do spec) | `ground` | | |

## Construction, roof and tank

| VC3 | SDK |
|---|---|
| `sistema` `alvenaria`, `wood_frame`, `tronco`, `improvisado`, `lona` | `system` `masonry`, `wood_frame`, `log`, `improvised`, `canvas` |
| `parede` `{ material, interna, revestimento, acabamento, espessura, materiais }` | `walls` `{ material, interior, cladding, finish, thickness, mixed }` |
| `piso` `{ material, acabamento }` | `floor` `{ material, finish }` |
| `telhado` `{ material, cobertura, forma, inclinacao, madeiramento, beiral, eixo, apoiaEm }` | `roof` `{ material, covering, shape, pitch, timber, eave, axis, bearingFloor }` |
| `estrutura` `{ material, pilares, vigas, lajes, madeiramento, armadura }` | `frame` `{ material, pillars, beams, slabs, timber, rebar }` |
| `fundacao` `{ tipo, material, elevacao, profundidade }`; `sapata_corrida`, `predio`, `radier`, `vazio_sanitario`, `pilotis`, `porao`, `terra` | `foundation` `{ type, material, elevation, depth }`; `strip_footing`, `building`, `raft`, `crawl_space`, `piles`, `basement`, `ground` |
| coverings `colonial`, `fibrocimento`, `laje`, `asfaltica`, `zinco`, `madeira`, `lona`, `palha` | `colonial`, `fiber_cement`, `slab`, `asphalt`, `zinc`, `wood`, `canvas`, `thatch` |
| forms `duas_aguas`, `laje`, `tenda` | `gable`, `slab`, `tent` |
| tank `local` `laje`, `laje_caixa`, `sotao`, `cavalete`; `plataforma` `{ yBase, altura, espessura, yTopo, pilares, escada }` | `place` `slab`, `raised_slab`, `attic`, `trestle`; `platform` `{ baseY, height, thickness, topY, pillars, ladder }` |
| `tpl.construcao(plano, sem)`, `tpl.extras`, `tpl.caixa`, `tpl.caixaLocal` | `registerConstruction(id, builder)` named by `TemplateDef.construction`, `result.structureExtras`, `TemplateDef.tank`, `TemplateDef.tankLocation` |
| options `semente` ... | `options.wallDetail` (`coarse`, `panels` default, `units`), `options.construction` |

## New with no team original

`wallDetail` `panels` and `units` and `buildWallSpecimen` (spec 001, T2.2d). Ids of the pieces of a wall: `wall_<f>_<n>_pier_<k>`, `_sill_<k>`, `_lintel_<k>`, `_spandrel_<k>`; of bricks `wall_<f>_<n>_pier_<k>_u<row>_<i>`;
of logs `wall_<f>_<n>_log<row>_<i>`; of a door lintel `lintel_<door>`; of rafters `rafter_a_<n>`, `rafter_b_<n>` and `ridge`.

## Differences on purpose

- `wallDetail: 'coarse'` is the team's structure. Every other detail also: rafters of each roof side and a `ridge` beam instead of whole trusses (a roof side falls with the wall it rests on, the other stands);
  the porch roof rests on its posts alone (the tie to the house wall carries nothing: take the posts away and only the porch roof falls); a framed building (apartment, commercial, three storeys or more) carries by
  its pillars and beams (`portico`).
- `door.steps` is written by the structure extension on the doors that get steps, as the team wrote `degraus` (not by `buildStructure`, which does not change its input).
- Ids of wall hashes (`mixed` materials of the shack) use the legacy key `w<floor>_<n>` so old seeds keep their draws.
- The terrain part of the spec is `ground` (was `chao`) with the tag `terrain`.
