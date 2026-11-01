# kit-audit

Finds the pieces drawn by hand outside the SDK that owns them: a three.js primitive (`new THREE.BoxGeometry(...)` and the like) or a
`box`/`cylinder` part of a destructible spec, in a package or example that does not own that kind of piece, when the code around it names the
piece (a car outside `game-vehicles`, a wall outside `game-floorplan`, a table outside the household catalogue, a person outside
`game-characters`...). It is the check of the CLAUDE.md rule "Nada desenhado à mão quando o kit já tem".

```sh
node tools/kit-audit/audit.mjs                      # report
node tools/kit-audit/audit.mjs --check              # exit 1 on a new finding (CI runs this)
node tools/kit-audit/audit.mjs --json
node tools/kit-audit/audit.mjs --package game-weapons-three --domain vehicles
```

- `rules.json`: each domain (vehicles, structure, furniture, people, plants, items, weapons) with the packages that own it, how to build the piece
  from them (`use`) and the words that name it (English and Portuguese, without accents).
- `allowlist.json`: `allowed` are findings where the word means something else (a car's roof, a gun barrel), each with its reason; `pending` are
  the real findings already listed in `docs/pecas-fora-do-sdk.md`, each with its fix. `--check` fails only on a finding in neither list. When a
  pending piece is fixed, take its entry out.

## The scene check

The words miss a box whose code names nothing, so `scene.mjs` reads the screen instead. Every builder of the kit marks the root it returns
with `markKitOrigin` of `game-contracts` (`userData.kitOrigin`: the package, the kind of piece, the catalogue id, and `standIn` for an item
still drawn as a simple shape); the room, the effects and the street mark their own roots. The check opens the built test room
(`examples/test-room/dist/test-room.html`, every module of the kit), then the room alone and each area, waits until the scene stops growing
and lists every visible mesh, line, point cloud or sprite with no marked ancestor: what was drawn on the spot.

```sh
node examples/test-room/build.mjs                    # the page it opens
node tools/kit-audit/scene.mjs                       # report, per area
node tools/kit-audit/scene.mjs --check               # exit 1 on an unmarked drawing not pending in allowlist.json (CI runs this)
node tools/kit-audit/scene.mjs --area weapons_area
```

`drawn` in `allowlist.json` lists the known ones (`area`: the area id, `room` or `*`; `match`: a regular expression on the path of names; `fix`).
A new piece of the kit marks its root in its builder; a host that draws something itself uses a piece of the kit instead.

## MCP server

`mcp.mjs` serves the same answers to an agent over MCP (stdio, no dependencies). The root `.mcp.json` registers it for Claude Code as `game-kit`:

| Tool | Answers |
|---|---|
| `kit_owner { piece }` | Which SDK gives a car, a wall, a table... and how to build it from there |
| `kit_origin { text, path? }` | The first commit that brought a name or a piece of code, its author, date, subject, PR and files |
| `kit_audit { package?, domain?, all? }` | The hand-drawn pieces outside their SDK (new, pending and, with `all`, allowed) |

The words are a heuristic: a piece whose code names nothing (a bare `BoxGeometry` in a helper) is not seen, so review still looks at what a
test area or a bench draws.

## Custo de desenho por peça

`node tools/kit-audit/cost.mjs --check` abre a sala e cada área e soma, por peça marcada, chamadas de desenho (com sombra), triângulos e materiais. `budgets.json` guarda o limite por dono e, em `pending`, as peças já acima dele. O CI falha em peça nova acima do limite e em pendente que piorou. Ao reduzir uma peça, baixe o valor dela ou tire-a de `pending`.
