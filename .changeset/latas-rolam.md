---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
---

Cans and bottles roll and knock each other. A round piece's moment of inertia about its axis is I = k m r^2 from where its mass is (hollow walls of known thickness a thin
shell, k 1; the contents a solid, k 1/2; an empty hollow thing all shell; or `makePiece(id, { inertia })`), so a full can rolls down a slope at g (sin t - C_rr cos t) / 1.53
and an empty one at / 2, with the rolling resistance of the softer surface by material (steel 0.002, wood 0.01, concrete 0.012, carpet 0.08). A round piece touches by the
lowest point of each ring of its profile: a straight can rolls straight, a tapered bottle rounds its narrow end. Pieces with a round one among them meet by their shapes
(capsules, and the boxes of the other's parts as drawn) and trade an impulse with the restitution of their materials (rubber 0.8, glass 0.7, steel 0.6, wood and plastic 0.5,
concrete 0.4, fabric and paper 0.2), momentum kept; walls and fixed furniture bounce them by the same table. Every piece of several meshes is met by its parts from the moment it
is made a piece (a board rests on a bench's slats, a can rolls under a table between its legs); what leans on another piece's part is not pushed off it, and a piece moving by
the foot of another does not wake it unless that one rests on it. Candidates by sweep and prune, surfaces under a point by a grid: fifty cans rolling cost about 1.4 ms per
frame on a loaded machine. In the test room a light piece at the feet is kicked by the walk as two bodies colliding (shoe on it, e 0.5) through its centre of mass, and one
lower than a step is not leaned on and does not stop the player.
