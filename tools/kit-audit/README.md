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

## The own-frame-clock rule

CLAUDE.md §15 ("Um dono do tempo do quadro", spec 010): outside `game-runtime`, nothing times deferred work with its own clock. `clock.mjs`
flags (a) a new constant named `*_BUDGET_MS` / `*_SLICE_MS` and (b) `performance.now()` / `Date.now()` compared with, or added to, a deadline or
budget (`>= deadline`, `> until`, `+ budgetMs`). `audit.mjs --check` runs it; the tests are `node --test tools/kit-audit/tests/`.

Exempt by class, not by list: `game-runtime`; `game-workers` (§14); `bench/` code; `game-physics/src/work-budget.ts` (turns ms into units, reads no
clock); `drainDetached` in `game-contracts/src/frame.ts` (the one sanctioned clock of deferred work); timers and waits (the compared operand
names a wait, interval, cooldown, timeout... or is a stored expiry such as `msg.until`); and measurement or animation (a clock that is only
subtracted or used as a phase is never compared with a deadline). A `*_BUDGET_MS` / `*_SLICE_MS` constant is exempt by its uses, not its name:
when every use in its file is (part of) the arguments of a `drainDetached(...)` call or a `budgetMs: X` / `budgetMs = X` option or default, it is
only the budget of a detached drain. One other use (a `performance.now() + X` deadline, a comparison) keeps it flagged, and so does a constant
never used; fix the code (go through `drainDetached`) instead of listing it.

`clock-pending.json` (empty since C3) lists the hits a later task of spec 010 still removes (`file`, `match` on the line, `task`). `--check` prints them with
`file:line` and the pending count, and fails only on a hit that is in neither place; entries that no longer match are printed as `VELHA`.
`--strict-clocks` also fails while the list is not empty: that is the C3 gate at the end of phase 1.

## The must-drain rule

CLAUDE.md §15 ("Fila `mustDrain`", spec 017 trava 2): a queue registered with `mustDrain: true` drains whole, outside the frame deadline, so each one adds to the
worst frame by construction, and "a new queue does not enter that class without the owner's decision". The lock that no spelling bypasses is at run time
(`MUST_DRAIN_QUEUE_IDS` in `game-contracts`, checked by `budget.register` of `game-runtime`); `must-drain.mjs` is the early warning in the audit. It reads
`packages/*/src`, `examples/*` and `apps/*` (`.ts`, `.tsx`, `.js`, `.mjs`; not tests) and flags every `mustDrain` key whose value is not the literal `false`: a `true` for a
queue that is not an entry of `must-drain-allowed.json` (`queue`, `constant` in `DEFERRED_QUEUE_ID`, the only `package` that may, `reason`; the queue is read, exactly, from the
object literal around the key), and any value the rule cannot read (variable, ternary, shorthand, quoted or computed key, value on the next line). Comments (block ones included),
types (`mustDrain?: boolean`) and the plumbing of `game-runtime` are not registrations. `audit.mjs --check` runs it; a new entry is the owner's decision, written in `reason`.
Tests: `tests/must-drain.test.mjs`.

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
| `kit_workers { platform?, cores?, work?, workers?, reserveCores?, maxWorkers? }` | How a project sets up the worker coordinator (`game-workers`, CLAUDE.md §14): workers per lane from `planWorkers`, the kit kinds that apply with their schedule, the simulation thread or not, what the host must serve (COOP/COEP) and the code to start it (`workers.mjs`) |

The words are a heuristic: a piece whose code names nothing (a bare `BoxGeometry` in a helper) is not seen, so review still looks at what a
test area or a bench draws.

## Custo de desenho por peça

`node tools/kit-audit/cost.mjs --check` abre a sala e cada área e soma, por peça marcada, chamadas de desenho (com sombra), triângulos e materiais. `budgets.json` guarda o limite por dono e, em `pending`, as peças já acima dele. O CI falha em peça nova acima do limite e em pendente que piorou. Ao reduzir uma peça, baixe o valor dela ou tire-a de `pending`.
