import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Compass, Hash, Copy, Check, CloudRain, Bomb, Flame, Zap, Target, X, Sparkles } from 'lucide-react';
import { PlayerState, ChatMessage, ToadSpecies, PlantedBomb } from '../types';
import { TOAD_SPECIES_DATA } from '../data/species';
import { audioService } from '../services/audioService';
import { RainSystem, WeatherMode } from '../utils/rainSystem';
import { socketService } from '../services/socketService';

interface ActiveBubble {
  id: string;
  playerId: string;
  text: string;
  displayName: string;
  createdAt: number;
}

interface ActiveBomb {
  id: string;
  col: number;
  row: number;
  mapName: MapType;
  mesh: THREE.Group;
  spark: THREE.Mesh;
  sparkLight: THREE.PointLight;
  ring: THREE.Mesh;
  createdAt: number;
  planterId: string;
}

interface ExplosionEffect {
  group: THREE.Group;
  flashLight: THREE.PointLight;
  fireball: THREE.Mesh;
  shockwave: THREE.Mesh;
  particles: { mesh: THREE.Mesh; vel: THREE.Vector3; rotSpeed: THREE.Vector3; life: number; maxLife: number }[];
  life: number;
  maxLife: number;
}

const FROG_STACK_HEIGHT = 0.72; // Voxel toad height per stack layer

interface PracticeCompanionFrog {
  id: string;
  displayName: string;
  toadSpecies: ToadSpecies;
  col: number;
  row: number;
  mesh: THREE.Group;
  worldPos: THREE.Vector3;
  targetWorldPos: THREE.Vector3;
  startY: number;
  isHopping: boolean;
  hopProgress: number;
  facingAngle: number;
  isStill: boolean;
  hopCooldown: number;
  stackLevel: number;
}

interface IslandPondCanvasProps {
  roomOccupants: PlayerState[];
  localPlayerId: string;
  swarmActive: boolean;
  swarmMultiplier: number;
  quietMode: boolean;
  strictMode: boolean;
  devMode?: boolean;
  latestChatMessage?: ChatMessage | null;
  onStillnessChange: (isStill: boolean, pos?: { x: number; y: number }) => void;
  onFireflyCatch?: () => void;
}

export type MapType = 'island' | 'waterfall' | 'starry_night';

// Tile Map Layout Definition (18 columns x 12 rows)
// 'G': Grass / Terrain Tile
// 'W': Water Tile (Pond / River)
// 'L': Lily Pad Tile (resting spots)
// 'S': Shoreline River Rock / Star Rock Tile
// 'T': Tree Tile
// 'B': Bush Tile
// 'O': Fallen Log Tile
// 'M': Mountain Stone Stair Step Tile
// 'F': Waterfall Water Source Tile
// 'C': Fire Bonfire / Star Beacon Tile
// 'Y': Giant Cypress Tree Tile (Starry Night Landmark)
// '.': Empty Sky / Void

const ISLAND_TILE_MAP: string[][] = [
  ['.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'],
  ['.', 'T', 'G', 'G', 'G', 'T', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'T', 'G', '.', '.'],
  ['.', 'G', 'G', 'B', 'G', 'G', 'O', 'O', 'O', 'O', 'O', 'G', 'G', 'G', 'G', 'G', 'G', '.'],
  ['.', 'G', 'O', 'O', 'G', 'W', 'W', 'W', 'W', 'W', 'G', 'G', 'G', 'B', 'G', 'T', 'G', '.'],
  ['.', 'G', 'G', 'G', 'G', 'W', 'W', 'W', 'L', 'W', 'W', 'S', 'G', 'G', 'G', 'G', 'G', '.'],
  ['.', 'T', 'G', 'B', 'G', 'G', 'W', 'L', 'W', 'W', 'L', 'W', 'W', 'G', 'G', 'B', 'G', '.'],
  ['.', 'G', 'G', 'G', 'G', 'G', 'S', 'W', 'W', 'L', 'W', 'W', 'W', 'S', 'G', 'G', 'T', '.'],
  ['.', 'G', 'G', 'T', 'G', 'G', 'G', 'G', 'W', 'W', 'W', 'G', 'G', 'G', 'G', 'G', 'G', '.'],
  ['.', 'G', 'B', 'G', 'G', 'G', 'C', 'G', 'S', 'G', 'S', 'G', 'G', 'B', 'G', 'G', 'G', '.'],
  ['.', 'G', 'G', 'G', 'T', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'T', 'G', 'G', '.'],
  ['.', '.', 'G', 'G', 'G', 'G', 'B', 'G', 'G', 'G', 'B', 'G', 'G', 'G', 'G', 'G', '.', '.'],
  ['.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'],
];

const WATERFALL_TILE_MAP: string[][] = [
  ['.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'],
  ['.', 'T', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'T', '.', '.'], // Row 1: Upper Mountain Ridge
  ['.', 'G', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'G', 'G', '.'], // Row 2: Mountain Slope
  ['.', 'G', 'G', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'F', 'M', 'M', 'M', 'G', 'T', 'G', '.'], // Row 3: Highest Peak (c10 'F', c11 'M')
  ['.', 'G', 'O', 'G', 'M', 'M', 'M', 'M', 'M', 'M', 'F', 'M', 'M', 'G', 'G', 'G', 'G', '.'], // Row 4: Highest Peak (c10 'F', c11 'M')
  ['.', 'G', 'G', 'B', 'G', 'M', 'M', 'M', 'M', 'M', 'F', 'M', 'G', 'B', 'G', 'G', 'G', '.'], // Row 5: Mountain Slope & Waterfall
  ['.', 'G', 'G', 'G', 'G', 'G', 'M', 'M', 'S', 'S', 'F', 'S', 'G', 'G', 'G', 'T', 'G', '.'], // Row 6: Waterfall Cascade & Valley Ledge
  ['.', 'G', 'G', 'T', 'S', 'S', 'W', 'W', 'W', 'W', 'W', 'W', 'S', 'S', 'G', 'G', 'G', '.'], // Row 7: Valley River Basin
  ['.', 'G', 'B', 'G', 'S', 'W', 'W', 'L', 'W', 'W', 'L', 'W', 'S', 'B', 'G', 'G', 'G', '.'], // Row 8: River Basin with Lily Pads
  ['.', 'G', 'G', 'G', 'G', 'S', 'W', 'W', 'W', 'W', 'W', 'S', 'G', 'G', 'T', 'G', 'G', '.'], // Row 9: Lower River
  ['.', '.', 'G', 'G', 'G', 'G', 'B', 'G', 'G', 'G', 'B', 'G', 'G', 'G', 'G', 'G', '.', '.'], // Row 10: Meadow Shore
  ['.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'],
];

const STARRY_NIGHT_TILE_MAP: string[][] = [
  ['.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'],
  ['.', 'H', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'H', 'G', 'G', 'G', 'G', 'G', 'T', '.', '.'],
  ['.', 'H', 'H', 'G', 'H', 'H', 'G', 'G', 'S', 'S', 'S', 'G', 'G', 'H', 'H', 'G', 'G', '.'],
  ['.', 'G', 'H', 'G', 'H', 'S', 'S', 'S', 'G', 'G', 'G', 'S', 'G', 'G', 'H', 'G', 'G', '.'],
  ['.', 'H', 'G', 'S', 'S', 'Y', 'Y', 'G', 'G', 'G', 'G', 'S', 'S', 'G', 'G', 'G', 'G', '.'],
  ['.', 'G', 'H', 'S', 'G', 'Y', 'Y', 'H', 'H', 'G', 'G', 'G', 'S', 'P', 'P', 'G', 'G', '.'],
  ['.', 'G', 'G', 'G', 'S', 'Y', 'Y', 'H', 'H', 'G', 'G', 'S', 'S', 'P', 'P', 'G', 'T', '.'],
  ['.', 'G', 'G', 'T', 'S', 'S', 'G', 'G', 'G', 'S', 'S', 'G', 'G', 'G', 'G', 'G', 'G', '.'],
  ['.', 'G', 'B', 'G', 'H', 'G', 'G', 'G', 'S', 'S', 'S', 'G', 'G', 'B', 'G', 'G', 'G', '.'],
  ['.', 'G', 'G', 'G', 'T', 'G', 'G', 'G', 'G', 'G', 'G', 'H', 'G', 'G', 'T', 'G', 'G', '.'],
  ['.', '.', 'G', 'G', 'G', 'G', 'B', 'G', 'G', 'G', 'B', 'G', 'G', 'G', 'G', 'G', '.', '.'],
  ['.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'],
];

const COLS = ISLAND_TILE_MAP[0].length; // 18
const ROWS = ISLAND_TILE_MAP.length;    // 12
const TILE_SIZE = 1.2;

// Default lily pad positions mapped to grid coords
const ISLAND_LILY_PAD_POSITIONS = [
  { col: 8, row: 4 },
  { col: 7, row: 5 },
  { col: 10, row: 5 },
  { col: 9, row: 6 },
];

const WATERFALL_LILY_PAD_POSITIONS = [
  { col: 7, row: 8 },  // River Basin Left
  { col: 10, row: 8 }, // River Basin Right
  { col: 8, row: 7 },  // Upper River Basin
];

const STARRY_NIGHT_LILY_PAD_POSITIONS = [
  { col: 8, row: 4 },
  { col: 6, row: 5 },
  { col: 11, row: 5 },
  { col: 9, row: 7 },
];

