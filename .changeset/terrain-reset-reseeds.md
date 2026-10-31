---
'@adatechnology/game-terrain': patch
---

A reset ground digs the same crater and throws the same clods as a new one: `reset` (and `setLayout`) start the ground's random stream over, and the clods count their ids from one again. Before, every reset went on from where the last blow left the stream, so the test room's scenarios that dig the floor came out different from one run to the next (`house_two_pillars` failed now and then).
