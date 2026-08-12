import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Compass, Hash, Copy, Check } from 'lucide-react';
import { PlayerState, ChatMessage, ToadSpecies } from '../types';
import { TOAD_SPECIES_DATA } from '../data/species';
import { audioService } from '../services/audioService';

interface ActiveBubble {
  id: string;
  playerId: string;
  text: string;
  displayName: string;
  createdAt: number;
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

export type MapType = 'island' | 'waterfall';

// Tile Map Layout Definition (18 columns x 12 rows)
// 'G': Grass Tile
// 'W': Water Tile (Pond / River)
// 'L': Lily Pad Tile (resting spots)
// 'S': Shoreline River Rock Tile
// 'T': Tree Tile
// 'B': Bush Tile
// 'O': Fallen Log Tile
// 'M': Mountain Stone Stair Step Tile
// 'F': Waterfall Water Source Tile
// 'C': Fire Bonfire / Campfire Tile
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

  // Helper for determining base Y elevation depending on map type and tile
  const getTileBaseY = useCallback((m: MapType, col: number, row: number): number => {
    const tileMap = m === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP;
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 0.3;
    const tile = tileMap[row][col];

    if (m === 'waterfall') {
      if (row >= 7) {
        // Valley floor & river basin level
        if (tile === 'B') return 0.85;
        if (tile === 'O') return 0.725;
        if (tile === 'S') return 0.45;
        return 0.3;
      }

      // Highest Peak Block set: r3c10, r3c11, r4c10, r4c11
      const peakCoords = [
        { r: 3, c: 10 }, { r: 3, c: 11 },
        { r: 4, c: 10 }, { r: 4, c: 11 }
      ];

      let minDist = 99;
      for (const p of peakCoords) {
        const dist = Math.max(Math.abs(row - p.r), Math.abs(col - p.c));
        if (dist < minDist) minDist = dist;
      }

      // 5 elevation steps leading up to highest peak (Step 0 = 0.3, Step 1 = 0.9, Step 2 = 1.5, Step 3 = 2.1, Step 4 = 2.7, Step 5 Peak = 3.3)
      const level = Math.max(0, 5 - minDist);
      const baseElevation = 0.3 + level * 0.6;

      if (tile === 'B') return baseElevation + 0.55; // Sit on bush
      if (tile === 'O') return baseElevation + 0.425; // Sit on log
      if (tile === 'S') return baseElevation + 0.15;  // Shore rock
      return baseElevation; // Ground / Water surface
    } else {
      if (tile === 'B') return 0.9;   // Elevate toad to sit on top of bush
      if (tile === 'C') return 0.65;  // Elevate toad when sitting near bonfire pit
      if (tile === 'O') {
        if (row === 2 && col >= 6 && col <= 10) return 0.825; // Elevate toad on giant log behind pond
        return 0.725; // Standard fallen log
      }
      if (tile === 'S') return 0.5;   // Elevate toad to sit on top of shoreline river rock
      return 0.3;                     // Standard ground level / water surface
    }
  }, []);

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
    const list = m === 'waterfall' ? WATERFALL_LILY_PAD_POSITIONS : ISLAND_LILY_PAD_POSITIONS;
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
  }, []);

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
    scene.background = new THREE.Color(0x3d7068); // Sky blue-teal
    scene.fog = new THREE.FogExp2(0x3d7068, 0.025);

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff3d1, 1.8);
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

    const skyHemiLight = new THREE.HemisphereLight(0xbbe1fa, 0x1b262c, 0.8);
    scene.add(skyHemiLight);

    // 3. Materials for Voxel / Blocky Island Grid
    const grassTopMat = new THREE.MeshStandardMaterial({ color: 0x529432, roughness: 0.7 });
    const grassSideMat = new THREE.MeshStandardMaterial({ color: 0x5a3921, roughness: 0.9 }); // Dirt cliff
    const grassMaterials = [
      grassSideMat, grassSideMat, grassTopMat, grassSideMat, grassSideMat, grassSideMat
    ];

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2f7585,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.88,
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
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x633815, roughness: 0.8 });
    const innerWoodMat = new THREE.MeshStandardMaterial({ color: 0xd4a56a, roughness: 0.7 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x48270e, roughness: 0.8 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x427333, roughness: 0.9 });
    const shroomStemMat = new THREE.MeshStandardMaterial({ color: 0xf3ebd8, roughness: 0.5 });
    const shroomCapMat = new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.4 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d6e2c, roughness: 0.6 });
    const pineLeafMat = new THREE.MeshStandardMaterial({ color: 0x1d4d29, roughness: 0.6 });
    const redLeafMat = new THREE.MeshStandardMaterial({ color: 0xbc2d19, roughness: 0.6 });
    const redLeafTopMat = new THREE.MeshStandardMaterial({ color: 0xda5a24, roughness: 0.6 });
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
    const activeTileMap = selectedMap === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tileType = activeTileMap[r][c];
        if (tileType === '.') continue; // Void

        const { x, z } = gridToWorld(c, r);
        const tileBaseY = getTileBaseY(selectedMap, c, r);

        if (tileType === 'W' || tileType === 'L' || tileType === 'F') {
          // Water Block
          const waterHeight = tileBaseY + 0.15;
          const wMesh = new THREE.Mesh(waterGeo, waterMat);
          wMesh.position.set(x, waterHeight, z);
          wMesh.receiveShadow = true;
          islandGroup.add(wMesh);

          waterMeshes.push({ mesh: wMesh, initY: waterHeight, gridX: x, gridZ: z });

          // Cliff Extension going down into the sky below the water tile
          const cliffGeo = new THREE.BoxGeometry(TILE_SIZE, 3.5, TILE_SIZE);
          const cliffMesh = new THREE.Mesh(cliffGeo, grassSideMat);
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
            const padMat = new THREE.MeshStandardMaterial({ color: 0x2e7a3a, roughness: 0.6 });
            const padMesh = new THREE.Mesh(padGeo, padMat);
            padMesh.position.set(x, tileBaseY + 0.38, z);
            padMesh.receiveShadow = true;
            islandGroup.add(padMesh);
          }
        } else {
          // Solid Ground Block
          const block = new THREE.Mesh(boxGeo, grassMaterials);
          block.position.set(x, 0, z);
          block.castShadow = true;
          block.receiveShadow = true;
          islandGroup.add(block);

          // Cliff Extension going down into the sky below the island
          const cliffGeo = new THREE.BoxGeometry(TILE_SIZE, 3.5, TILE_SIZE);
          const cliffMesh = new THREE.Mesh(cliffGeo, grassSideMat);
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
          if (tileType === 'S') {
            // Natural Shoreline River Boulders & Pebbles
            const boulderGeo = new THREE.DodecahedronGeometry(0.38, 1);
            const boulder = new THREE.Mesh(boulderGeo, riverRockMat1);
            boulder.scale.set(1.1, 0.65, 0.9);
            boulder.position.set(x + 0.1, tileBaseY + 0.22, z - 0.08);
            boulder.rotation.y = (r + c) * 0.7;
            boulder.castShadow = true;
            boulder.receiveShadow = true;

            const smallRockGeo = new THREE.DodecahedronGeometry(0.24, 1);
            const smallRock = new THREE.Mesh(smallRockGeo, riverRockMat2);
            smallRock.scale.set(0.9, 0.55, 1.1);
            smallRock.position.set(x - 0.22, tileBaseY + 0.15, z + 0.15);
            smallRock.rotation.y = (r * c) * 1.3;
            smallRock.castShadow = true;

            islandGroup.add(boulder, smallRock);
          } else if (tileType === 'T') {
            // Diverse Voxel Tree Varieties: 0 = Green Oak, 1 = Evergreen Pine, 2 = Autumn Red Maple
            const treeVariant = (r * 7 + c * 11) % 3;

            if (treeVariant === 1) {
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
            const bush = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), leafMat);
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
    ] : [
      { col: 2, row: 1, offsetX: -0.2, offsetZ: 0.2 },  // Top-left woodland
      { col: 1, row: 2, offsetX: 0.18, offsetZ: -0.15 }, // Near left log
      { col: 15, row: 1, offsetX: 0.1, offsetZ: 0.2 },   // Top-right grove
      { col: 14, row: 4, offsetX: -0.2, offsetZ: 0.2 },  // Right pond shore
      { col: 3, row: 8, offsetX: 0.2, offsetZ: -0.1 },   // Bottom-left forest floor
    ];

    mushroomSpots.forEach((spot) => {
      const { x, z } = gridToWorld(spot.col, spot.row);
      const baseY = getTileBaseY(selectedMap, spot.col, spot.row);
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
      tongueGroup.position.set(0, 0.45, 0.3); // Mouth origin
      tongueGroup.name = 'tongueGroup';

      const tongueMat = new THREE.MeshStandardMaterial({
        color: 0xff3366,
        roughness: 0.3,
        emissive: 0xff1040,
        emissiveIntensity: 0.5,
      });

      const tongueStem = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.0), tongueMat);
      tongueStem.position.set(0, 0, 0.5);
      tongueGroup.add(tongueStem);

      const tongueTip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), tongueMat);
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

        const currentMap = selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP;
        const nextTile = currentMap[nextRow]?.[nextCol];

        // Check if next tile is valid land/water (not empty void '.' and not solid Tree 'T')
        if (
          nextRow >= 0 && nextRow < ROWS &&
          nextCol >= 0 && nextCol < COLS &&
          nextTile !== '.' &&
          nextTile !== 'T'
        ) {
          // Launch Splash at current tile before leaving ONLY if current tile is water/lily pad/waterfall spring
          const curTile = currentMap[localGridPosRef.current.row][localGridPosRef.current.col];
          if (curTile === 'W' || curTile === 'L' || curTile === 'F') {
            triggerSplash(localWorldPosRef.current.x, localWorldPosRef.current.z);
          }

          startWorldYRef.current = localWorldPosRef.current.y;
          localGridPosRef.current = { col: nextCol, row: nextRow };
          const nextW = gridToWorld(nextCol, nextRow);
          const targetBaseY = getTileBaseY(selectedMapRef.current, nextCol, nextRow);
          targetWorldPosRef.current = { x: nextW.x, y: targetBaseY, z: nextW.z };
          isHoppingRef.current = true;
          hopProgressRef.current = 0;

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
          const currentMap = selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP;
          const landTile = currentMap[localGridPosRef.current.row][localGridPosRef.current.col];
          if (landTile === 'W' || landTile === 'L' || landTile === 'F') {
            triggerSplash(localWorldPosRef.current.x, localWorldPosRef.current.z);
            audioService.playSplash();
          } else {
            audioService.playCroak(1.1);
          }

          onStillnessChangeRef.current(true, { x: localWorldPosRef.current.x, y: localWorldPosRef.current.z });
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
        const breath = player.isStill ? 1.0 + Math.sin(elapsedTime * 4) * 0.04 : 1.0;
        frogGroup.scale.set(breath, breath, breath);

        // --- Tongue Bug Hunting Logic ---
        const isToadStill = isLocal ? (!isHoppingRef.current) : player.isStill;
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
        if (tongueGroup) {
          if (tState.isShooting) {
            tState.progress += delta * 4.8;
            const p = Math.min(1.0, tState.progress);

            tongueGroup.visible = true;
            tongueGroup.lookAt(tState.targetPos);

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
              tongueGroup.scale.set(1, 1, 0.001);
            }
          } else {
            tongueGroup.visible = false;
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
    };
  }, [selectedMap, getLocalDefaultGridPos, gridToWorld, getTileBaseY]);

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

    if (dist < 5) {
      if (showTileNumbersRef.current) {
        const clickX = localWorldPosRef.current.x;
        const clickZ = localWorldPosRef.current.z;
        const c = Math.round(clickX / TILE_SIZE + COLS / 2 - 0.5);
        const r = Math.round(clickZ / TILE_SIZE + ROWS / 2 - 0.5);
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          const map = selectedMapRef.current === 'waterfall' ? WATERFALL_TILE_MAP : ISLAND_TILE_MAP;
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
