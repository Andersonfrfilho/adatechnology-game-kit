---
'@adatechnology/game-contracts': minor
---

The hands contract: `HandPose` (world position and quaternion of a palm, one hand-local axis convention for both hands), `HandTargets` (`R`, `L`, `grip`, `gripL`, `scale`) and `HandTargetSource`, and the optional `ModuleHost.setHandTargets(source)` through which a module lends the host the place of the hands for the tool it holds. Generic: nothing in it knows a weapon.
