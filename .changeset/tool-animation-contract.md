---
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': minor
---

Animation contract for the tool in hand. `HostEvent` gains `cycle`, `stage` and `feed`, and `tool`, `reload` and `clear` carry the seconds the rule gave
the phase (`duration`, from the weapon `phase`) and the reload `kind`. `game-contracts` adds `toolAnimationStep` (event to move: `play`, `sync`,
`finish`), `TOOL_CLIP`, the renderer-free `createToolClipPlayer` (scales a clip to the duration of the rule, moves a `ToolRig`, fires clip events, jumps
to the marker of a reached stage), `scaleClip`, `sampleClip` and `checkToolClips`. The test room now passes the whole weapon cycle to the host.
Breaking for hosts that call `toHostEvent` directly: the third parameter is an options object (`{ recoil, phase }`).
