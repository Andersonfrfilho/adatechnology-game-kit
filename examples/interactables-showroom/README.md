# Interactables showroom

Walkable first-person 3D showroom of every household object (pt-BR UI), built on
`game-interactables`, `game-interactables-household` and `game-interactables-three`.

    pnpm -r build            # build the packages first (from the repo root)
    node build.mjs           # writes dist/showroom.html (single self-contained file)
    node test.mjs            # Playwright, file:// with network blocked, writes shots/

Draw calls in game quality (including shadow pass and a mirror in view):
worst 690 (overview, shadow redrawn), steady 39 to 372 depending on the view.
