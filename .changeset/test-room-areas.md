---
'@adatechnology/game-test-room': minor
---

Test environments per catalogue group: `openArea(group)` (and the `area` option) clears the room and lays a group in rows, or lays a loaded
module by its own `area`, with resting surfaces and asleep props. The room is now a `ModuleHost`: modules get the scene, the camera and the
tool events (shot, reload start and end, empty) through `attach`. The catalogue has a search across every tab and the tests panel a search too.
