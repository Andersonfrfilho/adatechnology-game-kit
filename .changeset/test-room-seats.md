---
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': minor
---

Seats: a `TestableItem` (and `TestRoomItem`) can bring `seats` (`ItemSeat`, the shape of a `game-interactables` seat), and the room seats the player there with `room.sit(objectId?, seatId?)`: the eye over the hips, facing the front of the item, the walk held and the view kept near that facing. A walk key or a jump gets up at the seat's exit (`room.stand()` does it by script), and so does losing the item or a reset of the room; `room.seat` says where the player sits. The furniture area passes the seats of the household types (chairs, sofa, armchair, beds, benches).
