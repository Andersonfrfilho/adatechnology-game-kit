---
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-characters-three': patch
---

First person draws the weapon at real size, at the scale of the hands and arms that hold it (it was 55 % for long guns and 75 % for mid-length ones, with the hands at 72 % and 85 %). The hands always take the tool's scale. The player's body is flagged as holding the tool (`userData.viewmodel`), so the weapon's wall probe and a laser no longer land on its own fingers.
