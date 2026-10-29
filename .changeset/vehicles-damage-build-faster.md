---
'@adatechnology/game-vehicles': patch
---

Building a heavily damaged vehicle (the fleet's `burnt` scenario) is about four times faster, with the same result bit for bit: the decal rays of `zoneDecals` test only the triangles of the bodywork that they can reach (instead of every triangle of the shell per ray), `zoneDent` skips the vertices and triangles outside the zone box before transforming them, and `crease` (smooth normals) hashes numbers instead of strings and keeps the face normals in one typed array.
