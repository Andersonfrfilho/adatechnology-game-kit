---
'@adatechnology/game-test-room': minor
'@adatechnology/game-characters-three': minor
---

One body for both views. A `RoomAvatar` with `eye()` is drawn in first person too: the camera sits at the body's eyes (pulled back out of a wall), and the aim, shots and the hands' `reach` start from there in both views, so switching views moves no hand, foot or head. `setView` hides the head from the player's camera only. The separate first-person arms are gone from the room (`RoomAvatar.firstPerson` removed); `toRoomAvatar` makes them only when asked (`firstPerson`) and exposes `eye`/`setView`. A scripted `room.look` keeps its exact view until the player moves. A carried item rides the body's hand.
