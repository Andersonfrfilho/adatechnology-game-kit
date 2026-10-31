// Bundle entry: puts three and the three kit packages on `window` so src/showroom.js can stay plain browser JS.
import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import * as GameTerrain from '@adatechnology/game-terrain'
import * as GameTerrainThree from '@adatechnology/game-terrain-three'

Object.assign(window, { THREE, Reflector, RoomEnvironment, GameInteractables, GameInteractablesHousehold, GameInteractablesThree })
Object.assign(window, { GameTerrain, GameTerrainThree })
