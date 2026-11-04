---
'@adatechnology/game-destruction-three': patch
---

Bare rebar no longer hangs in the air: a part's cage is drawn as a child of the drawing of its object, so a beam or a wall that comes down (a split piece) takes its bars with it, and a cage that gives way (`expose` with no bars) drops its bars as steel debris that falls, lies on the ground and stays there with a body (`FragmentSystem.spawn` with `lasting`). Bars still held by concrete stay where they are and keep bending under load.