export const IslandPondCanvas: React.FC<IslandPondCanvasProps> = ({
  roomOccupants,
  localPlayerId,
  swarmActive,
  swarmMultiplier,
  quietMode,
  strictMode,
  devMode,
  latestChatMessage,
  onStillnessChange,
  onFireflyCatch,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Mutable prop refs to decouple Three.js render loop from React state re-renders
  const occupantsRef = useRef<PlayerState[]>(roomOccupants);
  const localPlayerIdRef = useRef<string>(localPlayerId);
  const swarmActiveRef = useRef<boolean>(swarmActive);
  const strictModeRef = useRef<boolean>(strictMode);
  const onStillnessChangeRef = useRef(onStillnessChange);

  const onFireflyCatchRef = useRef(onFireflyCatch);

  useEffect(() => { occupantsRef.current = roomOccupants; }, [roomOccupants]);
  useEffect(() => { localPlayerIdRef.current = localPlayerId; }, [localPlayerId]);
  useEffect(() => { swarmActiveRef.current = swarmActive; }, [swarmActive]);
  useEffect(() => { strictModeRef.current = strictMode; }, [strictMode]);
  useEffect(() => { onStillnessChangeRef.current = onStillnessChange; }, [onStillnessChange]);
  useEffect(() => { onFireflyCatchRef.current = onFireflyCatch; }, [onFireflyCatch]);

  // Dev Switch State for Showing Tile Numbers / Coordinates
  const [showTileNumbers, setShowTileNumbers] = useState<boolean>(!!devMode);
  const showTileNumbersRef = useRef<boolean>(!!devMode);

  useEffect(() => {
    if (devMode !== undefined) {
      setShowTileNumbers(devMode);
    }
  }, [devMode]);

  useEffect(() => {
    showTileNumbersRef.current = showTileNumbers;
  }, [showTileNumbers]);

  const [selectedTileInfo, setSelectedTileInfo] = useState<{ col: number; row: number; tileChar: string; mapName: string } | null>(null);
  const [copiedTileText, setCopiedTileText] = useState<boolean>(false);

  // Local Toad Grid Position & Hopping Interpolation State
  const localGridPosRef = useRef<{ col: number; row: number }>({ col: 8, row: 4 });
  const localWorldPosRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.3, z: 0 });
  const targetWorldPosRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.3, z: 0 });
  const startWorldYRef = useRef<number>(0.3);
  const facingAngleRef = useRef<number>(0);
  const isHoppingRef = useRef<boolean>(false);
  const hopProgressRef = useRef<number>(0);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  // 10-Second Settling Transition to Stillness State (with 1s sitting-tight delay)
  const isSettlingRef = useRef<boolean>(false);
  const settleTimerRef = useRef<number>(0);
  const SETTLE_DELAY = 1.0; // 1 second delay when frog sits tight before the ring appears
  const SETTLE_DURATION = 10.0; // 10 seconds to transition from moving to still state

  // Camera Rotation & Zoom Control Refs (Default view is max zoom out)
  const targetRotationRef = useRef<number>(0);
  const currentRotationRef = useRef<number>(0);
  const targetZoomScaleRef = useRef<number>(1.0); // 1.0 = Max Zoom Out (default)
  const currentZoomScaleRef = useRef<number>(1.0);
  const [zoomScaleState, setZoomScaleState] = useState<number>(1.0);

  // Pointer drag state for camera rotation
  const isDraggingRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startRotationRef = useRef<number>(0);

  // Screen space overlay coords for Chat Bubbles
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);
  const [bubbleScreenPositions, setBubbleScreenPositions] = useState<{ [playerId: string]: { x: number; y: number } }>({});

  // Strict mode firefly state
  const fireflyPosRef = useRef<{ x: number; y: number; z: number; active: boolean }>({ x: 0, y: 3, z: 0, active: false });

  // Map Switcher State
  const [selectedMap, setSelectedMap] = useState<MapType>('island');
  const selectedMapRef = useRef<MapType>('island');
  useEffect(() => { selectedMapRef.current = selectedMap; }, [selectedMap]);

  // --- Super Powers State & Refs ---
  const [isPlantingBomb, setIsPlantingBomb] = useState<boolean>(false);
  const isPlantingBombRef = useRef<boolean>(false);
  useEffect(() => { isPlantingBombRef.current = isPlantingBomb; }, [isPlantingBomb]);

  const [plantedBombsCount, setPlantedBombsCount] = useState<number>(0);
  const [superpowerToast, setSuperpowerToast] = useState<{ text: string; icon: string; id: number } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [practiceToadActive, setPracticeToadActive] = useState<boolean>(true);
  const practiceToadActiveRef = useRef<boolean>(true);
  useEffect(() => { practiceToadActiveRef.current = practiceToadActive; }, [practiceToadActive]);

  const activeBombsRef = useRef<ActiveBomb[]>([]);
  const explosionsRef = useRef<ExplosionEffect[]>([]);
  const cameraShakeRef = useRef<number>(0);
  const hoveredTileRef = useRef<{ col: number; row: number } | null>(null);

  const tonguePushActionRef = useRef<{
    active: boolean;
    progress: number;
    duration: number;
    dCol: number;
    dRow: number;
    maxReach: number;
    strikeFired: boolean;
    hasImpacted: boolean;
  }>({
    active: false,
    progress: 0,
    duration: 0.28,
    dCol: 0,
    dRow: 1,
    maxReach: 3.8,
    strikeFired: false,
    hasImpacted: false,
  });

  // Dynamic Tile Stacks: Key is "col,row", Value is ordered array of frog IDs [bottom, ..., top]
  const tileStacksRef = useRef<Map<string, string[]>>(new Map());
  // 3 Practice Companion Frogs (making 4 frogs total with local player)
  const practiceFrogsRef = useRef<PracticeCompanionFrog[]>([]);
  const getTileKey = useCallback((col: number, row: number) => `${col},${row}`, []);

  const showSuperpowerToast = useCallback((text: string, icon: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    const id = Date.now();
    setSuperpowerToast({ text, icon, id });
    toastTimeoutRef.current = setTimeout(() => {
      setSuperpowerToast((prev) => (prev?.id === id ? null : prev));
    }, 2800);
  }, []);

  // Weather / Occasional Rain State & System Ref
  const [weatherLabel, setWeatherLabel] = useState<string>('☀️ Clear Sky');
  const [weatherMode, setWeatherMode] = useState<WeatherMode>('auto');
  const rainSystemRef = useRef<RainSystem | null>(null);

  // Helper for ground surface base elevation (without props)
  const getGroundElevation = useCallback((m: MapType, col: number, row: number): number => {
    if (m === 'waterfall') {
      if (row >= 7) return 0.3;
      const peakCoords = [
        { r: 3, c: 10 }, { r: 3, c: 11 },
        { r: 4, c: 10 }, { r: 4, c: 11 }
      ];
      let minDist = 99;
      for (const p of peakCoords) {
        const dist = Math.max(Math.abs(row - p.r), Math.abs(col - p.c));
        if (dist < minDist) minDist = dist;
      }
      const level = Math.max(0, 5 - minDist);
      return 0.3 + level * 0.6;
    }
    return 0.3;
  }, []);

  // Helper for determining base Y resting elevation for toad depending on map type and tile
  const getTileBaseY = useCallback((m: MapType, col: number, row: number): number => {
    const tileMap = m === 'starry_night' ? STARRY_NIGHT_TILE_MAP : (m === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 0.3;
    const tile = tileMap[row][col];
    const groundY = getGroundElevation(m, col, row);

    if (m === 'starry_night') {
      if (tile === 'H') return groundY + 1.45; // Stand firmly ON TOP of village cottage roof
      if (tile === 'P') return groundY + 1.45; // Stand on top of church roof
      if (tile === 'B') return groundY + 0.85; // Stand firmly ON TOP of starry bush
      if (tile === 'S') return groundY + 0.25; // Sit on golden star rock / path
      return groundY;
    }

    if (m === 'waterfall') {
      if (tile === 'B') return groundY + 0.85; // Stand on top of bush
      if (tile === 'H') return groundY + 1.45; // Stand on top of cottage
      if (tile === 'O') return groundY + 0.45; // Sit on log
      if (tile === 'S') return groundY + 0.25; // Shore rock
      return groundY;
    } else {
      if (tile === 'B') return groundY + 0.85; // Stand on top of bush
      if (tile === 'H') return groundY + 1.45; // Stand on top of cottage
      if (tile === 'C') return groundY + 0.35; // Elevate toad when sitting near bonfire pit
      if (tile === 'O') {
        if (row === 2 && col >= 6 && col <= 10) return 0.825; // Elevate toad on giant log behind pond
        return groundY + 0.45;
      }
      if (tile === 'S') return groundY + 0.25; // Elevate toad to sit on top of shoreline river rock
      return groundY;
    }
  }, [getGroundElevation]);

  // Grid to World coordinate converter helper
  const gridToWorld = useCallback((col: number, row: number) => {
    const x = (col - COLS / 2 + 0.5) * TILE_SIZE;
    const z = (row - ROWS / 2 + 0.5) * TILE_SIZE;
    return { x, z };
  }, []);

  // Helper for initial spawn position based on pad assignment and map
  const getLocalDefaultGridPos = useCallback((m: MapType) => {
    const occupant = occupantsRef.current.find((p) => p.playerId === localPlayerIdRef.current);
    const padIdx = occupant ? occupant.padIndex : 0;
    const list = m === 'starry_night' ? STARRY_NIGHT_LILY_PAD_POSITIONS : (m === 'waterfall' ? WATERFALL_LILY_PAD_POSITIONS : ISLAND_LILY_PAD_POSITIONS);
    return list[padIdx] || list[0];
  }, []);

  // Set initial spawn when map or pad changes
  useEffect(() => {
    const initPad = getLocalDefaultGridPos(selectedMap);
    localGridPosRef.current = { col: initPad.col, row: initPad.row };
    const w = gridToWorld(initPad.col, initPad.row);
    const initY = getTileBaseY(selectedMap, initPad.col, initPad.row);
    localWorldPosRef.current = { x: w.x, y: initY, z: w.z };
    targetWorldPosRef.current = { x: w.x, y: initY, z: w.z };
  }, [selectedMap, getLocalDefaultGridPos, gridToWorld, getTileBaseY]);

  // Chat bubble triggers
  useEffect(() => {
    if (!latestChatMessage || quietMode) return;

    audioService.playBubblePop();

    setBubbles((prev) => {
      const filtered = prev.filter((b) => b.playerId !== latestChatMessage.playerId);
      return [
        ...filtered,
        {
          id: latestChatMessage.messageId,
          playerId: latestChatMessage.playerId,
          text: latestChatMessage.text,
          displayName: latestChatMessage.displayName,
          createdAt: Date.now(),
        },
      ];
    });
  }, [latestChatMessage, quietMode]);

  // Helper to determine facing delta (dCol, dRow) from facing angle
  const getFacingDelta = useCallback((rotY: number): { dCol: number; dRow: number } => {
    const angle = THREE.MathUtils.euclideanModulo(rotY, Math.PI * 2);
    // 0 is Down (dRow = 1, dCol = 0)
    // PI/2 is Right (dRow = 0, dCol = 1)
    // PI is Up (dRow = -1, dCol = 0)
    // 3*PI/2 is Left (dRow = 0, dCol = -1)
    if (angle >= (7 * Math.PI) / 4 || angle < Math.PI / 4) {
      return { dCol: 0, dRow: 1 };
    } else if (angle >= Math.PI / 4 && angle < (3 * Math.PI) / 4) {
      return { dCol: 1, dRow: 0 };
    } else if (angle >= (3 * Math.PI) / 4 && angle < (5 * Math.PI) / 4) {
      return { dCol: 0, dRow: -1 };
    } else {
      return { dCol: -1, dRow: 0 };
    }
  }, []);

  // Superpower 1: Detonate Bomb Handler
  const detonateBombObj = useCallback((bomb: ActiveBomb) => {
    activeBombsRef.current = activeBombsRef.current.filter((b) => b.id !== bomb.id);
    setPlantedBombsCount(activeBombsRef.current.length);

    audioService.playExplosion();

    window.dispatchEvent(
      new CustomEvent('detonate_bomb_scene', {
        detail: {
          bombId: bomb.id,
          col: bomb.col,
          row: bomb.row,
          mapName: bomb.mapName,
        },
      })
    );

    socketService.detonateBomb(bomb.id, bomb.col, bomb.row, bomb.mapName);
    showSuperpowerToast('💥 KABOOM! Bomb detonated!', '💥');
  }, [showSuperpowerToast]);

  // Superpower 1: Plant Bomb Action
  const plantBombAt = useCallback(
    (col: number, row: number) => {
      const map = selectedMapRef.current;
      const tileMap = map === 'starry_night' ? STARRY_NIGHT_TILE_MAP : (map === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);

      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
      const tileChar = tileMap[row][col];
      if (tileChar === '.' || tileChar === 'T') {
        showSuperpowerToast('Cannot plant bomb on trees or void!', '⚠️');
        return;
      }

      const existing = activeBombsRef.current.find((b) => b.col === col && b.row === row && b.mapName === map);
      if (existing) {
        showSuperpowerToast('A bomb is already planted on this tile!', '💣');
        return;
      }

      const bombId = `bomb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      window.dispatchEvent(
        new CustomEvent('plant_bomb_scene', {
          detail: {
            id: bombId,
            col,
            row,
            mapName: map,
            planterId: localPlayerIdRef.current,
          },
        })
      );

      socketService.plantBomb({ id: bombId, col, row, mapName: map });
      setIsPlantingBomb(false);
      showSuperpowerToast(`Bomb planted on tile [${col}, ${row}]! Detonates on jump.`, '💣');
    },
    [showSuperpowerToast]
  );

  const toggleBombPlacement = useCallback(() => {
    setIsPlantingBomb((prev) => {
      const next = !prev;
      if (next) {
        showSuperpowerToast('Click any tile on the pond to plant a bomb! (Esc to cancel)', '💣');
      } else {
        showSuperpowerToast('Bomb targeting cancelled.', '❌');
      }
      return next;
    });
  }, [showSuperpowerToast]);

  // Superpower 2: Tongue Push Action (Keyboard P or Click)
  const triggerTonguePush = useCallback(() => {
    const curAngle = facingAngleRef.current;
    const { dCol, dRow } = getFacingDelta(curAngle);
    const curPos = localGridPosRef.current;

    audioService.playTonguePush();

    const map = selectedMapRef.current === 'starry_night'
      ? STARRY_NIGHT_TILE_MAP
      : (selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);

    const TONGUE_MAX_RANGE = 3; // Reaches up to 3 tiles in front
    let hitTarget = false;
    let hitDistance = TONGUE_MAX_RANGE;

    const currentLocalId = localPlayerIdRef.current;
    const occupants = occupantsRef.current;
    const padList = selectedMapRef.current === 'waterfall'
      ? WATERFALL_LILY_PAD_POSITIONS
      : (selectedMapRef.current === 'starry_night' ? STARRY_NIGHT_LILY_PAD_POSITIONS : ISLAND_LILY_PAD_POSITIONS);

    // Scan line of sight up to TONGUE_MAX_RANGE tiles
    for (let step = 1; step <= TONGUE_MAX_RANGE; step++) {
      const targetCol = curPos.col + dCol * step;
      const targetRow = curPos.row + dRow * step;

      // Stop if out of map bounds
      if (targetCol < 0 || targetCol >= COLS || targetRow < 0 || targetRow >= ROWS) {
        break;
      }

      // Stop if solid obstacle blocks tongue (e.g. Tree 'T')
      if (map[targetRow][targetCol] === 'T') {
        break;
      }

      const targetKey = getTileKey(targetCol, targetRow);
      const targetStack = tileStacksRef.current.get(targetKey) || [];

      // Also check remote players at this tile
      let hitRemotePlayer: PlayerState | null = null;
      for (const player of occupants) {
        if (player.playerId === currentLocalId) continue;
        const pad = padList[player.padIndex] || padList[0];
        if (pad.col === targetCol && pad.row === targetRow) {
          hitRemotePlayer = player;
          break;
        }
      }

      if (targetStack.length > 0 || hitRemotePlayer) {
        hitTarget = true;
        hitDistance = step;
        const pushDestCol = targetCol + dCol;
        const pushDestRow = targetRow + dRow;

        if (
          pushDestCol >= 0 &&
          pushDestCol < COLS &&
          pushDestRow >= 0 &&
          pushDestRow < ROWS &&
          map[pushDestRow][pushDestCol] !== '.' &&
          map[pushDestRow][pushDestCol] !== 'T'
        ) {
          const destKey = getTileKey(pushDestCol, pushDestRow);
          const existingDestStack = tileStacksRef.current.get(destKey) || [];
          const destBaseLevel = existingDestStack.length;
          const destBaseY = getTileBaseY(selectedMapRef.current, pushDestCol, pushDestRow);
          const w = gridToWorld(pushDestCol, pushDestRow);

          // Push the entire stack on this tile together!
          if (targetStack.length > 0) {
            tileStacksRef.current.delete(targetKey);
            tileStacksRef.current.set(destKey, [...existingDestStack, ...targetStack]);

            targetStack.forEach((frogId, idx) => {
              const targetY = destBaseY + (destBaseLevel + idx) * FROG_STACK_HEIGHT;

              if (frogId === currentLocalId) {
                localGridPosRef.current = { col: pushDestCol, row: pushDestRow };
                startWorldYRef.current = localWorldPosRef.current.y;
                targetWorldPosRef.current = { x: w.x, y: targetY, z: w.z };
                isHoppingRef.current = true;
                hopProgressRef.current = 0;
              } else {
                const pf = practiceFrogsRef.current.find((f) => f.id === frogId);
                if (pf) {
                  pf.col = pushDestCol;
                  pf.row = pushDestRow;
                  pf.targetWorldPos.set(w.x, targetY, w.z);
                  pf.startY = pf.worldPos.y;
                  pf.isHopping = true;
                  pf.hopProgress = 0;
                  pf.stackLevel = destBaseLevel + idx;
                }
              }
            });
          }

          if (hitRemotePlayer) {
            socketService.pushFrog(hitRemotePlayer.playerId, dCol, dRow, pushDestCol, pushDestRow);
          }

          const count = Math.max(1, targetStack.length);
          showSuperpowerToast(`Pushed ${count > 1 ? `stack of ${count} frogs` : 'frog'} (${step} tile${step > 1 ? 's' : ''} away) 1 tile back!`, '👅');

          // Check if pushed frogs land on a bomb
          const landingBomb = activeBombsRef.current.find(
            (b) => b.col === pushDestCol && b.row === pushDestRow && b.mapName === selectedMapRef.current
          );
          if (landingBomb) {
            setTimeout(() => {
              detonateBombObj(landingBomb);
            }, 180);
          }
        } else {
          showSuperpowerToast('Pushed frogs, but obstacle blocked!', '👅');
        }
        break;
      }
    }

    // Set visual reach based on whether a target was hit or maximum range
    const maxReachUnits = hitTarget ? hitDistance * 1.2 + 0.3 : TONGUE_MAX_RANGE * 1.2;

    tonguePushActionRef.current = {
      active: true,
      progress: 0,
      duration: Math.min(0.36, 0.22 + hitDistance * 0.04),
      dCol,
      dRow,
      maxReach: maxReachUnits,
      strikeFired: false,
      hasImpacted: false,
    };

    if (!hitTarget) {
      showSuperpowerToast('Tongue whipped forward (3-tile reach)!', '👅');
    }
  }, [getFacingDelta, getTileKey, gridToWorld, getTileBaseY, detonateBombObj, showSuperpowerToast]);

  // Superpower: Form 4-Toad Totem Tower (Stack all frogs onto player's head)
  const formToadTower = useCallback(() => {
    const curCol = localGridPosRef.current.col;
    const curRow = localGridPosRef.current.row;
    const curLocalId = localPlayerIdRef.current;
    const destKey = getTileKey(curCol, curRow);

    // Clear old positions of practice frogs from tileStacks
    practiceFrogsRef.current.forEach((pf) => {
      const oldKey = getTileKey(pf.col, pf.row);
      const stack = tileStacksRef.current.get(oldKey) || [];
      tileStacksRef.current.set(oldKey, stack.filter((id) => id !== pf.id));
    });

    // Build the 4-frog stack: Local player at bottom, then Toad Bro, Dart Pip, Golden Sage
    const fullStack = [curLocalId, ...practiceFrogsRef.current.map((pf) => pf.id)];
    tileStacksRef.current.set(destKey, fullStack);

    const w = gridToWorld(curCol, curRow);
    const baseY = getTileBaseY(selectedMapRef.current, curCol, curRow);

    // Command all companion toads to hop onto player
    practiceFrogsRef.current.forEach((pf, idx) => {
      const level = idx + 1; // 1, 2, 3
      pf.col = curCol;
      pf.row = curRow;
      pf.stackLevel = level;
      pf.startY = pf.worldPos.y;
      pf.targetWorldPos.set(w.x, baseY + level * FROG_STACK_HEIGHT, w.z);
      pf.isHopping = true;
      pf.hopProgress = 0;
      pf.facingAngle = facingAngleRef.current;
    });

    audioService.playCroak(1.4);
    showSuperpowerToast('👑 4-Toad Totem Tower Formed! Hop with WASD to carry everyone!', '👑');
  }, [getTileKey, gridToWorld, getTileBaseY, showSuperpowerToast]);

  // Scatter companion frogs to nearby tiles
  const scatterToads = useCallback(() => {
    const curCol = localGridPosRef.current.col;
    const curRow = localGridPosRef.current.row;
    const curLocalId = localPlayerIdRef.current;
    const map = selectedMapRef.current === 'starry_night'
      ? STARRY_NIGHT_TILE_MAP
      : (selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);

    const offsets = [
      { dc: 0, dr: 1 },
      { dc: 1, dr: 0 },
      { dc: -1, dr: 0 },
      { dc: 0, dr: -1 },
      { dc: 1, dr: 1 },
      { dc: -1, dr: -1 },
    ];

    let offsetIdx = 0;
    practiceFrogsRef.current.forEach((pf) => {
      // Find adjacent valid tile
      while (offsetIdx < offsets.length) {
        const nextCol = curCol + offsets[offsetIdx].dc;
        const nextRow = curRow + offsets[offsetIdx].dr;
        offsetIdx++;

        if (
          nextCol >= 0 && nextCol < COLS &&
          nextRow >= 0 && nextRow < ROWS &&
          map[nextRow][nextCol] !== '.' &&
          map[nextRow][nextCol] !== 'T'
        ) {
          // Remove from current stack
          const oldKey = getTileKey(pf.col, pf.row);
          const oldStack = tileStacksRef.current.get(oldKey) || [];
          tileStacksRef.current.set(oldKey, oldStack.filter((id) => id !== pf.id));

          // Place on new tile
          const newKey = getTileKey(nextCol, nextRow);
          const newStack = tileStacksRef.current.get(newKey) || [];
          const newLevel = newStack.length;
          tileStacksRef.current.set(newKey, [...newStack, pf.id]);

          pf.col = nextCol;
          pf.row = nextRow;
          pf.stackLevel = newLevel;
          const w = gridToWorld(nextCol, nextRow);
          const y = getTileBaseY(selectedMapRef.current, nextCol, nextRow) + newLevel * FROG_STACK_HEIGHT;
          pf.startY = pf.worldPos.y;
          pf.targetWorldPos.set(w.x, y, w.z);
          pf.isHopping = true;
          pf.hopProgress = 0;
          break;
        }
      }
    });

    audioService.playChime();
    showSuperpowerToast('✨ Scattered frogs across the pond!', '✨');
  }, [getTileKey, gridToWorld, getTileBaseY, showSuperpowerToast]);

  // Socket Superpower Listeners
  useEffect(() => {
    const handleRemoteBombPlanted = (data: any) => {
      if (data.planterId !== localPlayerIdRef.current) {
        window.dispatchEvent(
          new CustomEvent('plant_bomb_scene', {
            detail: { id: data.id, col: data.col, row: data.row, mapName: data.mapName, planterId: data.planterId },
          })
        );
      }
    };

    const handleRemoteBombDetonated = (data: any) => {
      window.dispatchEvent(
        new CustomEvent('detonate_bomb_scene', {
          detail: { bombId: data.bombId, col: data.col, row: data.row, mapName: data.mapName },
        })
      );
    };

    const handleRemoteFrogPushed = (data: any) => {
      if (data.targetPlayerId === localPlayerIdRef.current) {
        const pushDestCol = data.toCol;
        const pushDestRow = data.toRow;
        localGridPosRef.current = { col: pushDestCol, row: pushDestRow };
        const w = gridToWorld(pushDestCol, pushDestRow);
        const y = getTileBaseY(selectedMapRef.current, pushDestCol, pushDestRow);
        startWorldYRef.current = localWorldPosRef.current.y;
        targetWorldPosRef.current = { x: w.x, y, z: w.z };
        isHoppingRef.current = true;
        hopProgressRef.current = 0;
        showSuperpowerToast('You were pushed 1 tile back by a tongue whip!', '👅');

        // Check if pushed local player lands on a bomb
        const landingBomb = activeBombsRef.current.find(
          (b) => b.col === pushDestCol && b.row === pushDestRow && b.mapName === selectedMapRef.current
        );
        if (landingBomb) {
          setTimeout(() => {
            detonateBombObj(landingBomb);
          }, 180);
        }
      }
    };

    socketService.on('bomb_planted', handleRemoteBombPlanted);
    socketService.on('bomb_detonated', handleRemoteBombDetonated);
    socketService.on('frog_pushed', handleRemoteFrogPushed);

    return () => {
      socketService.off('bomb_planted', handleRemoteBombPlanted);
      socketService.off('bomb_detonated', handleRemoteBombDetonated);
      socketService.off('frog_pushed', handleRemoteFrogPushed);
    };
  }, [gridToWorld, getTileBaseY, detonateBombObj, showSuperpowerToast]);

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
        keysPressedRef.current[key] = true;
      } else if (key === 'p') {
        e.preventDefault();
        triggerTonguePush();
      } else if (key === 'b') {
        e.preventDefault();
        toggleBombPlacement();
      } else if (key === 't') {
        e.preventDefault();
        formToadTower();
      } else if (key === 'u') {
        e.preventDefault();
        scatterToads();
      } else if (key === 'escape') {
        if (isPlantingBombRef.current) {
          setIsPlantingBomb(false);
          showSuperpowerToast('Bomb targeting cancelled.', '❌');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        keysPressedRef.current[key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerTonguePush, toggleBombPlacement, formToadTower, scatterToads, showSuperpowerToast]);

  // Strict mode firefly timer
  useEffect(() => {
    if (!strictMode) {
      fireflyPosRef.current.active = false;
      return;
    }

    const interval = setInterval(() => {
      if (!fireflyPosRef.current.active && Math.random() < 0.7) {
        const randomCol = Math.floor(4 + Math.random() * 10);
        const randomRow = Math.floor(2 + Math.random() * 8);
        const w = gridToWorld(randomCol, randomRow);
        fireflyPosRef.current = {
          x: w.x,
          y: 2.5 + Math.random() * 1.5,
          z: w.z,
          active: true,
        };
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [strictMode, gridToWorld]);

  // Main Three.js Bloxorz Floating Island Sky Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 500;

    // Bloxorz Isometric Angle Perspective Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
    camera.position.set(16, 18, 22);
    camera.lookAt(0, -0.5, 0);

    // 1. Scene & Atmosphere (Floating Sky Void with Atmospheric Fog)
    const scene = new THREE.Scene();
    if (selectedMap === 'starry_night') {
      scene.background = new THREE.Color(0x0a1128); // Deep Cobalt Midnight Blue
      scene.fog = new THREE.FogExp2(0x0a1128, 0.02); // Rich Van Gogh twilight atmospheric fog
    } else {
      scene.background = new THREE.Color(0x3d7068); // Sky blue-teal
      scene.fog = new THREE.FogExp2(0x3d7068, 0.025);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(
      selectedMap === 'starry_night' ? 0x324b8c : 0xffffff,
      selectedMap === 'starry_night' ? 1.4 : 1.2
    );
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(
      selectedMap === 'starry_night' ? 0xfadb14 : 0xfff3d1,
      selectedMap === 'starry_night' ? 2.2 : 1.8
    );
    sunLight.position.set(15, 25, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -16;
    sunLight.shadow.camera.right = 16;
    sunLight.shadow.camera.top = 16;
    sunLight.shadow.camera.bottom = -16;
    scene.add(sunLight);

    const skyHemiLight = new THREE.HemisphereLight(
      selectedMap === 'starry_night' ? 0x3b82f6 : 0xbbe1fa,
      selectedMap === 'starry_night' ? 0x1e1b4b : 0x1b262c,
      0.8
    );
    scene.add(skyHemiLight);

    // 3. Materials for Voxel / Blocky Island Grid
    const grassTopMat = new THREE.MeshStandardMaterial({ color: 0x529432, roughness: 0.7 });
    const grassSideMat = new THREE.MeshStandardMaterial({ color: 0x5a3921, roughness: 0.9 }); // Dirt cliff
    const grassMaterials = [
      grassSideMat, grassSideMat, grassTopMat, grassSideMat, grassSideMat, grassSideMat
    ];

    // Starry Night Van Gogh Map Materials
    const starryGrassTopMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6, emissive: 0x0f172a, emissiveIntensity: 0.35 });
    const starryGrassSideMat = new THREE.MeshStandardMaterial({ color: 0x0a1128, roughness: 0.9 });
    const starryGrassMaterials = [
      starryGrassSideMat, starryGrassSideMat, starryGrassTopMat, starryGrassSideMat, starryGrassSideMat, starryGrassSideMat
    ];

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2f7585,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.88,
    });

    const starryWaterMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.45,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.9,
    });

    const mountainRockMat = new THREE.MeshStandardMaterial({ color: 0x48525a, roughness: 0.85 });
    const mountainTopMat = new THREE.MeshStandardMaterial({ color: 0x3d703b, roughness: 0.7 });
    const stairStepMat = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      emissive: 0x1b7280,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.88,
      roughness: 0.2,
    });
    const stairTrimMat = new THREE.MeshStandardMaterial({
      color: 0x2980b9,
      emissive: 0x1b7280,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.9,
      roughness: 0.2,
    });
    const waterfallMat = new THREE.MeshStandardMaterial({
      color: 0x7ed6df,
      emissive: 0x1b7280,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });

    const riverRockMat1 = new THREE.MeshStandardMaterial({ color: 0x5a6858, roughness: 0.85 }); // Mossy Slate
    const riverRockMat2 = new THREE.MeshStandardMaterial({ color: 0x768273, roughness: 0.8 });  // Smooth River Pebble
    const starryRockMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.45, roughness: 0.6 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x633815, roughness: 0.8 });
    const innerWoodMat = new THREE.MeshStandardMaterial({ color: 0xd4a56a, roughness: 0.7 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x427333, roughness: 0.9 });
    const shroomStemMat = new THREE.MeshStandardMaterial({ color: 0xf3ebd8, roughness: 0.5 });
    const shroomCapMat = new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.4 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d6e2c, roughness: 0.6 });
    const pineLeafMat = new THREE.MeshStandardMaterial({ color: 0x1d4d29, roughness: 0.6 });
    const redLeafMat = new THREE.MeshStandardMaterial({ color: 0xbc2d19, roughness: 0.6 });
    const redLeafTopMat = new THREE.MeshStandardMaterial({ color: 0xda5a24, roughness: 0.6 });

    // Starry Night Tree Foliage & Building Materials
    const starryLeafBlueMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, emissive: 0x2563eb, emissiveIntensity: 0.35, roughness: 0.5 });
    const starryLeafGoldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, emissive: 0xfacc15, emissiveIntensity: 0.5, roughness: 0.4 });
    const starryStarGlowMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.8, roughness: 0.3 });
    const villageWallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const villageRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.7 });
    const chaletTimberMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.85 });
    const chaletRoofMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.7 });
    const towerStoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
    const workshopRoofMat = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.65 });
    const churchWallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.65 });
    const churchSpireMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, emissive: 0x94a3b8, emissiveIntensity: 0.2 });
    const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const cypressDarkMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.85 });
    const cypressNavyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

    const ashMat = new THREE.MeshStandardMaterial({ color: 0x221a14, roughness: 0.95 });
    const emberMat = new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0xff3300, emissiveIntensity: 2.0, roughness: 0.3 });
    const flameBaseMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff3300, emissiveIntensity: 2.5, transparent: true, opacity: 0.92 });
    const flameMidMat = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xffaa00, emissiveIntensity: 3.0, transparent: true, opacity: 0.95 });
    const flameCoreMat = new THREE.MeshStandardMaterial({ color: 0xfff066, emissive: 0xfff066, emissiveIntensity: 3.5 });

    // 4. Construct Floating Island / Waterfall Mountain 3D Block Grid & Moving Water Array
    const islandGroup = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(TILE_SIZE, 1.0, TILE_SIZE);
    const waterGeo = new THREE.BoxGeometry(TILE_SIZE, 0.4, TILE_SIZE);

    const waterMeshes: { mesh: THREE.Mesh; initY: number; gridX: number; gridZ: number }[] = [];
    const bonfireAnims: {
      flameOuter: THREE.Mesh;
      flameMid: THREE.Mesh;
      flameInner: THREE.Mesh;
      fireLight: THREE.PointLight;
      embersList: { mesh: THREE.Mesh; initY: number; speed: number; phase: number }[];
      centerX: number;
      centerZ: number;
      baseY: number;
    }[] = [];
    const activeTileMap = selectedMap === 'starry_night' ? STARRY_NIGHT_TILE_MAP : (selectedMap === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tileType = activeTileMap[r][c];
        if (tileType === '.') continue; // Void

        const { x, z } = gridToWorld(c, r);
        const tileBaseY = getGroundElevation(selectedMap, c, r);

        if (tileType === 'W' || tileType === 'L' || tileType === 'F') {
          // Water Block
          const waterHeight = tileBaseY + 0.15;
          const wMesh = new THREE.Mesh(waterGeo, selectedMap === 'starry_night' ? starryWaterMat : waterMat);
          wMesh.position.set(x, waterHeight, z);
          wMesh.receiveShadow = true;
          islandGroup.add(wMesh);

          waterMeshes.push({ mesh: wMesh, initY: waterHeight, gridX: x, gridZ: z });

          // Cliff Extension going down into the sky below the water tile
          const cliffGeo = new THREE.BoxGeometry(TILE_SIZE, 3.5, TILE_SIZE);
          const cliffMesh = new THREE.Mesh(cliffGeo, selectedMap === 'starry_night' ? starryGrassSideMat : grassSideMat);
          cliffMesh.position.set(x, -2.25, z);
          islandGroup.add(cliffMesh);

          // If elevated water source (e.g. Mountain Spring 'F' or elevated water on waterfall map)
          if (selectedMap === 'waterfall' && tileBaseY > 0.3) {
            const bedHeight = tileBaseY - 0.55;
            if (bedHeight > 0.01) {
              const bedGeo = new THREE.BoxGeometry(TILE_SIZE, bedHeight, TILE_SIZE);
              const bedMesh = new THREE.Mesh(bedGeo, stairStepMat);
              bedMesh.position.set(x, 0.5 + bedHeight / 2, z);
              bedMesh.receiveShadow = true;
              islandGroup.add(bedMesh);
            }
          }

          // Lily pad on top strictly for 'L' tiles
          if (tileType === 'L') {
            const padGeo = new THREE.CylinderGeometry(TILE_SIZE * 0.38, TILE_SIZE * 0.38, 0.08, 16);
            const padMat = selectedMap === 'starry_night'
              ? new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x3b82f6, emissiveIntensity: 0.4, roughness: 0.5 })
              : new THREE.MeshStandardMaterial({ color: 0x2e7a3a, roughness: 0.6 });
            const padMesh = new THREE.Mesh(padGeo, padMat);
            padMesh.position.set(x, tileBaseY + 0.38, z);
            padMesh.receiveShadow = true;
            islandGroup.add(padMesh);

            if (selectedMap === 'starry_night') {
              // Glowing yellow star blossom center
              const starCenterGeo = new THREE.DodecahedronGeometry(0.12, 1);
              const starCenterMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
              const starCenter = new THREE.Mesh(starCenterGeo, starCenterMat);
              starCenter.position.set(x, tileBaseY + 0.44, z);
              islandGroup.add(starCenter);
            }
          }
        } else {
          // Solid Ground Block
          const block = new THREE.Mesh(boxGeo, selectedMap === 'starry_night' ? starryGrassMaterials : grassMaterials);
          block.position.set(x, 0, z);
          block.castShadow = true;
          block.receiveShadow = true;
          islandGroup.add(block);

          // Cliff Extension going down into the sky below the island
          const cliffGeo = new THREE.BoxGeometry(TILE_SIZE, 3.5, TILE_SIZE);
          const cliffMesh = new THREE.Mesh(cliffGeo, selectedMap === 'starry_night' ? starryGrassSideMat : grassSideMat);
          cliffMesh.position.set(x, -2.25, z);
          islandGroup.add(cliffMesh);

          // Mountain Step Tiers for Waterfall Map (Natural Earth / Rock Block Tiers)
          if (selectedMap === 'waterfall' && tileBaseY > 0.3) {
            const stepHeight = tileBaseY - 0.3;
            if (stepHeight > 0.01) {
              const stepGeo = new THREE.BoxGeometry(TILE_SIZE, stepHeight, TILE_SIZE);
              const isPeak = (r === 3 || r === 4) && (c === 10 || c === 11);
              const topMat = isPeak ? mountainTopMat : (tileType === 'M' ? mountainRockMat : grassTopMat);
              const sideMat = isPeak || tileType === 'M' ? mountainRockMat : grassSideMat;
              const stepMaterials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
              const stepMesh = new THREE.Mesh(stepGeo, stepMaterials);
              stepMesh.position.set(x, 0.5 + stepHeight / 2, z);
              stepMesh.castShadow = true;
              stepMesh.receiveShadow = true;
              islandGroup.add(stepMesh);
            }
          }

          // Decor items on top of blocks
          if (tileType === 'Y') {
            // --- THE GIANT VAN GOGH CYPRESS TREE (CENTER-LEFT R5 C5) ---
            if (r === 5 && c === 5) {
              const cypressGroup = new THREE.Group();
              cypressGroup.position.set(x, tileBaseY, z);

              // 1. Massive Tall Dark Cypress Trunk
              const trunkGeo = new THREE.BoxGeometry(0.85, 3.2, 0.85);
              const cypressTrunk = new THREE.Mesh(trunkGeo, darkWoodMat);
              cypressTrunk.position.set(0, 1.6, 0);
              cypressTrunk.castShadow = true;
              cypressGroup.add(cypressTrunk);

              // 2. Multi-tier Flame-like Swirling Foliage Layers (10 Tiers reaching height Y = 9.8!)
              const tierConfigs = [
                { y: 2.0, w: 2.4, h: 1.6, d: 2.4, mat: cypressDarkMat, rot: 0.1 },
                { y: 3.2, w: 2.1, h: 1.5, d: 2.1, mat: starryLeafBlueMat, rot: -0.2 },
                { y: 4.3, w: 1.8, h: 1.4, d: 1.8, mat: cypressNavyMat, rot: 0.3 },
                { y: 5.3, w: 1.6, h: 1.4, d: 1.6, mat: starryLeafGoldMat, rot: -0.15 },
                { y: 6.3, w: 1.3, h: 1.3, d: 1.3, mat: cypressDarkMat, rot: 0.25 },
                { y: 7.2, w: 1.1, h: 1.2, d: 1.1, mat: starryLeafBlueMat, rot: -0.3 },
                { y: 8.0, w: 0.8, h: 1.1, d: 0.8, mat: starryLeafGoldMat, rot: 0.2 },
                { y: 8.8, w: 0.5, h: 0.9, d: 0.5, mat: cypressNavyMat, rot: -0.1 },
                { y: 9.4, w: 0.3, h: 0.7, d: 0.3, mat: starryLeafGoldMat, rot: 0.0 },
              ];

              tierConfigs.forEach((tier) => {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(tier.w, tier.h, tier.d), tier.mat);
                mesh.position.set(0, tier.y, 0);
                mesh.rotation.y = tier.rot;
                mesh.castShadow = true;
                cypressGroup.add(mesh);
              });

              // Spiraling flame branch accents reaching out
              [
                { pos: [0.8, 2.8, 0.6], rot: 0.4, mat: starryLeafGoldMat, size: [0.6, 0.6, 0.6] },
                { pos: [-0.8, 4.2, -0.5], rot: -0.6, mat: cypressDarkMat, size: [0.6, 0.6, 0.6] },
                { pos: [0.6, 5.8, -0.6], rot: 0.8, mat: starryLeafBlueMat, size: [0.5, 0.5, 0.5] },
                { pos: [-0.5, 7.2, 0.5], rot: -0.5, mat: starryLeafGoldMat, size: [0.4, 0.4, 0.4] },
              ].forEach((b) => {
                const branch = new THREE.Mesh(new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]), b.mat);
                branch.position.set(b.pos[0], b.pos[1], b.pos[2]);
                branch.rotation.y = b.rot;
                cypressGroup.add(branch);
              });

              // Radiant Star Light illuminating the Giant Tree
              const treeLight = new THREE.PointLight(0xfacc15, 3.5, 12);
              treeLight.position.set(0, 6.0, 0);
              cypressGroup.add(treeLight);

              islandGroup.add(cypressGroup);
            }
          } else if (tileType === 'P') {
            // --- SAINT-RÉMY VILLAGE CHURCH WITH TALL STEEPLE SPIRE ---
            if (r === 5 && c === 13) {
              const churchGroup = new THREE.Group();
              churchGroup.position.set(x, tileBaseY, z);

              // 1. Church Base Chapel Building
              const chapelGeo = new THREE.BoxGeometry(1.8, 1.6, 1.4);
              const chapelMesh = new THREE.Mesh(chapelGeo, churchWallMat);
              chapelMesh.position.set(0, 0.8, 0);
              chapelMesh.castShadow = true;
              churchGroup.add(chapelMesh);

              // Chapel Pitched Roof
              const roofGeo = new THREE.ConeGeometry(1.4, 0.8, 4);
              const roofMesh = new THREE.Mesh(roofGeo, villageRoofMat);
              roofMesh.position.set(0, 2.0, 0);
              roofMesh.rotation.y = Math.PI / 4;
              roofMesh.castShadow = true;
              churchGroup.add(roofMesh);

              // 2. Square Bell Tower
              const towerGeo = new THREE.BoxGeometry(0.9, 3.0, 0.9);
              const towerMesh = new THREE.Mesh(towerGeo, churchWallMat);
              towerMesh.position.set(0, 1.5, -0.2);
              towerMesh.castShadow = true;
              churchGroup.add(towerMesh);

              // Stained Glass Windows
              const winGeo = new THREE.BoxGeometry(0.3, 0.6, 0.05);
              const win1 = new THREE.Mesh(winGeo, windowGlowMat);
              win1.position.set(0, 1.2, 0.72);
              const win2 = new THREE.Mesh(winGeo, windowGlowMat);
              win2.position.set(0, 2.4, 0.26);
              churchGroup.add(win1, win2);

              // 3. Iconic Tall White Pyramidal Steeple Spire (Reaching up to Y = 6.8!)
              const spireGeo = new THREE.ConeGeometry(0.55, 3.2, 4);
              const spireMesh = new THREE.Mesh(spireGeo, churchSpireMat);
              spireMesh.position.set(0, 4.6, -0.2);
              spireMesh.rotation.y = Math.PI / 4;
              spireMesh.castShadow = true;
              churchGroup.add(spireMesh);

              // Golden Cross / Star ornament on top
              const starTopGeo = new THREE.DodecahedronGeometry(0.18, 1);
              const starTop = new THREE.Mesh(starTopGeo, windowGlowMat);
              starTop.position.set(0, 6.3, -0.2);
              churchGroup.add(starTop);

              // Light inside Church
              const churchLight = new THREE.PointLight(0xfde047, 2.0, 8);
              churchLight.position.set(0, 2.0, 0);
              churchGroup.add(churchLight);

              islandGroup.add(churchGroup);
            }
          } else if (tileType === 'H') {
            // --- VILLAGE COTTAGES (4 Unique Architectural Variants) ---
            const houseGroup = new THREE.Group();
            houseGroup.position.set(x, tileBaseY, z);
            const houseVariant = (r * 7 + c * 13) % 4;

            if (houseVariant === 0) {
              // Variant 0: Classic Saint-Rémy Gabled Cottage with Chimney
              const houseBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.95), villageWallMat);
              houseBase.position.set(0, 0.425, 0);
              houseBase.castShadow = true;

              const houseRoof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.55, 4), villageRoofMat);
              houseRoof.position.set(0, 1.1, 0);
              houseRoof.rotation.y = Math.PI / 4;
              houseRoof.castShadow = true;

              const win = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.04), windowGlowMat);
              win.position.set(0, 0.45, 0.49);

              const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), churchWallMat);
              chimney.position.set(0.25, 1.25, -0.2);
              chimney.castShadow = true;

              const chimneySmoke = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 1), starryStarGlowMat);
              chimneySmoke.position.set(0.25, 1.6, -0.2);

              const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.04), woodMat);
              door.position.set(-0.25, 0.21, 0.49);

              houseGroup.add(houseBase, houseRoof, win, chimney, chimneySmoke, door);
            } else if (houseVariant === 1) {
              // Variant 1: Twin-Gable Artisan Workshop / Double Wing Cottage
              const mainBase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.9), chaletTimberMat);
              mainBase.position.set(-0.2, 0.425, 0);
              mainBase.castShadow = true;

              const annexBase = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.75), villageWallMat);
              annexBase.position.set(0.3, 0.325, 0.05);
              annexBase.castShadow = true;

              const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 4), workshopRoofMat);
              mainRoof.position.set(-0.2, 1.05, 0);
              mainRoof.rotation.y = Math.PI / 4;
              mainRoof.castShadow = true;

              const annexRoof = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.4, 4), villageRoofMat);
              annexRoof.position.set(0.3, 0.82, 0.05);
              annexRoof.rotation.y = Math.PI / 4;
              annexRoof.castShadow = true;

              const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.04), windowGlowMat);
              win1.position.set(-0.2, 0.45, 0.46);
              const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.04), windowGlowMat);
              win2.position.set(0.3, 0.38, 0.43);

              const planter = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.1), woodMat);
              planter.position.set(-0.2, 0.3, 0.5);
              const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 1), starryLeafGoldMat);
              flower.position.set(-0.2, 0.36, 0.5);

              houseGroup.add(mainBase, annexBase, mainRoof, annexRoof, win1, win2, planter, flower);
            } else if (houseVariant === 2) {
              // Variant 2: Round Thatched Star-Tower Cottage
              const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.85, 8), towerStoneMat);
              towerBase.position.set(0, 0.425, 0);
              towerBase.castShadow = true;

              const conicalRoof = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.7, 8), cypressNavyMat);
              conicalRoof.position.set(0, 1.15, 0);
              conicalRoof.castShadow = true;

              const starFinial = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 1), starryStarGlowMat);
              starFinial.position.set(0, 1.55, 0);

              const winRound = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 8), windowGlowMat);
              winRound.rotation.x = Math.PI / 2;
              winRound.position.set(0, 0.55, 0.5);

              const doorArch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.06), woodMat);
              doorArch.position.set(0, 0.2, 0.5);

              houseGroup.add(towerBase, conicalRoof, starFinial, winRound, doorArch);
            } else {
              // Variant 3: Alpine Timber Chalet with Balcony & Warm Lantern
              const chaletBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 0.9), chaletTimberMat);
              chaletBase.position.set(0, 0.425, 0);
              chaletBase.castShadow = true;

              const chaletRoof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.55, 4), chaletRoofMat);
              chaletRoof.position.set(0, 1.1, 0);
              chaletRoof.rotation.y = Math.PI / 4;
              chaletRoof.castShadow = true;

              const balcony = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.18), woodMat);
              balcony.position.set(0, 0.5, 0.52);

              const upperWin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.04), windowGlowMat);
              upperWin.position.set(0, 0.6, 0.46);

              const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), windowGlowMat);
              lantern.position.set(0.32, 0.45, 0.52);

              const lanternLight = new THREE.PointLight(0xfacc15, 1.0, 3.0);
              lanternLight.position.set(0.32, 0.45, 0.6);
              houseGroup.add(lanternLight);

              houseGroup.add(chaletBase, chaletRoof, balcony, upperWin, lantern);
            }

            islandGroup.add(houseGroup);
          } else if (tileType === 'S') {
            // Natural Shoreline River Boulders & Star Rocks
            const rockMatToUse = selectedMap === 'starry_night' ? starryRockMat : riverRockMat1;
            const boulderGeo = new THREE.DodecahedronGeometry(0.38, 1);
            const boulder = new THREE.Mesh(boulderGeo, rockMatToUse);
            boulder.scale.set(1.1, 0.65, 0.9);
            boulder.position.set(x + 0.1, tileBaseY + 0.22, z - 0.08);
            boulder.rotation.y = (r + c) * 0.7;
            boulder.castShadow = true;
            boulder.receiveShadow = true;

            const smallRockGeo = new THREE.DodecahedronGeometry(0.24, 1);
            const smallRock = new THREE.Mesh(smallRockGeo, selectedMap === 'starry_night' ? starryRockMat : riverRockMat2);
            smallRock.scale.set(0.9, 0.55, 1.1);
            smallRock.position.set(x - 0.22, tileBaseY + 0.15, z + 0.15);
            smallRock.rotation.y = (r * c) * 1.3;
            smallRock.castShadow = true;

            islandGroup.add(boulder, smallRock);
          } else if (tileType === 'T') {
            // Diverse Voxel Tree Varieties
            const treeVariant = (r * 7 + c * 11) % 3;

            if (selectedMap === 'starry_night') {
              // Starry Night Van Gogh Voxel Trees
              const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5, 0.35), darkWoodMat);
              trunk.position.set(x, tileBaseY + 0.95, z);
              trunk.castShadow = true;

              const canopy1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), starryLeafBlueMat);
              canopy1.position.set(x, tileBaseY + 1.9, z);
              canopy1.castShadow = true;

              const canopy2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), starryLeafGoldMat);
              canopy2.position.set(x, tileBaseY + 2.6, z);
              canopy2.castShadow = true;

              islandGroup.add(trunk, canopy1, canopy2);
            } else if (treeVariant === 1) {
              // --- Evergreen Pine Tree ---
              const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, 0.3), woodMat);
              trunk.position.set(x, tileBaseY + 1.0, z);
              trunk.castShadow = true;

              const tier1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 1.3), pineLeafMat);
              tier1.position.set(x, tileBaseY + 1.4, z);
              tier1.castShadow = true;

              const tier2 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.95), pineLeafMat);
              tier2.position.set(x, tileBaseY + 1.95, z);
              tier2.castShadow = true;

              const tier3 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.55), pineLeafMat);
              tier3.position.set(x, tileBaseY + 2.5, z);
              tier3.castShadow = true;

              islandGroup.add(trunk, tier1, tier2, tier3);
            } else if (treeVariant === 2) {
              // --- Autumn Red Leaf / Maple Tree ---
              const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.35), woodMat);
              trunk.position.set(x, tileBaseY + 0.9, z);
              trunk.castShadow = true;

              const mainCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.25, 1.3), redLeafMat);
              mainCanopy.position.set(x, tileBaseY + 1.85, z);
              mainCanopy.castShadow = true;

              const topHighlight = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.85), redLeafTopMat);
              topHighlight.position.set(x, tileBaseY + 2.6, z);
              topHighlight.castShadow = true;

              islandGroup.add(trunk, mainCanopy, topHighlight);
            } else {
              // --- Standard Lush Green Oak Tree ---
              const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.35), woodMat);
              trunk.position.set(x, tileBaseY + 0.9, z);
              trunk.castShadow = true;

              const mainCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.3, 1.25), leafMat);
              mainCanopy.position.set(x, tileBaseY + 1.9, z);
              mainCanopy.castShadow = true;

              const topCap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.85), leafMat);
              topCap.position.set(x, tileBaseY + 2.65, z);
              topCap.castShadow = true;

              islandGroup.add(trunk, mainCanopy, topCap);
            }
          } else if (tileType === 'B') {
            // Voxel Bush
            const bushMatToUse = selectedMap === 'starry_night' ? starryLeafBlueMat : leafMat;
            const bush = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), bushMatToUse);
            bush.position.set(x, tileBaseY + 0.5, z);
            bush.castShadow = true;
            islandGroup.add(bush);
          } else if (tileType === 'O') {
            if (r === 2 && c === 6 && selectedMap === 'island') {
              // --- GIANT ANCIENT FALLEN LOG BEHIND THE POND ---
              const giantLogGroup = new THREE.Group();

              // Spans 5 tiles from c=6 to c=10
              const logLength = 5 * TILE_SIZE;
              const { x: startX } = gridToWorld(6, 2);
              const { x: endX } = gridToWorld(10, 2);
              const logCenterX = (startX + endX) / 2;
              const { z: logCenterZ } = gridToWorld(8, 2);

              // Main Trunk (Cylinder rotated along X-axis)
              const trunkGeo = new THREE.CylinderGeometry(0.48, 0.54, logLength, 16);
              const mainTrunk = new THREE.Mesh(trunkGeo, woodMat);
              mainTrunk.rotation.z = Math.PI / 2;
              mainTrunk.position.set(logCenterX, 0.78, logCenterZ);
              mainTrunk.castShadow = true;
              mainTrunk.receiveShadow = true;
              giantLogGroup.add(mainTrunk);

              // Cut Ring Face at Left End
              const cutRingLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.04, 16), innerWoodMat);
              cutRingLeft.rotation.z = Math.PI / 2;
              cutRingLeft.position.set(logCenterX - logLength / 2 - 0.02, 0.78, logCenterZ);
              cutRingLeft.castShadow = true;
              giantLogGroup.add(cutRingLeft);

              // Cut Ring Face at Right End
              const cutRingRight = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.04, 16), innerWoodMat);
              cutRingRight.rotation.z = Math.PI / 2;
              cutRingRight.position.set(logCenterX + logLength / 2 + 0.02, 0.78, logCenterZ);
              cutRingRight.castShadow = true;
              giantLogGroup.add(cutRingRight);

              // Bark Knot Rings & Accents
              [-1.8, -0.4, 1.2].forEach((offset) => {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.04, 8, 16), darkWoodMat);
                ring.rotation.y = Math.PI / 2;
                ring.position.set(logCenterX + offset, 0.78, logCenterZ);
                ring.castShadow = true;
                giantLogGroup.add(ring);
              });

              islandGroup.add(giantLogGroup);
            } else if (r === 2 && c > 6 && c <= 10 && selectedMap === 'island') {
              // Giant log tile span
            } else {
              // Standard Fallen Log Block
              const log = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE * 0.9, 0.45, 0.45), woodMat);
              log.position.set(x, tileBaseY + 0.4, z);
              log.castShadow = true;
              islandGroup.add(log);
            }
          } else if (tileType === 'C') {
            // --- FIRE BONFIRE / CAMPFIRE ---
            const bonfireGroup = new THREE.Group();

            // 1. Pit Stone Ring (Circle of small river rocks)
            const rockCount = 8;
            const radius = 0.38;
            for (let i = 0; i < rockCount; i++) {
              const angle = (i / rockCount) * Math.PI * 2;
              const rockGeo = new THREE.DodecahedronGeometry(0.11 + Math.random() * 0.03, 1);
              const rockMesh = new THREE.Mesh(rockGeo, riverRockMat1);
              rockMesh.scale.set(1.0, 0.7, 1.0);
              rockMesh.position.set(x + Math.cos(angle) * radius, tileBaseY + 0.1, z + Math.sin(angle) * radius);
              rockMesh.rotation.y = angle + Math.random();
              rockMesh.castShadow = true;
              bonfireGroup.add(rockMesh);
            }

            // 2. Ash / Charcoal Pit Base
            const ashGeo = new THREE.CylinderGeometry(0.32, 0.35, 0.08, 12);
            const ashMesh = new THREE.Mesh(ashGeo, ashMat);
            ashMesh.position.set(x, tileBaseY + 0.08, z);
            ashMesh.receiveShadow = true;
            bonfireGroup.add(ashMesh);

            // 3. Glowing Embers Center Core
            const emberGeo = new THREE.DodecahedronGeometry(0.22, 1);
            const emberMesh = new THREE.Mesh(emberGeo, emberMat);
            emberMesh.position.set(x, tileBaseY + 0.16, z);
            bonfireGroup.add(emberMesh);

            // 4. Criss-Cross Wood Logs Structure (Teepee / Pyre structure)
            const logGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.65, 8);
            for (let i = 0; i < 4; i++) {
              const logAngle = (i / 4) * Math.PI * 2 + Math.PI / 4;
              const logMesh = new THREE.Mesh(logGeo, darkWoodMat);
              logMesh.position.set(
                x + Math.cos(logAngle) * 0.12,
                tileBaseY + 0.24,
                z + Math.sin(logAngle) * 0.12
              );
              logMesh.rotation.y = logAngle;
              logMesh.rotation.z = Math.PI / 3.8;
              logMesh.castShadow = true;
              bonfireGroup.add(logMesh);
            }

            // 5. Layered Animated Flames (3 Voxel / Cone Pyramids)
            const flameOuterGeo = new THREE.ConeGeometry(0.26, 0.55, 6);
            const flameOuter = new THREE.Mesh(flameOuterGeo, flameBaseMat);
            flameOuter.position.set(x, tileBaseY + 0.42, z);

            const flameMidGeo = new THREE.ConeGeometry(0.19, 0.45, 6);
            const flameMid = new THREE.Mesh(flameMidGeo, flameMidMat);
            flameMid.position.set(x, tileBaseY + 0.46, z);

            const flameInnerGeo = new THREE.ConeGeometry(0.12, 0.32, 6);
            const flameInner = new THREE.Mesh(flameInnerGeo, flameCoreMat);
            flameInner.position.set(x, tileBaseY + 0.5, z);

            bonfireGroup.add(flameOuter, flameMid, flameInner);

            // 6. Warm Dynamic Point Light casting glow onto environment
            const fireLight = new THREE.PointLight(0xff7700, 2.8, 6.5);
            fireLight.position.set(x, tileBaseY + 0.65, z);
            fireLight.castShadow = true;
            bonfireGroup.add(fireLight);

            // 7. Floating Fire Spark Embers Array
            const embersList: { mesh: THREE.Mesh; initY: number; speed: number; phase: number }[] = [];
            const sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
            const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
            for (let i = 0; i < 6; i++) {
              const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
              const sx = x + (Math.random() - 0.5) * 0.25;
              const sz = z + (Math.random() - 0.5) * 0.25;
              const sy = tileBaseY + 0.4 + Math.random() * 0.6;
              sparkMesh.position.set(sx, sy, sz);
              bonfireGroup.add(sparkMesh);
              embersList.push({
                mesh: sparkMesh,
                initY: tileBaseY + 0.4,
                speed: 0.6 + Math.random() * 0.8,
                phase: Math.random() * Math.PI * 2,
              });
            }

            bonfireAnims.push({
              flameOuter,
              flameMid,
              flameInner,
              fireLight,
              embersList,
              centerX: x,
              centerZ: z,
              baseY: tileBaseY,
            });

            islandGroup.add(bonfireGroup);
          }
        }
      }
    }

    // Add Cascading Water Spring & Pool Foams on Waterfall Mountain map flowing from peak r3c10 down to valley
    if (selectedMap === 'waterfall') {
      const waterfallGroup = new THREE.Group();

      const { x: wfX } = gridToWorld(10, 3);
      const { z: botZ } = gridToWorld(10, 7);

      // Foam Splash Ring Pool at Valley Foot (Y=0.35)
      const foamGeo = new THREE.RingGeometry(0.2, TILE_SIZE * 1.2, 16);
      const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const foamMesh = new THREE.Mesh(foamGeo, foamMat);
      foamMesh.rotation.x = -Math.PI / 2;
      foamMesh.position.set(wfX, 0.35, botZ);
      waterfallGroup.add(foamMesh);

      islandGroup.add(waterfallGroup);
    }

    // Add 5 cute mushrooms scattered around the map
    const mushroomSpots = selectedMap === 'waterfall' ? [
      { col: 3, row: 2, offsetX: -0.1, offsetZ: 0.1 },  // Step 4 high mountain
      { col: 11, row: 3, offsetX: 0.15, offsetZ: -0.1 }, // Peak mountain rock
      { col: 3, row: 5, offsetX: -0.2, offsetZ: 0.2 },  // Step 1 terrace
      { col: 12, row: 6, offsetX: 0.1, offsetZ: 0.1 },   // Right riverbank
      { col: 3, row: 9, offsetX: -0.1, offsetZ: -0.1 },  // Meadow shore
    ] : (selectedMap === 'starry_night' ? [
      { col: 3, row: 1, offsetX: -0.1, offsetZ: 0.2 },   // Beside Giant Cypress
      { col: 15, row: 2, offsetX: 0.1, offsetZ: -0.15 }, // Upper village hill
      { col: 9, row: 4, offsetX: 0.15, offsetZ: 0.1 },   // Village plaza meadow
      { col: 14, row: 7, offsetX: -0.2, offsetZ: 0.2 },  // Church courtyard garden
      { col: 4, row: 9, offsetX: 0.2, offsetZ: -0.1 },   // Lower hillside
    ] : [
      { col: 2, row: 1, offsetX: -0.2, offsetZ: 0.2 },  // Top-left woodland
      { col: 1, row: 2, offsetX: 0.18, offsetZ: -0.15 }, // Near left log
      { col: 15, row: 1, offsetX: 0.1, offsetZ: 0.2 },   // Top-right grove
      { col: 14, row: 4, offsetX: -0.2, offsetZ: 0.2 },  // Right pond shore
      { col: 3, row: 8, offsetX: 0.2, offsetZ: -0.1 },   // Bottom-left forest floor
    ]);

    mushroomSpots.forEach((spot) => {
      const { x, z } = gridToWorld(spot.col, spot.row);
      const baseY = getGroundElevation(selectedMap, spot.col, spot.row);
      const shroomGroup = new THREE.Group();
      shroomGroup.position.set(x + spot.offsetX, baseY + 0.1, z + spot.offsetZ);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.28, 8), shroomStemMat);
      stem.position.y = 0.14;
      stem.castShadow = true;

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 8), shroomCapMat);
      cap.position.y = 0.28;
      cap.castShadow = true;

      shroomGroup.add(stem, cap);
      islandGroup.add(shroomGroup);
    });

    scene.add(islandGroup);

    // 4.5. Tile Numbers Group for Dev Switch (Displays tile numbers in the middle of each tile)
    const createTileLabelTexture = (r: number, c: number, char: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const isVoid = char === '.';

      // Badge background
      ctx.fillStyle = isVoid ? 'rgba(15, 23, 42, 0.88)' : 'rgba(6, 78, 59, 0.94)';
      ctx.strokeStyle = isVoid ? 'rgba(148, 163, 184, 0.7)' : 'rgba(52, 211, 153, 0.95)';
      ctx.lineWidth = 6;

      ctx.fillRect(6, 6, 116, 116);
      ctx.strokeRect(6, 6, 116, 116);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Row & Column coordinates e.g. "r4,c8"
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`r${r},c${c}`, 64, 42);

      // Tile character & Index e.g. "'W' #80"
      ctx.fillStyle = isVoid ? '#94a3b8' : '#6ee7b7';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`'${char}' #${r * COLS + c}`, 64, 84);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const tileNumbersGroup = new THREE.Group();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tileChar = activeTileMap[r][c];
        const { x, z } = gridToWorld(c, r);
        const tileBaseY = getTileBaseY(selectedMap, c, r);

        let labelY = 0.52;
        if (tileChar === '.') {
          labelY = 0.15;
        } else if (tileChar === 'W' || tileChar === 'L' || tileChar === 'F') {
          labelY = tileBaseY + 0.25;
        } else if (tileChar === 'B') {
          labelY = tileBaseY + 0.9;
        } else if (tileChar === 'C') {
          labelY = tileBaseY + 0.85;
        } else if (tileChar === 'O') {
          labelY = tileBaseY + 0.72;
        } else if (tileChar === 'S') {
          labelY = tileBaseY + 0.55;
        } else if (tileChar === 'T') {
          labelY = tileBaseY + 0.55;
        } else {
          labelY = (selectedMap === 'waterfall' && tileBaseY > 0.3) ? tileBaseY + 0.25 : 0.55;
        }

        const texture = createTileLabelTexture(r, c, tileChar);
        if (texture) {
          const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
          const sprite = new THREE.Sprite(mat);
          sprite.scale.set(0.9, 0.9, 1.0);
          sprite.position.set(x, labelY, z);
          sprite.renderOrder = 999;
          tileNumbersGroup.add(sprite);
        }
      }
    }
    tileNumbersGroup.visible = showTileNumbersRef.current;
    scene.add(tileNumbersGroup);

    // 5. Drifting Clouds beneath and around the Floating Island
    const cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      transparent: true,
      opacity: 0.75,
    });

    const createCloudCluster = (cx: number, cy: number, cz: number) => {
      const cluster = new THREE.Group();
      if (selectedMap === 'starry_night') {
        const blueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5, transparent: true, opacity: 0.85, emissive: 0x1d4ed8, emissiveIntensity: 0.25 });
        const darkBlueMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6, transparent: true, opacity: 0.85, emissive: 0x0f172a, emissiveIntensity: 0.25 });
        const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, transparent: true, opacity: 0.9, emissive: 0xfadb14, emissiveIntensity: 0.5 });
        const mats = [blueMat, darkBlueMat, yellowMat];

        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2;
          const radius = 1.2 + (i % 3) * 0.7;
          const cloudGeo = new THREE.BoxGeometry(2.5 + (i % 2) * 1.2, 1.2 + (i % 3) * 0.4, 2.2 + (i % 2) * 1.0);
          const mat = mats[i % 3];
          const cloudMesh = new THREE.Mesh(cloudGeo, mat);
          cloudMesh.position.set(
            Math.cos(angle) * radius,
            (i % 3) * 0.35 - 0.3,
            Math.sin(angle) * radius
          );
          cloudMesh.rotation.y = angle + 0.3;
          cluster.add(cloudMesh);
        }
      } else {
        for (let i = 0; i < 5; i++) {
          const cloudGeo = new THREE.BoxGeometry(3 + Math.random() * 3, 1.5 + Math.random(), 3 + Math.random() * 3);
          const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
          cloudMesh.position.set(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 4
          );
          cluster.add(cloudMesh);
        }
      }
      cluster.position.set(cx, cy, cz);
      return cluster;
    };

    const CLOUD_POSITIONS = [
      { x: -18, y: -6, z: -10 },
      { x: 15, y: -8, z: -15 },
      { x: -12, y: -7, z: 12 },
      { x: 18, y: -5, z: 10 },
      { x: 0, y: -10, z: -20 },
      { x: -22, y: -9, z: 5 },
    ];
    CLOUD_POSITIONS.forEach((cp) => cloudsGroup.add(createCloudCluster(cp.x, cp.y, cp.z)));
    scene.add(cloudsGroup);

    // Van Gogh Masterpiece Sky & Horizon for Starry Night
    if (selectedMap === 'starry_night') {
      // --- 1. SWIRLING HORIZONTAL VAN GOGH CLOUD WAVE (S-CURVE RIBBON) ---
      const cloudWaveGroup = new THREE.Group();
      const waveMats = [
        new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.4, transparent: true, opacity: 0.9, emissive: 0xbae6fd, emissiveIntensity: 0.35 }),
        new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.5, transparent: true, opacity: 0.85, emissive: 0x38bdf8, emissiveIntensity: 0.3 }),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6, transparent: true, opacity: 0.85, emissive: 0x1d4ed8, emissiveIntensity: 0.25 }),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3, transparent: true, opacity: 0.95, emissive: 0xfacc15, emissiveIntensity: 0.5 }),
      ];

      // Generate block segments forming the double S-curve ribbon across the sky right behind the island
      for (let i = 0; i < 90; i++) {
        const progress = (i / 90) * 26 - 13; // X from -13 to +13
        const waveY = 6.2 + Math.sin(progress * 0.28) * 1.5 + Math.cos(progress * 0.14) * 0.8;
        const waveZ = -8.2 + Math.cos(progress * 0.22) * 1.2;

        const blkGeo = new THREE.BoxGeometry(
          1.2 + Math.sin(i * 0.3) * 0.4,
          0.7 + Math.cos(i * 0.4) * 0.3,
          1.2 + Math.sin(i * 0.5) * 0.4
        );
        const blkMat = waveMats[i % 4];
        const blkMesh = new THREE.Mesh(blkGeo, blkMat);
        blkMesh.position.set(
          progress + (Math.random() - 0.5) * 0.5,
          waveY + (Math.random() - 0.5) * 0.5,
          waveZ + (Math.random() - 0.5) * 0.5
        );
        blkMesh.rotation.y = progress * 0.05;
        cloudWaveGroup.add(blkMesh);
      }
      scene.add(cloudWaveGroup);

      // --- 2. 11 CELESTIAL HALO STAR ORBS (VAN GOGH'S ICONIC STAR ORBS RIGHT BEHIND THE ISLAND) ---
      const STAR_ORBS = [
        { x: -9.8, y: 7.2, z: -8.0, r: 1.4 },
        { x: -7.5, y: 5.6, z: -7.6, r: 1.2 },
        { x: -5.5, y: 7.8, z: -8.5, r: 1.5 },
        { x: -3.5, y: 5.8, z: -7.8, r: 1.1 },
        { x: -1.0, y: 8.4, z: -8.5, r: 1.6 },
        { x: 1.5,  y: 6.2, z: -7.6, r: 1.2 },
        { x: 4.0,  y: 8.2, z: -8.2, r: 1.4 },
        { x: -8.5, y: 9.6, z: -9.0, r: 1.3 },
        { x: -3.0, y: 9.8, z: -9.2, r: 1.4 },
        { x: 2.2,  y: 9.6, z: -9.0, r: 1.3 },
        { x: -0.5, y: 4.8, z: -7.2, r: 1.0 },
      ];

      const orbYellowMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      const orbOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const orbHaloMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x93c5fd,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.85
      });

      STAR_ORBS.forEach((orb) => {
        const orbGroup = new THREE.Group();
        orbGroup.position.set(orb.x, orb.y, orb.z);

        // Core Glowing Star
        const coreGeo = new THREE.DodecahedronGeometry(0.35, 1);
        const coreMesh = new THREE.Mesh(coreGeo, orbOrangeMat);
        orbGroup.add(coreMesh);

        // Inner Ring
        const innerGeo = new THREE.DodecahedronGeometry(0.65, 1);
        const innerMesh = new THREE.Mesh(innerGeo, orbYellowMat);
        orbGroup.add(innerMesh);

        // Outer Swirling Halo Ring of Voxel Blocks
        const blockCount = 12;
        for (let b = 0; b < blockCount; b++) {
          const angle = (b / blockCount) * Math.PI * 2;
          const hBlock = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), orbHaloMat);
          hBlock.position.set(
            Math.cos(angle) * orb.r,
            Math.sin(angle) * orb.r * 0.7,
            (Math.random() - 0.5) * 0.25
          );
          hBlock.rotation.z = angle;
          orbGroup.add(hBlock);
        }

        const starLight = new THREE.PointLight(0xfacc15, 1.2, 12);
        orbGroup.add(starLight);

        scene.add(orbGroup);
      });

      // --- 3. LARGE GLOWING MOON HALO ORB (UPPER RIGHT BEHIND THE VILLAGE) ---
      const moonHaloGroup = new THREE.Group();
      moonHaloGroup.position.set(8.2, 7.8, -8.5);

      // Large Swirling Moon Halo Ring
      const moonHaloRadius = 2.4;
      for (let m = 0; m < 18; m++) {
        const angle = (m / 18) * Math.PI * 2;
        const mBlock = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), orbHaloMat);
        mBlock.position.set(
          Math.cos(angle) * moonHaloRadius,
          Math.sin(angle) * moonHaloRadius,
          (Math.random() - 0.5) * 0.3
        );
        mBlock.rotation.z = angle;
        moonHaloGroup.add(mBlock);
      }

      // Golden Crescent Moon
      const moonGeo = new THREE.SphereGeometry(1.6, 16, 16);
      const moonMesh = new THREE.Mesh(moonGeo, orbYellowMat);
      const cutterGeo = new THREE.SphereGeometry(1.45, 16, 16);
      const cutterMesh = new THREE.Mesh(cutterGeo, new THREE.MeshBasicMaterial({ color: 0x0a1128 }));
      cutterMesh.position.set(-0.55, 0.3, 0.55);
      moonHaloGroup.add(moonMesh, cutterMesh);

      const moonLight = new THREE.PointLight(0xfadb14, 2.8, 25);
      moonHaloGroup.add(moonLight);
      scene.add(moonHaloGroup);

      // --- 4. ROLLING BACKGROUND MOUNTAIN HORIZON RIDGES (FRAMING THE BACK EDGE) ---
      const mountainGroup = new THREE.Group();
      mountainGroup.position.set(0, 0, -11.5);
      const mtnMat1 = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 });
      const mtnMat2 = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.9 });

      for (let mx = -18; mx <= 18; mx += 1.8) {
        const height = 3.2 + Math.sin(mx * 0.35) * 1.6 + Math.cos(mx * 0.55) * 1.0;
        const mtnBlock = new THREE.Mesh(new THREE.BoxGeometry(2.0, height, 2.5), (Math.abs(Math.round(mx)) % 4 === 0) ? mtnMat1 : mtnMat2);
        mtnBlock.position.set(mx, height / 2 - 0.5, 0);
        mountainGroup.add(mtnBlock);
      }
      scene.add(mountainGroup);

      // Additional background stars
      const starGeo = new THREE.DodecahedronGeometry(0.2, 1);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      for (let s = 0; s < 30; s++) {
        const star = new THREE.Mesh(starGeo, starMat);
        const sx = (Math.random() - 0.5) * 28;
        const sy = 4.2 + Math.random() * 8.5;
        const sz = -7.5 - Math.random() * 4.0;
        star.position.set(sx, sy, sz);
        scene.add(star);
      }
    }

    // 5.5 Reusable Occasional Rain Weather System
    const isWaterTile = (c: number, r: number) => {
      const map = selectedMapRef.current === 'starry_night'
        ? STARRY_NIGHT_TILE_MAP
        : (selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      const tileChar = map[r][c];
      return tileChar === 'W' || tileChar === 'L' || tileChar === 'F';
    };

    const rainSystem = new RainSystem({
      scene,
      cols: COLS,
      rows: ROWS,
      tileSize: TILE_SIZE,
      getTileBaseY: (c, r) => getTileBaseY(selectedMapRef.current, c, r),
      isWaterTile,
      enabled: true,
      autoCycle: true,
      ambientLight,
      sunLight,
      onWeatherChange: (mode, intensity, label) => {
        setWeatherLabel(label);
      },
    });
    rainSystemRef.current = rainSystem;

    // 6. Water Splash & Ripple Particle System
    interface ActiveDroplet {
      mesh: THREE.Mesh;
      vel: THREE.Vector3;
      life: number;
      maxLife: number;
    }

    interface ActiveRipple {
      mesh: THREE.Mesh;
      life: number;
      maxLife: number;
    }

    const activeDroplets: ActiveDroplet[] = [];
    const activeRipples: ActiveRipple[] = [];

    const dropletGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const dropletMat = new THREE.MeshStandardMaterial({
      color: 0x7ed6df,
      emissive: 0x22a6b3,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      transparent: true,
    });

    const ringGeo = new THREE.RingGeometry(0.1, 0.4, 16);
    ringGeo.rotateX(-Math.PI / 2);

    const triggerSplash = (sx: number, sz: number) => {
      // Expanding Ripple Ring on Water Surface
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xdff9fb,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(sx, 0.15, sz);
      scene.add(ringMesh);
      activeRipples.push({ mesh: ringMesh, life: 0, maxLife: 0.55 });

      // Water Droplets Bursting Outwards
      const dropletCount = 20;
      for (let i = 0; i < dropletCount; i++) {
        const dMesh = new THREE.Mesh(dropletGeo, dropletMat);
        dMesh.position.set(sx, 0.2, sz);
        scene.add(dMesh);

        const angle = (i / dropletCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const speed = 1.5 + Math.random() * 2.5;
        const velY = 2.8 + Math.random() * 2.8;

        activeDroplets.push({
          mesh: dMesh,
          vel: new THREE.Vector3(Math.cos(angle) * speed, velY, Math.sin(angle) * speed),
          life: 0,
          maxLife: 0.4 + Math.random() * 0.25,
        });
      }
    };

    // 7. Dynamic Flying Bugs System with Golden Glow & Lighting
    interface FlyingBug {
      mesh: THREE.Group;
      wingLeft: THREE.Mesh;
      wingRight: THREE.Mesh;
      glowMesh: THREE.Mesh;
      bugLight: THREE.PointLight;
      originX: number;
      originZ: number;
      baseY: number;
      speed: number;
      radiusX: number;
      radiusZ: number;
      phase: number;
      active: boolean;
      respawnTime: number;
      pos: THREE.Vector3;
    }

    const create3DBugMesh = () => {
      const bugGroup = new THREE.Group();

      // Pure Luminous Golden Core Body (unlit MeshBasicMaterial for maximum golden radiance)
      const bodyMat = new THREE.MeshBasicMaterial({
        color: 0xffea00, // Golden yellow core
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.12), bodyMat);
      bugGroup.add(body);

      // Golden Glowing Aura Halo
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });
      const auraGeo = new THREE.SphereGeometry(0.18, 12, 12);
      const glowMesh = new THREE.Mesh(auraGeo, auraMat);
      bugGroup.add(glowMesh);

      // Warm Golden Point Light casting glow onto lily pads and water
      const bugLight = new THREE.PointLight(0xffdd22, 1.2, 2.5);
      bugGroup.add(bugLight);

      // Translucent Wings
      const wingMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const wingGeo = new THREE.BoxGeometry(0.1, 0.01, 0.05);

      const wingLeft = new THREE.Mesh(wingGeo, wingMat);
      wingLeft.position.set(-0.06, 0.05, 0);
      bugGroup.add(wingLeft);

      const wingRight = new THREE.Mesh(wingGeo, wingMat);
      wingRight.position.set(0.06, 0.05, 0);
      bugGroup.add(wingRight);

      return { bugGroup, wingLeft, wingRight, glowMesh, bugLight };
    };

    const bugCount = 25;
    const flyingBugs: FlyingBug[] = [];

    for (let i = 0; i < bugCount; i++) {
      const { bugGroup, wingLeft, wingRight, glowMesh, bugLight } = create3DBugMesh();
      const ox = (Math.random() - 0.5) * 15;
      const oz = (Math.random() - 0.5) * 11;
      const by = 0.9 + Math.random() * 2.3;

      bugGroup.position.set(ox, by, oz);
      scene.add(bugGroup);

      flyingBugs.push({
        mesh: bugGroup,
        wingLeft,
        wingRight,
        glowMesh,
        bugLight,
        originX: ox,
        originZ: oz,
        baseY: by,
        speed: 0.25 + Math.random() * 0.35, // Slower, peaceful floating motion
        radiusX: 1.2 + Math.random() * 2.0,
        radiusZ: 1.0 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        active: true,
        respawnTime: 0,
        pos: new THREE.Vector3(ox, by, oz),
      });
    }

    // Strict Mode Target Mesh
    const targetFireflyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 2.0 })
    );
    targetFireflyMesh.visible = false;
    scene.add(targetFireflyMesh);

    // 8. Voxel 3D Blocky Toad Mesh Generator Function
    const createVoxelToad = (speciesKey: string) => {
      const group = new THREE.Group();
      const spec = TOAD_SPECIES_DATA[speciesKey as ToadSpecies] || TOAD_SPECIES_DATA['common'];

      const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.6 });
      const bellyMat = new THREE.MeshStandardMaterial({ color: spec.accentColor, roughness: 0.7 });
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

      // Voxel Body Box
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.75), bodyMat);
      body.position.y = 0.35;
      body.castShadow = true;

      // Voxel Belly
      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.55), bellyMat);
      belly.position.set(0, 0.22, 0.05);

      // Voxel Eyes
      const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), eyeMat);
      leftEye.position.set(-0.24, 0.65, 0.25);
      const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), pupilMat);
      leftPupil.position.set(-0.24, 0.65, 0.34);

      const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), eyeMat);
      rightEye.position.set(0.24, 0.65, 0.25);
      const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), pupilMat);
      rightPupil.position.set(0.24, 0.65, 0.34);

      // Back Legs
      const legGeo = new THREE.BoxGeometry(0.18, 0.3, 0.35);
      const leftLeg = new THREE.Mesh(legGeo, bodyMat);
      leftLeg.position.set(-0.4, 0.2, -0.15);
      const rightLeg = new THREE.Mesh(legGeo, bodyMat);
      rightLeg.position.set(0.4, 0.2, -0.15);

      // Mouth Tongue Group
      const tongueGroup = new THREE.Group();
      tongueGroup.position.set(0, 0.42, 0.38); // Front mouth origin facing +Z
      tongueGroup.rotation.set(0, 0, 0);
      tongueGroup.name = 'tongueGroup';

      const tongueMat = new THREE.MeshStandardMaterial({
        color: 0xff3366,
        roughness: 0.3,
        emissive: 0xff1040,
        emissiveIntensity: 0.6,
      });

      const tongueStem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.0), tongueMat);
      tongueStem.position.set(0, 0, 0.5);
      tongueGroup.add(tongueStem);

      const tongueTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), tongueMat);
      tongueTip.position.set(0, 0, 1.0);
      tongueGroup.add(tongueTip);

      tongueGroup.scale.set(1, 1, 0.001);
      tongueGroup.visible = false;

      group.add(body, belly, leftEye, leftPupil, rightEye, rightPupil, leftLeg, rightLeg, tongueGroup);
      return group;
    };

    const frogMeshesMap = new Map<string, THREE.Group>();

    interface ToadTongueState {
      isShooting: boolean;
      progress: number;
      targetBugIndex: number | null;
      targetPos: THREE.Vector3;
      cooldown: number;
      hasEaten: boolean;
    }
    const tongueStatesMap = new Map<string, ToadTongueState>();

    // 8.5. 10-Second Settling Loading Ring on top of toad's head for Stillness Transition
    // 8.5a. Horizontal Halo Ring (Faces the toad)
    const settleCanvas = document.createElement('canvas');
    settleCanvas.width = 256;
    settleCanvas.height = 256;
    const settleCtx = settleCanvas.getContext('2d');
    const settleTexture = new THREE.CanvasTexture(settleCanvas);
    settleTexture.colorSpace = THREE.SRGBColorSpace;

    const settleRingGeo = new THREE.PlaneGeometry(1.25, 1.25);
    const settleRingMat = new THREE.MeshBasicMaterial({
      map: settleTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const settleRingMesh = new THREE.Mesh(settleRingGeo, settleRingMat);
    settleRingMesh.rotation.x = -Math.PI / 2; // Flat horizontal halo facing the toad
    settleRingMesh.visible = false;
    settleRingMesh.renderOrder = 30;
    scene.add(settleRingMesh);

    // 8.5b. Camera-Facing Billboard Number (Floats on the toad's head without background)
    const numberCanvas = document.createElement('canvas');
    numberCanvas.width = 128;
    numberCanvas.height = 128;
    const numberCtx = numberCanvas.getContext('2d');
    const numberTexture = new THREE.CanvasTexture(numberCanvas);
    numberTexture.colorSpace = THREE.SRGBColorSpace;

    const settleNumberGeo = new THREE.PlaneGeometry(0.85, 0.85);
    const settleNumberMat = new THREE.MeshBasicMaterial({
      map: numberTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const settleNumberMesh = new THREE.Mesh(settleNumberGeo, settleNumberMat);
    settleNumberMesh.visible = false;
    settleNumberMesh.renderOrder = 35;
    scene.add(settleNumberMesh);

    const settleRingLight = new THREE.PointLight(0x34d399, 0, 3.2);
    scene.add(settleRingLight);

    const drawSettleRing = (progress: number, pulseTime: number, isStarry: boolean) => {
      if (!settleCtx) return;
      settleCtx.clearRect(0, 0, 256, 256);

      const cx = 128;
      const cy = 128;
      const radius = 92;

      // 1. Background Base Track Ring
      settleCtx.save();
      settleCtx.beginPath();
      settleCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      settleCtx.strokeStyle = isStarry ? 'rgba(250, 204, 21, 0.28)' : 'rgba(52, 211, 153, 0.28)';
      settleCtx.lineWidth = 14;
      settleCtx.stroke();

      // Outer pulsating aura ring
      const pulse = 0.85 + Math.sin(pulseTime * 5) * 0.15;
      settleCtx.beginPath();
      settleCtx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
      settleCtx.strokeStyle = isStarry ? `rgba(250, 204, 21, ${0.25 * pulse})` : `rgba(52, 211, 153, ${0.25 * pulse})`;
      settleCtx.lineWidth = 3;
      settleCtx.stroke();
      settleCtx.restore();

      // 2. Active Animated Filling Progress Arc (12 o'clock clockwise)
      if (progress > 0) {
        settleCtx.save();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + progress * Math.PI * 2;

        settleCtx.beginPath();
        settleCtx.arc(cx, cy, radius, startAngle, endAngle);
        settleCtx.strokeStyle = isStarry ? '#facc15' : '#34d399';
        settleCtx.lineWidth = 16;
        settleCtx.lineCap = 'round';
        settleCtx.shadowColor = isStarry ? '#fde047' : '#10b981';
        settleCtx.shadowBlur = 16;
        settleCtx.stroke();

        // Glowing spark bead at the tip of the arc
        const tipX = cx + Math.cos(endAngle) * radius;
        const tipY = cy + Math.sin(endAngle) * radius;
        settleCtx.beginPath();
        settleCtx.arc(tipX, tipY, 8.5, 0, Math.PI * 2);
        settleCtx.fillStyle = '#ffffff';
        settleCtx.shadowBlur = 18;
        settleCtx.shadowColor = '#ffffff';
        settleCtx.fill();
        settleCtx.restore();
      }

      settleTexture.needsUpdate = true;
    };

    const drawSettleNumber = (remainingSec: number, isStarry: boolean) => {
      if (!numberCtx) return;
      numberCtx.clearRect(0, 0, 128, 128);

      // Countdown Number facing camera (Just the number, NO background box/color)
      numberCtx.save();
      numberCtx.textAlign = 'center';
      numberCtx.textBaseline = 'middle';
      numberCtx.font = '900 68px monospace';
      numberCtx.fillStyle = isStarry ? '#fef08a' : '#ffffff';
      numberCtx.shadowBlur = 16;
      numberCtx.shadowColor = isStarry ? '#eab308' : '#059669';
      numberCtx.fillText(`${remainingSec}`, 64, 64);
      numberCtx.restore();

      numberTexture.needsUpdate = true;
    };

    // --- 8.6. Super Powers 3D Infrastructure: Bombs, Explosions, Reticle & Practice Frog ---
    const bombsGroup = new THREE.Group();
    const explosionsGroup = new THREE.Group();
    const reticleGroup = new THREE.Group();
    scene.add(bombsGroup);
    scene.add(explosionsGroup);
    scene.add(reticleGroup);

    // Bomb Materials
    const bombMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.85,
      roughness: 0.25,
    });
    const bombGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.7,
      roughness: 0.35,
    });
    const fuseMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.9,
    });
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xfff000,
    });

    const create3DBombMesh = () => {
      const g = new THREE.Group();

      // Main Spherical Body
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), bombMat);
      sphere.position.y = 0.36;
      sphere.castShadow = true;
      g.add(sphere);

      // Gold Top Collar
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12), bombGoldMat);
      collar.position.y = 0.7;
      collar.castShadow = true;
      g.add(collar);

      // Fuse stem
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), fuseMat);
      fuse.position.set(0.04, 0.81, 0);
      fuse.rotation.z = -0.35;
      g.add(fuse);

      // Spark sphere
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), sparkMat);
      spark.position.set(0.09, 0.92, 0);
      g.add(spark);

      // Spark Light
      const sparkLight = new THREE.PointLight(0xff8800, 1.8, 2.5);
      sparkLight.position.set(0.09, 0.92, 0);
      g.add(sparkLight);

      // Red hazard pulsing ground ring
      const ringGeo = new THREE.RingGeometry(0.46, 0.58, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      g.add(ring);

      return { mesh: g, spark, sparkLight, ring };
    };

    // Explosion VFX System
    const triggerExplosionVFX = (ex: number, ey: number, ez: number) => {
      const expGroup = new THREE.Group();
      expGroup.position.set(ex, ey, ez);

      const flashLight = new THREE.PointLight(0xfff5ea, 14.0, 14.0);
      flashLight.position.set(0, 0.7, 0);
      expGroup.add(flashLight);

      const fireballGeo = new THREE.SphereGeometry(0.65, 16, 16);
      const fireballMat = new THREE.MeshStandardMaterial({
        color: 0xff3300,
        emissive: 0xff8800,
        emissiveIntensity: 3.5,
        transparent: true,
        opacity: 0.95,
        roughness: 0.2,
      });
      const fireball = new THREE.Mesh(fireballGeo, fireballMat);
      fireball.position.y = 0.5;
      expGroup.add(fireball);

      const shockwaveGeo = new THREE.RingGeometry(0.25, 0.65, 32);
      const shockwaveMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      });
      const shockwave = new THREE.Mesh(shockwaveGeo, shockwaveMat);
      shockwave.rotation.x = -Math.PI / 2;
      shockwave.position.y = 0.08;
      expGroup.add(shockwave);

      const debrisMat = new THREE.MeshStandardMaterial({
        color: 0x27272a,
        roughness: 0.85,
      });
      const fireEmberMat = new THREE.MeshStandardMaterial({
        color: 0xff5500,
        emissive: 0xff3300,
        emissiveIntensity: 2.5,
      });

      const particles: {
        mesh: THREE.Mesh;
        vel: THREE.Vector3;
        rotSpeed: THREE.Vector3;
        life: number;
        maxLife: number;
      }[] = [];

      for (let i = 0; i < 30; i++) {
        const isFire = Math.random() < 0.6;
        const geo = isFire ? new THREE.BoxGeometry(0.12, 0.12, 0.12) : new THREE.BoxGeometry(0.18, 0.18, 0.18);
        const pMesh = new THREE.Mesh(geo, isFire ? fireEmberMat : debrisMat);
        pMesh.position.set((Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
        expGroup.add(pMesh);

        const angle = Math.random() * Math.PI * 2;
        const horizSpeed = 2.5 + Math.random() * 4.5;
        const vertSpeed = 4.0 + Math.random() * 6.5;

        particles.push({
          mesh: pMesh,
          vel: new THREE.Vector3(Math.cos(angle) * horizSpeed, vertSpeed, Math.sin(angle) * horizSpeed),
          rotSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12
          ),
          life: 0,
          maxLife: 0.65 + Math.random() * 0.5,
        });
      }

      explosionsGroup.add(expGroup);
      explosionsRef.current.push({
        group: expGroup,
        flashLight,
        fireball,
        shockwave,
        particles,
        life: 0,
        maxLife: 0.95,
      });

      cameraShakeRef.current = 0.5;
    };

    // Targeting Reticle for Bomb Planting
    const reticleRingGeo = new THREE.RingGeometry(0.65, 0.82, 32);
    const reticleRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const reticleRing = new THREE.Mesh(reticleRingGeo, reticleRingMat);
    reticleRing.rotation.x = -Math.PI / 2;
    reticleGroup.add(reticleRing);

    const crosshairMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 1.4), crosshairMat);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.1), crosshairMat);
    reticleGroup.add(cross1, cross2);
    reticleGroup.visible = false;

    // 3 Practice Frog Companions (enabling full 4-frog stacks)
    const initPracticeFrogs = () => {
      practiceFrogsRef.current = [];
      tileStacksRef.current.clear();

      // Initialize local player tile stack
      const localCol = localGridPosRef.current.col;
      const localRow = localGridPosRef.current.row;
      tileStacksRef.current.set(getTileKey(localCol, localRow), [localPlayerIdRef.current]);

      const configs = [
        { id: 'practice_1', displayName: 'Toad Bro', species: 'bullfrog' as ToadSpecies, col: 8, row: 5 },
        { id: 'practice_2', displayName: 'Dart Pip', species: 'poison_dart' as ToadSpecies, col: 9, row: 4 },
        { id: 'practice_3', displayName: 'Golden Sage', species: 'golden' as ToadSpecies, col: 7, row: 4 },
      ];

      configs.forEach((cfg) => {
        const w = gridToWorld(cfg.col, cfg.row);
        const y = getTileBaseY(selectedMap, cfg.col, cfg.row);
        const frogMesh = createVoxelToad(cfg.species);
        frogMesh.position.set(w.x, y, w.z);
        scene.add(frogMesh);

        practiceFrogsRef.current.push({
          id: cfg.id,
          displayName: cfg.displayName,
          toadSpecies: cfg.species,
          col: cfg.col,
          row: cfg.row,
          mesh: frogMesh,
          worldPos: new THREE.Vector3(w.x, y, w.z),
          targetWorldPos: new THREE.Vector3(w.x, y, w.z),
          startY: y,
          isHopping: false,
          hopProgress: 0,
          facingAngle: Math.PI,
          isStill: true,
          hopCooldown: 2.0 + Math.random() * 4.0,
          stackLevel: 0,
        });

        // Add to tile stack
        const key = getTileKey(cfg.col, cfg.row);
        const existing = tileStacksRef.current.get(key) || [];
        tileStacksRef.current.set(key, [...existing, cfg.id]);
      });
    };
    initPracticeFrogs();

    // Scene Custom Event Listeners for Bombs
    const onPlantBombScene = (e: Event) => {
      const { id, col, row, mapName, planterId } = (e as CustomEvent).detail;
      const { mesh, spark, sparkLight, ring } = create3DBombMesh();
      const w = gridToWorld(col, row);
      const y = getTileBaseY(mapName, col, row);
      mesh.position.set(w.x, y, w.z);
      bombsGroup.add(mesh);

      const bombObj: ActiveBomb = {
        id,
        col,
        row,
        mapName,
        mesh,
        spark,
        sparkLight,
        ring,
        createdAt: Date.now(),
        planterId,
      };
      activeBombsRef.current.push(bombObj);
      setPlantedBombsCount(activeBombsRef.current.length);
    };

    const onDetonateBombScene = (e: Event) => {
      const { bombId } = (e as CustomEvent).detail;
      const bomb = activeBombsRef.current.find((b) => b.id === bombId);
      if (bomb) {
        bombsGroup.remove(bomb.mesh);
        triggerExplosionVFX(bomb.mesh.position.x, bomb.mesh.position.y, bomb.mesh.position.z);
        activeBombsRef.current = activeBombsRef.current.filter((b) => b.id !== bombId);
        setPlantedBombsCount(activeBombsRef.current.length);
      }
    };

    window.addEventListener('plant_bomb_scene', onPlantBombScene);
    window.addEventListener('detonate_bomb_scene', onDetonateBombScene);

    // Raycaster for Hover Targeting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
    const intersectPt = new THREE.Vector3();

    const handleCanvasPointerMove = (e: PointerEvent) => {
      if (!isPlantingBombRef.current) {
        reticleGroup.visible = false;
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      if (raycaster.ray.intersectPlane(groundPlane, intersectPt)) {
        const c = Math.round(intersectPt.x / TILE_SIZE + COLS / 2 - 0.5);
        const r = Math.round(intersectPt.z / TILE_SIZE + ROWS / 2 - 0.5);
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
          hoveredTileRef.current = { col: c, row: r };
          const w = gridToWorld(c, r);
          const y = getTileBaseY(selectedMapRef.current, c, r);
          reticleGroup.position.set(w.x, y + 0.05, w.z);
          reticleGroup.visible = true;
        } else {
          hoveredTileRef.current = null;
          reticleGroup.visible = false;
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', handleCanvasPointerMove);

    // 9. Main Render Loop
    let animFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Sync Dev Switch Tile Numbers visibility
      tileNumbersGroup.visible = showTileNumbersRef.current;

      // A. Moving Water Effect (Smooth, cohesive undulating liquid wave)
      waterMeshes.forEach((wm) => {
        wm.mesh.position.y = wm.initY + Math.sin(elapsedTime * 1.5 + wm.gridX * 0.4 + wm.gridZ * 0.4) * 0.015;
      });

      // B. Drifting Clouds
      cloudsGroup.children.forEach((cloud, idx) => {
        cloud.position.x += Math.sin(elapsedTime * 0.2 + idx) * 0.01;
      });

      // B1. Occasional Rain Weather Update
      rainSystem.update(delta, elapsedTime);
      audioService.updateRainSound(rainSystem.getIntensity(), !quietMode);

      // B2. Bonfire Flame Flickering & Ember Particle Motion
      bonfireAnims.forEach((b) => {
        b.fireLight.intensity = 2.4 + Math.sin(elapsedTime * 14) * 0.4 + Math.cos(elapsedTime * 23) * 0.3;

        const flamePulse = 1.0 + Math.sin(elapsedTime * 10) * 0.12 + Math.cos(elapsedTime * 17) * 0.08;
        b.flameOuter.scale.set(flamePulse, flamePulse * (0.95 + Math.sin(elapsedTime * 8) * 0.1), flamePulse);
        b.flameOuter.rotation.y = elapsedTime * 2.0;

        b.flameMid.scale.set(flamePulse * 0.9, flamePulse * (1.0 + Math.cos(elapsedTime * 11) * 0.15), flamePulse * 0.9);
        b.flameMid.rotation.y = -elapsedTime * 3.0;

        b.flameInner.scale.set(1.0, 1.0 + Math.sin(elapsedTime * 15) * 0.2, 1.0);

        b.embersList.forEach((emb) => {
          emb.mesh.position.y += delta * emb.speed;
          emb.mesh.position.x += Math.sin(elapsedTime * 4 + emb.phase) * 0.003;
          emb.mesh.position.z += Math.cos(elapsedTime * 4 + emb.phase) * 0.003;

          if (emb.mesh.position.y > b.baseY + 1.4) {
            emb.mesh.position.y = b.baseY + 0.4;
            emb.mesh.position.x = b.centerX + (Math.random() - 0.5) * 0.25;
            emb.mesh.position.z = b.centerZ + (Math.random() - 0.5) * 0.25;
          }
        });
      });

      // C. Keyboard Grid Movement Logic for Local Player
      const keys = keysPressedRef.current;
      const moveUp = keys['w'] || keys['arrowup'];
      const moveDown = keys['s'] || keys['arrowdown'];
      const moveLeft = keys['a'] || keys['arrowleft'];
      const moveRight = keys['d'] || keys['arrowright'];

      if (!isHoppingRef.current && (moveUp || moveDown || moveLeft || moveRight)) {
        let dCol = 0;
        let dRow = 0;

        if (moveUp) { dRow = -1; facingAngleRef.current = Math.PI; }
        else if (moveDown) { dRow = 1; facingAngleRef.current = 0; }
        else if (moveLeft) { dCol = -1; facingAngleRef.current = -Math.PI / 2; }
        else if (moveRight) { dCol = 1; facingAngleRef.current = Math.PI / 2; }

        const nextCol = localGridPosRef.current.col + dCol;
        const nextRow = localGridPosRef.current.row + dRow;

        const currentMap = selectedMapRef.current === 'starry_night'
          ? STARRY_NIGHT_TILE_MAP
          : (selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);
        const nextTile = currentMap[nextRow]?.[nextCol];

        // Check if next tile is valid land/water (not empty void '.' and not solid Tree 'T')
        if (
          nextRow >= 0 && nextRow < ROWS &&
          nextCol >= 0 && nextCol < COLS &&
          nextTile !== '.' &&
          nextTile !== 'T'
        ) {
          // If was settling, cancel settling & hide loading ring & number immediately on movement
          isSettlingRef.current = false;
          settleTimerRef.current = 0;
          settleRingMesh.visible = false;
          settleNumberMesh.visible = false;
          settleRingLight.intensity = 0;

          // Launch Splash at current tile before leaving ONLY if current tile is water/lily pad/waterfall spring
          const curTile = currentMap[localGridPosRef.current.row][localGridPosRef.current.col];
          if (curTile === 'W' || curTile === 'L' || curTile === 'F') {
            triggerSplash(localWorldPosRef.current.x, localWorldPosRef.current.z);
          }

          startWorldYRef.current = localWorldPosRef.current.y;
          const curCol = localGridPosRef.current.col;
          const curRow = localGridPosRef.current.row;
          const curKey = getTileKey(curCol, curRow);
          const curStack = tileStacksRef.current.get(curKey) || [localPlayerIdRef.current];
          const myIdx = curStack.indexOf(localPlayerIdRef.current);

          // Everything on or above this frog travels together
          const movingStack = myIdx >= 0 ? curStack.slice(myIdx) : [localPlayerIdRef.current];
          const remainingSource = myIdx >= 0 ? curStack.slice(0, myIdx) : curStack;
          tileStacksRef.current.set(curKey, remainingSource);

          // Destination tile stack calculation
          const destKey = getTileKey(nextCol, nextRow);
          const destExisting = tileStacksRef.current.get(destKey) || [];
          const destBaseLevel = destExisting.length;
          tileStacksRef.current.set(destKey, [...destExisting, ...movingStack]);

          localGridPosRef.current = { col: nextCol, row: nextRow };
          const nextW = gridToWorld(nextCol, nextRow);
          const targetBaseY = getTileBaseY(selectedMapRef.current, nextCol, nextRow);
          const localTargetY = targetBaseY + destBaseLevel * FROG_STACK_HEIGHT;
          targetWorldPosRef.current = { x: nextW.x, y: localTargetY, z: nextW.z };
          isHoppingRef.current = true;
          hopProgressRef.current = 0;

          // Carry all frogs stacked above local player
          const carriedCompanionIds: string[] = [];
          movingStack.slice(1).forEach((carriedId, idx) => {
            const pf = practiceFrogsRef.current.find((f) => f.id === carriedId);
            if (pf) {
              carriedCompanionIds.push(carriedId);
              const stackLvl = destBaseLevel + 1 + idx;
              pf.col = nextCol;
              pf.row = nextRow;
              pf.stackLevel = stackLvl;
              pf.startY = pf.worldPos.y;
              pf.targetWorldPos.set(nextW.x, targetBaseY + stackLvl * FROG_STACK_HEIGHT, nextW.z);
              pf.isHopping = true;
              pf.hopProgress = 0;
              pf.facingAngle = facingAngleRef.current;
            }
          });

          socketService.sendHop(
            curCol,
            curRow,
            nextCol,
            nextRow,
            facingAngleRef.current,
            carriedCompanionIds
          );

          if (destBaseLevel + movingStack.length >= 2) {
            showSuperpowerToast(`Stacked ${destBaseLevel + movingStack.length} frogs high!`, '🐸');
          }

          onStillnessChangeRef.current(false, { x: nextW.x, y: nextW.z });
          audioService.playCroak(1.2);
        }
      }

      // Parabolic Arc Hopping Animation
      if (isHoppingRef.current) {
        hopProgressRef.current += delta * 7.5; // Jump speed

        if (hopProgressRef.current >= 1.0) {
          hopProgressRef.current = 1.0;
          isHoppingRef.current = false;
          localWorldPosRef.current.x = targetWorldPosRef.current.x;
          localWorldPosRef.current.z = targetWorldPosRef.current.z;
          localWorldPosRef.current.y = targetWorldPosRef.current.y;

          // Landing Splash Effect ONLY if landing on water or lily pad
          const currentMap = selectedMapRef.current === 'starry_night'
            ? STARRY_NIGHT_TILE_MAP
            : (selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);
          const landTile = currentMap[localGridPosRef.current.row][localGridPosRef.current.col];
          if (landTile === 'W' || landTile === 'L' || landTile === 'F') {
            triggerSplash(localWorldPosRef.current.x, localWorldPosRef.current.z);
            audioService.playSplash();
          } else {
            audioService.playCroak(1.1);
          }

          // Toad sits down: Start settling transition (with 1s delay before ring appears)
          isSettlingRef.current = true;
          settleTimerRef.current = 0;
          settleRingMesh.visible = false;
          settleNumberMesh.visible = false;
          settleRingLight.intensity = 0;
        } else {
          // Linear interpolation for X, Z
          const p = hopProgressRef.current;
          localWorldPosRef.current.x = THREE.MathUtils.lerp(localWorldPosRef.current.x, targetWorldPosRef.current.x, p);
          localWorldPosRef.current.z = THREE.MathUtils.lerp(localWorldPosRef.current.z, targetWorldPosRef.current.z, p);
          
          // Interpolate base Y height and add parabolic hop arc
          const currentBaseY = THREE.MathUtils.lerp(startWorldYRef.current, targetWorldPosRef.current.y, p);
          localWorldPosRef.current.y = currentBaseY + Math.sin(p * Math.PI) * 1.1;
        }
      }

      // Update Settling countdown for Stillness (After 1s sitting tight, ring appears and counts down 10s)
      if (isSettlingRef.current && !isHoppingRef.current) {
        settleTimerRef.current += delta;

        if (settleTimerRef.current < SETTLE_DELAY) {
          // During the 1st second while the frog is sitting tight, keep ring hidden
          settleRingMesh.visible = false;
          settleNumberMesh.visible = false;
          settleRingLight.intensity = 0;
        } else {
          // After 1 second of sitting tight: ring & number appear and count down 10s
          const activeSettlingTime = settleTimerRef.current - SETTLE_DELAY;
          const progress = Math.min(1.0, activeSettlingTime / SETTLE_DURATION);
          const remainingSec = Math.max(0, Math.ceil(SETTLE_DURATION - activeSettlingTime));
          const isStarry = selectedMapRef.current === 'starry_night';

          // Floating hover pulse
          const floatHover = Math.sin(elapsedTime * 4) * 0.03;

          // 1. Halo Ring (Horizontal, facing down towards the toad)
          settleRingMesh.visible = true;
          settleRingMesh.rotation.set(-Math.PI / 2, 0, 0);
          settleRingMesh.position.set(
            localWorldPosRef.current.x,
            localWorldPosRef.current.y + 0.85 + floatHover,
            localWorldPosRef.current.z
          );

          // 2. Number (Always billboarded to face camera)
          settleNumberMesh.visible = true;
          settleNumberMesh.quaternion.copy(camera.quaternion);
          settleNumberMesh.position.set(
            localWorldPosRef.current.x,
            localWorldPosRef.current.y + 0.88 + floatHover,
            localWorldPosRef.current.z
          );

          settleRingLight.position.set(
            localWorldPosRef.current.x,
            localWorldPosRef.current.y + 0.95,
            localWorldPosRef.current.z
          );
          settleRingLight.color.setHex(isStarry ? 0xfacc15 : 0x34d399);
          settleRingLight.intensity = 1.4 + Math.sin(elapsedTime * 6) * 0.4;

          drawSettleRing(progress, elapsedTime, isStarry);
          drawSettleNumber(remainingSec, isStarry);

          if (progress >= 1.0) {
            isSettlingRef.current = false;
            settleTimerRef.current = 0;
            settleRingMesh.visible = false;
            settleNumberMesh.visible = false;
            settleRingLight.intensity = 0;

            // 10 seconds finished: Ring disappears, audio feedback, and state moves to STILL
            audioService.playChime();
            triggerSplash(localWorldPosRef.current.x, localWorldPosRef.current.z);
            onStillnessChangeRef.current(true, {
              x: localWorldPosRef.current.x,
              y: localWorldPosRef.current.z,
            });
          }
        }
      }

      // D. Update Active Splash Droplet Particles
      for (let i = activeDroplets.length - 1; i >= 0; i--) {
        const drop = activeDroplets[i];
        drop.life += delta;
        if (drop.life >= drop.maxLife) {
          scene.remove(drop.mesh);
          drop.mesh.geometry.dispose();
          activeDroplets.splice(i, 1);
        } else {
          drop.vel.y -= 14.0 * delta; // Gravity physics
          drop.mesh.position.addScaledVector(drop.vel, delta);
          const progress = drop.life / drop.maxLife;
          drop.mesh.scale.setScalar(Math.max(0.01, (1 - progress) * 1.2));
        }
      }

      // E. Update Active Expanding Ripple Rings
      for (let i = activeRipples.length - 1; i >= 0; i--) {
        const rip = activeRipples[i];
        rip.life += delta;
        if (rip.life >= rip.maxLife) {
          scene.remove(rip.mesh);
          rip.mesh.geometry.dispose();
          activeRipples.splice(i, 1);
        } else {
          const progress = rip.life / rip.maxLife;
          const scale = 1.0 + progress * 3.8;
          rip.mesh.scale.set(scale, 1, scale);
          (rip.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - progress);
        }
      }

      // F. Dynamic Flying Bugs Motion & Respawn Loop
      flyingBugs.forEach((bug) => {
        if (!bug.active) {
          bug.mesh.visible = false;
          if (elapsedTime >= bug.respawnTime) {
            bug.active = true;
            bug.mesh.visible = true;
            bug.originX = (Math.random() - 0.5) * 15;
            bug.originZ = (Math.random() - 0.5) * 11;
            bug.baseY = 0.9 + Math.random() * 2.3;
            bug.phase = Math.random() * Math.PI * 2;
          }
          return;
        }

        bug.mesh.visible = true;
        bug.phase += delta * bug.speed;

        const nextX = bug.originX + Math.sin(bug.phase) * bug.radiusX + Math.cos(bug.phase * 0.7) * 0.8;
        const nextZ = bug.originZ + Math.cos(bug.phase * 0.85) * bug.radiusZ + Math.sin(bug.phase * 0.5) * 0.8;
        const nextY = bug.baseY + Math.sin(bug.phase * 2.2) * 0.35;

        const dx = nextX - bug.pos.x;
        const dz = nextZ - bug.pos.z;
        if (Math.hypot(dx, dz) > 0.001) {
          bug.mesh.rotation.y = Math.atan2(dx, dz);
        }

        bug.pos.set(nextX, nextY, nextZ);
        bug.mesh.position.copy(bug.pos);

        // Soft, gentle wing fluttering & pulsating golden firefly radiance
        const wingAngle = Math.sin(elapsedTime * 16 + bug.phase) * 0.45;
        bug.wingLeft.rotation.z = wingAngle;
        bug.wingRight.rotation.z = -wingAngle;

        const pulse = Math.sin(elapsedTime * 3.5 + bug.phase * 2.0);
        bug.glowMesh.scale.setScalar(1.0 + pulse * 0.22);
        bug.bugLight.intensity = 1.0 + pulse * 0.4;
      });

      // G. Update / Sync Frog Meshes & Tongue Bug Hunting in 3D Scene
      const occupants = occupantsRef.current;
      const currentLocalId = localPlayerIdRef.current;
      const currentScreenCoords: { [playerId: string]: { x: number; y: number } } = {};

      // Build active list of occupants (fallback to single local player if room list is empty)
      const activeOccupants = occupants.length > 0 ? occupants : [{
        playerId: currentLocalId,
        displayName: 'My Toad',
        toadSpecies: 'common' as ToadSpecies,
        moltStage: 'adult' as const,
        isStill: true,
        padIndex: 0,
        position: { x: 0, y: 0 },
        focusMinutes: 0,
        xp: 0,
        streakDays: 1,
      }];

      const activePlayerIds = new Set(activeOccupants.map((p) => p.playerId));

      // Remove stale frog meshes for players who disconnected or left
      frogMeshesMap.forEach((frogGroup, pId) => {
        if (!activePlayerIds.has(pId)) {
          scene.remove(frogGroup);
          frogMeshesMap.delete(pId);
        }
      });

      activeOccupants.forEach((player) => {
        let frogGroup = frogMeshesMap.get(player.playerId);
        if (!frogGroup) {
          frogGroup = createVoxelToad(player.toadSpecies);
          scene.add(frogGroup);
          frogMeshesMap.set(player.playerId, frogGroup);
        }

        const isLocal = player.playerId === currentLocalId;
        const padList = selectedMapRef.current === 'waterfall' ? WATERFALL_LILY_PAD_POSITIONS : ISLAND_LILY_PAD_POSITIONS;
        const padGrid = padList[player.padIndex] || padList[0];
        const padW = gridToWorld(padGrid.col, padGrid.row);

        let tx = padW.x;
        let ty = getTileBaseY(selectedMapRef.current, padGrid.col, padGrid.row);
        let tz = padW.z;
        let rotY = 0;

        if (isLocal) {
          tx = localWorldPosRef.current.x;
          ty = localWorldPosRef.current.y;
          tz = localWorldPosRef.current.z;
          rotY = facingAngleRef.current;
        }

        frogGroup.position.set(tx, ty, tz);
        frogGroup.rotation.y = rotY;

        // Idle breathing effect
        const isLocalStill = isLocal ? (!isHoppingRef.current && !isSettlingRef.current && player.isStill) : player.isStill;
        const breath = isLocalStill ? 1.0 + Math.sin(elapsedTime * 4) * 0.04 : 1.0;
        frogGroup.scale.set(breath, breath, breath);

        // --- Tongue Bug Hunting Logic ---
        const isToadStill = isLocal ? (!isHoppingRef.current && !isSettlingRef.current && player.isStill) : player.isStill;
        let tState = tongueStatesMap.get(player.playerId);
        if (!tState) {
          tState = {
            isShooting: false,
            progress: 0,
            targetBugIndex: null,
            targetPos: new THREE.Vector3(),
            cooldown: 1.0 + Math.random() * 2.0,
            hasEaten: false,
          };
          tongueStatesMap.set(player.playerId, tState);
        }

        if (isToadStill && !tState.isShooting) {
          tState.cooldown -= delta;
          if (tState.cooldown <= 0) {
            // Find closest active flying bug within 5.0 units
            let closestDist = 5.0;
            let closestBugIdx = -1;

            flyingBugs.forEach((b, bIdx) => {
              if (!b.active) return;
              const d = frogGroup.position.distanceTo(b.pos);
              if (d < closestDist) {
                closestDist = d;
                closestBugIdx = bIdx;
              }
            });

            if (closestBugIdx !== -1) {
              tState.isShooting = true;
              tState.progress = 0;
              tState.targetBugIndex = closestBugIdx;
              tState.targetPos.copy(flyingBugs[closestBugIdx].pos);
              tState.cooldown = 2.5 + Math.random() * 2.5;
              tState.hasEaten = false;
            }
          }
        }

        // Animate Tongue Shot
        const tongueGroup = frogGroup.getObjectByName('tongueGroup') as THREE.Group | undefined;
        if (tongueGroup && (!isLocal || !tonguePushActionRef.current.active)) {
          if (tState.isShooting) {
            tState.progress += delta * 4.8;
            const p = Math.min(1.0, tState.progress);

            tongueGroup.visible = true;
            // Orient +Z towards target in local space
            const localTarget = frogGroup.worldToLocal(tState.targetPos.clone());
            const dx = localTarget.x;
            const dy = localTarget.y - 0.42;
            const dz = localTarget.z - 0.38;
            const horizDist = Math.hypot(dx, dz);
            tongueGroup.rotation.y = Math.atan2(dx, dz);
            tongueGroup.rotation.x = -Math.atan2(dy, Math.max(0.001, horizDist));
            tongueGroup.rotation.z = 0;

            const mouthWorldPos = new THREE.Vector3();
            tongueGroup.getWorldPosition(mouthWorldPos);
            const distToBug = mouthWorldPos.distanceTo(tState.targetPos);

            const currentLen = Math.sin(p * Math.PI) * distToBug;
            tongueGroup.scale.set(1, 1, Math.max(0.001, currentLen));

            // Eat bug at peak extension
            if (p >= 0.45 && p <= 0.55 && !tState.hasEaten && tState.targetBugIndex !== null) {
              const bug = flyingBugs[tState.targetBugIndex];
              if (bug && bug.active) {
                bug.active = false;
                bug.respawnTime = elapsedTime + 2.0 + Math.random() * 3.0; // Schedule respawn!
                tState.hasEaten = true;

                audioService.playBubblePop();

                if (isLocal && onFireflyCatchRef.current) {
                  onFireflyCatchRef.current();
                }
              }
            }

            if (p >= 1.0) {
              tState.isShooting = false;
              tongueGroup.visible = false;
              tongueGroup.rotation.set(0, 0, 0);
              tongueGroup.scale.set(1, 1, 0.001);
            }
          } else {
            tongueGroup.visible = false;
            tongueGroup.rotation.set(0, 0, 0);
            tongueGroup.scale.set(1, 1, 0.001);
          }
        }

        // Project 3D Screen Space Overlay Coords for Chat Bubbles
        const tempV = new THREE.Vector3();
        frogGroup.getWorldPosition(tempV);
        tempV.y += 1.2;
        tempV.project(camera);

        const screenX = ((tempV.x + 1) * width) / 2;
        const screenY = ((-tempV.y + 1) * height) / 2;
        currentScreenCoords[player.playerId] = { x: screenX, y: screenY };
      });

      setBubbleScreenPositions(currentScreenCoords);

      // Clean disconnected frogs
      frogMeshesMap.forEach((mesh, pId) => {
        if (!occupants.some((p) => p.playerId === pId)) {
          scene.remove(mesh);
          frogMeshesMap.delete(pId);
        }
      });

      // Swarm Bonus Bug Scale Effect
      flyingBugs.forEach((bug) => {
        bug.mesh.scale.setScalar(swarmActiveRef.current ? 1.35 : 1.0);
      });

      // Strict Mode Firefly Target
      if (strictModeRef.current && fireflyPosRef.current.active) {
        targetFireflyMesh.visible = true;
        targetFireflyMesh.position.set(
          fireflyPosRef.current.x,
          fireflyPosRef.current.y + Math.sin(elapsedTime * 3) * 0.3,
          fireflyPosRef.current.z
        );
      } else {
        targetFireflyMesh.visible = false;
      }

      // --- H. Super Powers: Update Active Bombs, Sparks & Stepping Detonation ---
      activeBombsRef.current.forEach((bomb) => {
        if (bomb.mapName === selectedMapRef.current) {
          bomb.mesh.visible = true;
          const sparkPulse = Math.sin(elapsedTime * 20) * 0.5 + 0.5;
          bomb.spark.scale.setScalar(0.8 + sparkPulse * 0.6);
          bomb.sparkLight.intensity = 1.2 + sparkPulse * 1.5;
          (bomb.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(elapsedTime * 6) * 0.35;
          bomb.ring.rotation.z += delta * 1.2;

          // Check if local player has stepped / hopped on this bomb
          const localGrid = localGridPosRef.current;
          if (localGrid.col === bomb.col && localGrid.row === bomb.row) {
            detonateBombObj(bomb);
          }
        } else {
          bomb.mesh.visible = false;
        }
      });

      // --- I. Super Powers: Update Active Explosions & Particles ---
      for (let i = explosionsRef.current.length - 1; i >= 0; i--) {
        const exp = explosionsRef.current[i];
        exp.life += delta;
        const progress = exp.life / exp.maxLife;

        if (progress >= 1.0) {
          explosionsGroup.remove(exp.group);
          explosionsRef.current.splice(i, 1);
        } else {
          const fbScale = Math.min(3.4, 0.8 + progress * 4.8);
          exp.fireball.scale.set(fbScale, fbScale * 1.1, fbScale);
          (exp.fireball.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.95 * (1 - progress * 1.2));

          const swScale = 1.0 + progress * 6.5;
          exp.shockwave.scale.set(swScale, swScale, swScale);
          (exp.shockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.92 * (1 - progress));

          exp.flashLight.intensity = Math.max(0, 14.0 * (1 - progress * 2.5));

          exp.particles.forEach((p) => {
            p.life += delta;
            p.vel.y -= 16.0 * delta;
            p.mesh.position.addScaledVector(p.vel, delta);
            p.mesh.rotation.x += p.rotSpeed.x * delta;
            p.mesh.rotation.y += p.rotSpeed.y * delta;
            p.mesh.rotation.z += p.rotSpeed.z * delta;
            const pLifeRatio = p.life / p.maxLife;
            p.mesh.scale.setScalar(Math.max(0.01, (1 - pLifeRatio) * 1.2));
          });
        }
      }

      // --- J. Super Powers: Update Camera Screen Shake ---
      if (cameraShakeRef.current > 0.001) {
        camera.position.x += (Math.random() - 0.5) * cameraShakeRef.current;
        camera.position.y += (Math.random() - 0.5) * cameraShakeRef.current * 0.7;
        camera.position.z += (Math.random() - 0.5) * cameraShakeRef.current;
        cameraShakeRef.current = Math.max(0, cameraShakeRef.current - delta * 1.8);
      }

      // --- K. Super Powers: Update Local Toad Tongue Push Animation ---
      const tongueAction = tonguePushActionRef.current;
      if (tongueAction.active) {
        tongueAction.progress += delta / tongueAction.duration;
        const localFrogGroup = frogMeshesMap.get(currentLocalId);
        if (localFrogGroup) {
          const tGroup = localFrogGroup.getObjectByName('tongueGroup') as THREE.Group | undefined;
          if (tGroup) {
            tGroup.visible = true;
            tGroup.position.set(0, 0.42, 0.38);
            tGroup.rotation.set(0, 0, 0); // Always straight in front of the frog's mouth (+Z)
            const strikeProgress = Math.sin(Math.min(1.0, tongueAction.progress) * Math.PI);
            const reach = tongueAction.maxReach || 6.0;
            tGroup.scale.set(1.5, 1.5, Math.max(0.001, strikeProgress * reach));
          }
        }

        if (tongueAction.progress >= 1.0) {
          tongueAction.active = false;
          const localFrogGroup = frogMeshesMap.get(currentLocalId);
          if (localFrogGroup) {
            const tGroup = localFrogGroup.getObjectByName('tongueGroup') as THREE.Group | undefined;
            if (tGroup) {
              tGroup.visible = false;
              tGroup.rotation.set(0, 0, 0);
              tGroup.scale.set(1, 1, 0.001);
            }
          }
        }
      }

      // --- L. Super Powers: Update Practice Companion Frogs (Stack-aware Animation) ---
      if (!practiceToadActiveRef.current) {
        practiceFrogsRef.current.forEach((pf) => {
          pf.mesh.visible = false;
        });
      } else {
        practiceFrogsRef.current.forEach((pf) => {
          pf.mesh.visible = true;
          if (pf.isHopping) {
            pf.hopProgress += delta * 7.5;
            const hp = Math.min(1.0, pf.hopProgress);
            pf.worldPos.x = THREE.MathUtils.lerp(pf.worldPos.x, pf.targetWorldPos.x, 0.35);
            pf.worldPos.z = THREE.MathUtils.lerp(pf.worldPos.z, pf.targetWorldPos.z, 0.35);
            const hopArc = Math.sin(hp * Math.PI) * 0.95;
            pf.worldPos.y = THREE.MathUtils.lerp(pf.startY, pf.targetWorldPos.y, hp) + hopArc;
            pf.mesh.position.copy(pf.worldPos);
            pf.mesh.rotation.y = pf.facingAngle;

            if (hp >= 1.0) {
              pf.isHopping = false;
              pf.worldPos.copy(pf.targetWorldPos);
              pf.mesh.position.copy(pf.worldPos);

              const map = selectedMapRef.current === 'starry_night'
                ? STARRY_NIGHT_TILE_MAP
                : (selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);
              const tile = map[pf.row]?.[pf.col];
              if ((tile === 'W' || tile === 'L' || tile === 'F') && pf.stackLevel === 0) {
                triggerSplash(pf.worldPos.x, pf.worldPos.z);
              }
            }
          } else {
            // Idle breathing & stack wobble
            const breath = 1.0 + Math.sin(elapsedTime * 3.8 + (pf.stackLevel || 0)) * 0.035;
            pf.mesh.scale.set(breath, breath, breath);
            pf.mesh.rotation.y = pf.facingAngle;

            if (pf.stackLevel > 0) {
              pf.mesh.rotation.z = Math.sin(elapsedTime * 3.5 + pf.stackLevel * 1.2) * (0.035 * pf.stackLevel);
              pf.mesh.rotation.x = Math.cos(elapsedTime * 2.8 + pf.stackLevel * 1.2) * (0.025 * pf.stackLevel);
            } else {
              pf.mesh.rotation.z = 0;
              pf.mesh.rotation.x = 0;
            }
          }
        });
      }

      // --- Dynamic Orbit Camera Position & Smooth Interpolation ---
      currentRotationRef.current = THREE.MathUtils.lerp(currentRotationRef.current, targetRotationRef.current, 0.12);
      currentZoomScaleRef.current = THREE.MathUtils.lerp(currentZoomScaleRef.current, targetZoomScaleRef.current, 0.12);

      const LOOK_AT = new THREE.Vector3(0, -0.5, 0);
      const BASE_XZ_RADIUS = 27.203; // Math.hypot(16, 22)
      const BASE_Y_DIST = 18.5;     // 18 - (-0.5)
      const BASE_AZIMUTH = 0.6283;   // Math.atan2(16, 22)

      const currentScale = currentZoomScaleRef.current;
      const currentAzimuth = BASE_AZIMUTH + currentRotationRef.current;
      const currentRXZ = BASE_XZ_RADIUS * currentScale;

      camera.position.x = LOOK_AT.x + Math.sin(currentAzimuth) * currentRXZ;
      camera.position.z = LOOK_AT.z + Math.cos(currentAzimuth) * currentRXZ;
      camera.position.y = LOOK_AT.y + BASE_Y_DIST * currentScale;
      camera.lookAt(LOOK_AT);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('plant_bomb_scene', onPlantBombScene);
      window.removeEventListener('detonate_bomb_scene', onDetonateBombScene);
      renderer.domElement.removeEventListener('pointermove', handleCanvasPointerMove);
      cancelAnimationFrame(animFrameId);

      scene.traverse((object) => {
        if ((object as THREE.Mesh).geometry) {
          (object as THREE.Mesh).geometry.dispose();
        }
        if ((object as THREE.Mesh).material) {
          const mat = (object as THREE.Mesh).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              if ('map' in m && m.map) (m.map as THREE.Texture).dispose();
              m.dispose();
            });
          } else {
            if ('map' in mat && mat.map) (mat.map as THREE.Texture).dispose();
            mat.dispose();
          }
        }
      });

      renderer.dispose();
      dropletGeo.dispose();
      dropletMat.dispose();
      ringGeo.dispose();
      settleRingGeo.dispose();
      settleRingMat.dispose();
      settleTexture.dispose();
      settleNumberGeo.dispose();
      settleNumberMat.dispose();
      numberTexture.dispose();
      rainSystem.dispose();
      rainSystemRef.current = null;
      audioService.updateRainSound(0, false);
    };
  }, [selectedMap, getLocalDefaultGridPos, gridToWorld, getTileBaseY, detonateBombObj]);

  // Pointer drag & wheel camera handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    startRotationRef.current = targetRotationRef.current;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - pointerStartPosRef.current.x;
    targetRotationRef.current = startRotationRef.current + dx * 0.008;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const dx = e.clientX - pointerStartPosRef.current.x;
    const dy = e.clientY - pointerStartPosRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 6) {
      // Superpower: If in Bomb Planting mode and clicked a tile
      if (isPlantingBombRef.current && hoveredTileRef.current) {
        plantBombAt(hoveredTileRef.current.col, hoveredTileRef.current.row);
        return;
      }

      if (showTileNumbersRef.current) {
        const clickX = localWorldPosRef.current.x;
        const clickZ = localWorldPosRef.current.z;
        const c = Math.round(clickX / TILE_SIZE + COLS / 2 - 0.5);
        const r = Math.round(clickZ / TILE_SIZE + ROWS / 2 - 0.5);
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          const map = selectedMapRef.current === 'starry_night'
            ? STARRY_NIGHT_TILE_MAP
            : (selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP);
          setSelectedTileInfo({ col: c, row: r, tileChar: map[r][c], mapName: selectedMapRef.current });
        }
      }

      if (strictMode && fireflyPosRef.current.active && onFireflyCatch) {
        fireflyPosRef.current.active = false;
        audioService.playChime();
        onFireflyCatch();
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const isDev = showTileNumbersRef.current || devMode;
    const minScale = isDev ? 0.01 : 0.75;
    const maxScale = isDev ? 15.0 : 1.0;

    let nextScale: number;
    if (isDev) {
      const factor = e.deltaY > 0 ? 1.15 : 0.85;
      nextScale = Math.min(maxScale, Math.max(minScale, targetZoomScaleRef.current * factor));
    } else {
      const delta = e.deltaY > 0 ? 0.08 : -0.08;
      nextScale = Math.min(maxScale, Math.max(minScale, targetZoomScaleRef.current + delta));
    }

    targetZoomScaleRef.current = nextScale;
    setZoomScaleState(nextScale);
  };

  // Button Action Handlers
  const handleRotateLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    targetRotationRef.current -= Math.PI / 6;
  };

  const handleRotateRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    targetRotationRef.current += Math.PI / 6;
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isDev = showTileNumbersRef.current || devMode;
    const minScale = isDev ? 0.01 : 0.75;
    const nextScale = isDev
      ? Math.max(minScale, targetZoomScaleRef.current * 0.7)
      : Math.max(minScale, targetZoomScaleRef.current - 0.125);
    targetZoomScaleRef.current = nextScale;
    setZoomScaleState(nextScale);
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isDev = showTileNumbersRef.current || devMode;
    const maxScale = isDev ? 15.0 : 1.0;
    const nextScale = isDev
      ? Math.min(maxScale, targetZoomScaleRef.current * 1.4)
      : Math.min(maxScale, targetZoomScaleRef.current + 0.125);
    targetZoomScaleRef.current = nextScale;
    setZoomScaleState(nextScale);
  };

  const handleResetView = (e: React.MouseEvent) => {
    e.stopPropagation();
    targetRotationRef.current = 0;
    targetZoomScaleRef.current = 1.0;
    setZoomScaleState(1.0);
  };

  const handleMapChange = (newMap: MapType) => {
    if (newMap === selectedMap) return;
    setSelectedMap(newMap);
    selectedMapRef.current = newMap;
    audioService.playSplash();

    // Reset local toad position to default spawn for the selected map
    const initPad = getLocalDefaultGridPos(newMap);
    localGridPosRef.current = { col: initPad.col, row: initPad.row };
    const w = gridToWorld(initPad.col, initPad.row);
    const initY = getTileBaseY(newMap, initPad.col, initPad.row);
    localWorldPosRef.current = { x: w.x, y: initY, z: w.z };
    targetWorldPosRef.current = { x: w.x, y: initY, z: w.z };
    isHoppingRef.current = false;
    isSettlingRef.current = false;
    settleTimerRef.current = 0;
  };

  return (
    <div className="relative w-full aspect-[16/9] sm:aspect-[9/5] rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 bg-teal-950">
      {/* 3D Bloxorz Isometric Floating Sky Island WebGL Canvas */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      />

      {/* Top-Left Map Switcher Bar & Dev Switch */}
      <div className="absolute top-4 left-4 flex flex-wrap items-center gap-1.5 p-1.5 bg-black/80 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl z-30 select-none">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleMapChange('island');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            selectedMap === 'island'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-emerald-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>🪷</span>
          <span>Island Pond</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleMapChange('waterfall');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            selectedMap === 'waterfall'
              ? 'bg-cyan-400 text-slate-950 shadow-md'
              : 'text-cyan-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>🏞️</span>
          <span>Waterfall Mountain</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleMapChange('starry_night');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            selectedMap === 'starry_night'
              ? 'bg-amber-400 text-slate-950 shadow-md'
              : 'text-amber-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>🌌</span>
          <span>Starry Night</span>
        </button>

        <div className="w-px h-5 bg-white/20 my-auto hidden sm:block" />

        {/* Occasional Rain / Weather Control Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!rainSystemRef.current) return;
            const nextModes: WeatherMode[] = ['auto', 'heavy_rain', 'clear'];
            const curIdx = nextModes.indexOf(weatherMode);
            const nextMode = nextModes[(curIdx + 1) % nextModes.length];
            setWeatherMode(nextMode);
            rainSystemRef.current.setWeatherMode(nextMode);
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
            weatherLabel.includes('Rain') || weatherLabel.includes('Drizzle')
              ? 'bg-sky-400 text-slate-950 ring-2 ring-sky-300'
              : 'bg-black/90 text-sky-200 hover:text-white hover:bg-black border border-sky-500/30'
          }`}
          title="Weather System: Click to cycle between Occasional Rain (Auto), Forced Rain, or Clear Sky"
        >
          <CloudRain className="w-3.5 h-3.5" />
          <span>
            {weatherLabel} {weatherMode === 'auto' ? '(Auto)' : weatherMode === 'heavy_rain' ? '(Rain On)' : '(Clear)'}
          </span>
        </button>

        <div className="w-px h-5 bg-white/20 my-auto hidden sm:block" />

        {/* Dev Switch Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowTileNumbers((prev) => !prev);
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
            showTileNumbers
              ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
              : 'bg-black/90 text-amber-300 hover:text-white hover:bg-black border border-amber-500/30'
          }`}
          title="Dev Switch: Show tile coordinates [row,col] and tile numbers on middle of each tile"
        >
          <Hash className="w-3.5 h-3.5" />
          <span>Dev: Tile #s {showTileNumbers ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Camera Rotation & Zoom Floating Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 p-1.5 bg-black/80 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl z-30 select-none">
        <button
          onClick={handleRotateLeft}
          title="Rotate Left (⟲)"
          className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleRotateRight}
          title="Rotate Right (⟳)"
          className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-white/20 my-auto" />
        <button
          onClick={handleZoomIn}
          disabled={!showTileNumbers && !devMode && zoomScaleState <= 0.76}
          title={showTileNumbers || devMode ? "Zoom In (Dev Unrestricted)" : "Zoom In"}
          className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          disabled={!showTileNumbers && !devMode && zoomScaleState >= 0.98}
          title={showTileNumbers || devMode ? "Zoom Out (Dev Unrestricted)" : "Zoom Out"}
          className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-white/20 my-auto" />
        <button
          onClick={handleResetView}
          title="Reset Camera View"
          className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Super Powers Action Panel at Right Corner of the Screen */}
      <div className="absolute top-16 right-4 flex flex-col items-end gap-2 z-30 select-none pointer-events-auto">
        <div className="p-2 bg-black/85 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl flex flex-col gap-2 min-w-[210px]">
          <div className="flex items-center justify-between px-1.5 pb-1 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>SUPER POWERS</span>
            </div>
            {plantedBombsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/30 text-red-300 border border-red-500/40 text-[10px] font-mono font-bold animate-pulse">
                💣 {plantedBombsCount} Active
              </span>
            )}
          </div>

          {/* Super Power 1: Plant Bomb */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleBombPlacement();
            }}
            className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer shadow-md ${
              isPlantingBomb
                ? 'bg-red-500 text-white ring-2 ring-red-300 animate-pulse'
                : 'bg-zinc-900/90 text-red-200 hover:text-white hover:bg-red-950/80 border border-red-500/30'
            }`}
            title="Super Power 1: Plant a bomb on a tile. Detonates with an explosion when any frog jumps on it! (Shortcut: [B])"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">💣</span>
              <div className="text-left">
                <div className="font-black text-[12px] leading-tight">
                  {isPlantingBomb ? 'Targeting Tile...' : 'Plant Bomb'}
                </div>
                <div className="text-[10px] opacity-80">
                  {isPlantingBomb ? 'Click tile on pond' : 'Detonates on jump'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isPlantingBomb ? (
                <span className="p-1 rounded-md bg-white/20 text-white">
                  <X className="w-3 h-3" />
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-black/60 text-red-300 border border-red-500/40 font-mono text-[10px] font-black">
                  [B]
                </span>
              )}
            </div>
          </button>

          {/* Super Power 2: Tongue Push */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerTonguePush();
            }}
            className="w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer shadow-md bg-zinc-900/90 text-pink-200 hover:text-white hover:bg-pink-950/80 border border-pink-500/30 active:scale-95"
            title="Super Power 2: Use tongue to push other frog 1 tile back in facing direction! (Shortcut: [P])"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">👅</span>
              <div className="text-left">
                <div className="font-black text-[12px] leading-tight">Tongue Push</div>
                <div className="text-[10px] opacity-80">3-tile reach · pushes back</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-black/60 text-pink-300 border border-pink-500/40 font-mono text-[10px] font-black">
              [P]
            </span>
          </button>

          {/* Super Power 3: 4-Toad Totem Tower */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              formToadTower();
            }}
            className="w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer shadow-md bg-zinc-900/90 text-amber-200 hover:text-white hover:bg-amber-950/80 border border-amber-500/30 active:scale-95"
            title="Super Power 3: Hop all 3 companion frogs on your head to form a stack of 4! Hop with WASD to carry everyone together! (Shortcut: [T])"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">👑</span>
              <div className="text-left">
                <div className="font-black text-[12px] leading-tight">4-Toad Tower</div>
                <div className="text-[10px] opacity-80">Stack of 4 · hop together</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-black/60 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-black">
              [T]
            </span>
          </button>

          {/* Super Power 4: Scatter Frogs */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              scatterToads();
            }}
            className="w-full px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer shadow-md bg-zinc-900/90 text-teal-200 hover:text-white hover:bg-teal-950/80 border border-teal-500/30 active:scale-95"
            title="Unstack and scatter companion frogs to nearby tiles (Shortcut: [U])"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">✨</span>
              <div className="text-left">
                <div className="font-bold text-[11px] leading-tight">Scatter Frogs</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-black/60 text-teal-300 border border-teal-500/40 font-mono text-[10px] font-black">
              [U]
            </span>
          </button>

          {/* Practice Companion Frog Toggle */}
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px] px-1 text-slate-300">
            <span className="flex items-center gap-1">
              <span>🐸</span>
              <span className="text-[10px] font-semibold">3 Companion Frogs</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPracticeToadActive((prev) => !prev);
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                practiceToadActive
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {practiceToadActive ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Active Action Feedback Banner / Toast */}
        {superpowerToast && (
          <div className="px-3 py-1.5 bg-black/90 backdrop-blur-md rounded-xl border border-amber-400/50 text-amber-200 text-xs font-black shadow-2xl flex items-center gap-1.5 animate-bounce max-w-[240px]">
            <span>{superpowerToast.icon}</span>
            <span className="truncate">{superpowerToast.text}</span>
          </div>
        )}
      </div>

      {/* Floating Chat Bubbles Render Overlay */}
      {!quietMode &&
        bubbles.map((bubble) => {
          const coords = bubbleScreenPositions[bubble.playerId];
          if (!coords) return null;

          return (
            <div
              key={bubble.id}
              style={{
                left: `${coords.x}px`,
                top: `${coords.y}px`,
              }}
              className="absolute -translate-x-1/2 -translate-y-full mb-3 px-3.5 py-2 bg-white text-emerald-950 rounded-2xl text-xs font-black shadow-2xl border-2 border-emerald-900 pointer-events-none transition-all duration-75 z-30 max-w-[200px] text-center font-mono"
            >
              <div className="text-[10px] uppercase text-emerald-700 tracking-wider font-bold mb-0.5">
                {bubble.displayName}
              </div>
              <div>{bubble.text}</div>
              {/* Pointer triangle */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-emerald-900 rotate-45"></div>
            </div>
          );
        })}

      {/* Swarm Multiplier Active Banner */}
      {swarmActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-2xl bg-orange-500 border-b-4 border-orange-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-2xl animate-pulse z-20">
          <span className="text-base">🔥</span>
          <span>SWARM BONUS ACTIVE! {swarmMultiplier}x XP</span>
        </div>
      )}

      {/* Keyboard Controls Legend */}
      <div className="absolute bottom-4 left-4 px-4 py-2 bg-black/80 backdrop-blur-md rounded-2xl text-emerald-100 text-xs font-bold flex items-center gap-2.5 border border-white/20 shadow-2xl z-20">
        <span className="px-2 py-0.5 rounded bg-emerald-800 text-emerald-200 border border-emerald-400 font-mono text-[11px] font-black">
          WASD / ⬆️⬇️⬅️➡️
        </span>
        <span>Hop Island • Drag / ⟲⟳ to Rotate • Scroll / +/- to Zoom</span>
      </div>

      {/* Dev Switch: Tile Numbers Grid Legend & Inspector Bar */}
      {showTileNumbers && (
        <div className="absolute bottom-16 left-4 right-4 max-w-2xl p-3 bg-slate-950/90 backdrop-blur-md rounded-2xl border-2 border-amber-400 text-emerald-100 text-xs shadow-2xl z-30 font-mono space-y-2 select-none">
          <div className="flex flex-wrap items-center justify-between gap-2 text-amber-300 font-bold border-b border-amber-400/30 pb-1.5">
            <span className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                DEV TILE GRID (18x12)
              </span>
              <span>Showing row & col [r,c] and index # in middle of each tile</span>
            </span>
            {selectedTileInfo && (
              <button
                onClick={() => {
                  const txt = `Map: ${selectedTileInfo.mapName}, Row: ${selectedTileInfo.row}, Col: ${selectedTileInfo.col}, Index: ${selectedTileInfo.row * 18 + selectedTileInfo.col}, TileChar: '${selectedTileInfo.tileChar}'`;
                  navigator.clipboard.writeText(txt);
                  setCopiedTileText(true);
                  setTimeout(() => setCopiedTileText(false), 2000);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer"
              >
                {copiedTileText ? <Check className="w-3 h-3 text-slate-950" /> : <Copy className="w-3 h-3" />}
                <span>{copiedTileText ? 'Copied Tile Info!' : 'Copy Tile Code'}</span>
              </button>
            )}
          </div>

          {/* Selected Tile Inspector */}
          {selectedTileInfo && (
            <div className="bg-amber-950/50 p-2 rounded-xl border border-amber-500/40 text-amber-100 flex flex-wrap items-center justify-between text-[11px]">
              <div>
                <span className="text-amber-400 font-bold">Selected Tile: </span>
                <span>
                  Row <strong>{selectedTileInfo.row}</strong>, Col <strong>{selectedTileInfo.col}</strong> (Index #
                  <strong>{selectedTileInfo.row * 18 + selectedTileInfo.col}</strong>)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>Char:</span>
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black">
                  '{selectedTileInfo.tileChar}'
                </span>
              </div>
            </div>
          )}

          {/* Tile Types Legend */}
          <div className="text-[10px] grid grid-cols-2 sm:grid-cols-5 gap-x-2 gap-y-1 text-slate-300">
            <span><strong className="text-amber-300">'G':</strong> Grass</span>
            <span><strong className="text-cyan-300">'W':</strong> Water</span>
            <span><strong className="text-emerald-300">'L':</strong> Lily Pad</span>
            <span><strong className="text-slate-300">'S':</strong> Shore Rock</span>
            <span><strong className="text-emerald-400">'T':</strong> Tree</span>
            <span><strong className="text-green-400">'B':</strong> Bush</span>
            <span><strong className="text-amber-600">'O':</strong> Log</span>
            <span><strong className="text-indigo-300">'M':</strong> Mountain</span>
            <span><strong className="text-blue-300">'F':</strong> Waterfall</span>
            <span><strong className="text-zinc-400">'.':</strong> Sky Void</span>
          </div>
        </div>
      )}
    </div>
  );
};
