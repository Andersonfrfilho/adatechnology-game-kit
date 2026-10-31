---
'@adatechnology/game-characters-three': minor
---

`PlayerAvatar.reach(targets, view?)` takes a `ReachView` (`{ camera, reachBend?, keepOutside? }`) for the body seen from its own eyes: `reachBend` (default `[1.35, 0.95]` rad, right then left) keeps the elbow bent where a hand is out of reach, the chest turn and shoulder-blade slide stopping where it still holds that bend, and `keepOutside` (`contact`, `margin` 0.005 m, `nearest` 0.12 m) pulls a hand back along the camera's forward to stay in front of a surface. Without `view` nothing changes.
