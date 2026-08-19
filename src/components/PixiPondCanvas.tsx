import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerState, ChatMessage, ToadSpecies } from '../types';
import { TOAD_SPECIES_DATA } from '../data/species';
import { audioService } from '../services/audioService';

interface ActiveBubble {
  id: string;
  playerId: string;
  text: string;
  displayName: string;
  createdAt: number;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FireflyTarget {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

interface PixiPondCanvasProps {
  roomOccupants: PlayerState[];
  localPlayerId: string;
  swarmActive: boolean;
  swarmMultiplier: number;
  quietMode: boolean;
  strictMode: boolean;
  latestChatMessage?: ChatMessage | null;
  onStillnessChange: (isStill: boolean, pos?: { x: number; y: number }) => void;
  onFireflyCatch?: () => void;
}

export const PixiPondCanvas: React.FC<PixiPondCanvasProps> = ({
  roomOccupants,
  localPlayerId,
  swarmActive,
  swarmMultiplier,
  quietMode,
  latestChatMessage,
  strictMode,
  onStillnessChange,
  onFireflyCatch,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Position state for local toad (supports both Keyboard and Dragging)
  const localPosRef = useRef<{ x: number; y: number } | null>(null);
  const isMovingRef = useRef<boolean>(false);
  const hopPhaseRef = useRef<number>(0);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  // 10-Second Settling Transition to Stillness State (with 1s sitting-tight delay)
  const isSettlingRef = useRef<boolean>(false);
  const settleTimerRef = useRef<number>(0);
  const SETTLE_DELAY = 1.0; // 1 second delay when frog sits tight before the ring appears
  const SETTLE_DURATION = 10.0; // 10 seconds to transition from moving to still state

  // Dragging state for pointer fallback
  const [isDragging, setIsDragging] = useState(false);

  // Active chat bubbles map
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);

  // Particles & Fireflies
  const particlesRef = useRef<Particle[]>([]);
  const fireflyRef = useRef<FireflyTarget>({ x: 300, y: 150, vx: 1, vy: -0.5, active: false });

  // Zoomed-out Pad positions placed inside central zoomed-out pond
  const PAD_POSITIONS = [
    { x: 260, y: 270 },
    { x: 390, y: 220 },
    { x: 510, y: 220 },
    { x: 640, y: 270 },
  ];

  // Initialize local toad position if null
  const getLocalDefaultPos = useCallback(() => {
    const occupant = roomOccupants.find((p) => p.playerId === localPlayerId);
    const padIndex = occupant ? occupant.padIndex : 0;
    return PAD_POSITIONS[padIndex] || PAD_POSITIONS[0];
  }, [roomOccupants, localPlayerId]);

  // Handle incoming chat messages to trigger floating speech bubble
  useEffect(() => {
    if (!latestChatMessage || quietMode) return;

    audioService.playBubblePop();

    setBubbles((prev) => {
      const filtered = prev.filter((b) => b.playerId !== latestChatMessage.playerId);
      const newBubble: ActiveBubble = {
        id: latestChatMessage.messageId,
        playerId: latestChatMessage.playerId,
        text: latestChatMessage.text,
        displayName: latestChatMessage.displayName,
        createdAt: Date.now(),
        alpha: 1.0,
      };
      return [...filtered, newBubble];
    });
  }, [latestChatMessage, quietMode]);

  // Handle firefly spawn timer in strict mode
  useEffect(() => {
    if (!strictMode) {
      fireflyRef.current.active = false;
      return;
    }

    const interval = setInterval(() => {
      if (!fireflyRef.current.active && Math.random() < 0.6) {
        fireflyRef.current = {
          x: 100 + Math.random() * 700,
          y: 100 + Math.random() * 300,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 1.5,
          active: true,
        };
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [strictMode]);

  // Keyboard Event Listeners for WASD / Arrow Keys Hopping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing if user is in chat input field
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)
      ) {
        e.preventDefault();
        keysPressedRef.current[key] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)
      ) {
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

  // Main Canvas Render Loop & Keyboard Position Controller
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.03;
      const width = canvas.width;
      const height = canvas.height;

      // ----------------------------------------------------
      // A. Keyboard Movement Update Loop
      // ----------------------------------------------------
      const keys = keysPressedRef.current;
      const moveUp = keys['w'] || keys['arrowup'];
      const moveDown = keys['s'] || keys['arrowdown'];
      const moveLeft = keys['a'] || keys['arrowleft'];
      const moveRight = keys['d'] || keys['arrowright'];

      const isKeyMoving = moveUp || moveDown || moveLeft || moveRight;

      if (isKeyMoving) {
        if (!localPosRef.current) {
          localPosRef.current = { ...getLocalDefaultPos() };
        }

        const speed = 4.2;
        let dx = 0;
        let dy = 0;

        if (moveUp) dy -= speed;
        if (moveDown) dy += speed;
        if (moveLeft) dx -= speed;
        if (moveRight) dx += speed;

        // Normalize diagonal speed
        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        localPosRef.current.x = Math.max(50, Math.min(width - 50, localPosRef.current.x + dx));
        localPosRef.current.y = Math.max(70, Math.min(height - 60, localPosRef.current.y + dy));

        // Animate hop arc
        hopPhaseRef.current += 0.25;

        // If newly started moving
        if (!isMovingRef.current) {
          isMovingRef.current = true;
          isSettlingRef.current = false;
          settleTimerRef.current = 0;
          onStillnessChange(false, localPosRef.current);
          audioService.playCroak(1.2);
        }
      } else if (isMovingRef.current && !isDragging) {
        // Just stopped moving via keyboard -> start 10s settling transition
        isMovingRef.current = false;
        hopPhaseRef.current = 0;
        if (!localPosRef.current) {
          localPosRef.current = { ...getLocalDefaultPos() };
        }
        isSettlingRef.current = true;
        settleTimerRef.current = 0;
        audioService.playSplash();
      }

      // Update Settling countdown for stillness (After 1s sitting tight, ring counts down 10s)
      if (isSettlingRef.current && !isMovingRef.current && !isDragging) {
        settleTimerRef.current += 1 / 60;
        if (settleTimerRef.current >= SETTLE_DELAY + SETTLE_DURATION) {
          isSettlingRef.current = false;
          settleTimerRef.current = 0;
          audioService.playChime();
          const finalPos = localPosRef.current || getLocalDefaultPos();
          onStillnessChange(true, finalPos);
        }
      }

      // Calculate vertical hop offset for active movement
      const currentHopY = isKeyMoving || isDragging ? Math.abs(Math.sin(hopPhaseRef.current)) * 14 : 0;

      // ----------------------------------------------------
      // B. Draw Zoomed-Out Environment (Forest, Trees, Rocks)
      // ----------------------------------------------------
      // 1. Forest Floor Base Gradient
      const groundGrad = ctx.createRadialGradient(450, 250, 100, 450, 250, 500);
      groundGrad.addColorStop(0, '#1a3a1d');
      groundGrad.addColorStop(0.6, '#132815');
      groundGrad.addColorStop(1, '#0b170c');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, 0, width, height);

      // Scattered Forest Grass Tufts & Fallen Autumn Leaves
      ctx.fillStyle = '#2d5a27';
      for (let g = 0; g < 18; g++) {
        const gx = (g * 53 + 40) % 860;
        const gy = ((g * 71) % 120) + (g % 2 === 0 ? 20 : 380);
        ctx.beginPath();
        ctx.arc(gx, gy, 4, 0, Math.PI * 2);
        ctx.arc(gx + 4, gy - 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Small Wild Mushrooms
      const MUSHROOMS = [
        { x: 120, y: 110, color: '#e63946' },
        { x: 130, y: 118, color: '#e63946' },
        { x: 780, y: 130, color: '#ffb703' },
        { x: 800, y: 410, color: '#e63946' },
        { x: 90, y: 400, color: '#ffb703' },
      ];
      MUSHROOMS.forEach((m) => {
        ctx.fillStyle = '#f1faee';
        ctx.fillRect(m.x - 2, m.y - 4, 4, 8);
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y - 4, 6, Math.PI, 0);
        ctx.fill();
      });

      // ----------------------------------------------------
      // C. Draw Central Zoomed-Out Oval Pond Body
      // ----------------------------------------------------
      const POND_CENTER_X = 450;
      const POND_CENTER_Y = 265;
      const POND_RADIUS_X = 310;
      const POND_RADIUS_Y = 150;

      // Pond Ground Cutout Shadow
      ctx.fillStyle = '#081409';
      ctx.beginPath();
      ctx.ellipse(POND_CENTER_X, POND_CENTER_Y + 10, POND_RADIUS_X + 15, POND_RADIUS_Y + 15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shore Boulders & Mossy Rocks around the perimeter
      const ROCK_COUNT = 16;
      for (let r = 0; r < ROCK_COUNT; r++) {
        const angle = (r / ROCK_COUNT) * Math.PI * 2;
        const rx = POND_CENTER_X + Math.cos(angle) * (POND_RADIUS_X + 8);
        const ry = POND_CENTER_Y + Math.sin(angle) * (POND_RADIUS_Y + 8);
        const rockRadius = 14 + (r % 3) * 5;

        // Rock Shadow
        ctx.fillStyle = 'rgba(5, 12, 6, 0.6)';
        ctx.beginPath();
        ctx.arc(rx, ry + 4, rockRadius, 0, Math.PI * 2);
        ctx.fill();

        // Rock Base Color
        ctx.fillStyle = r % 2 === 0 ? '#384841' : '#283630';
        ctx.beginPath();
        ctx.arc(rx, ry, rockRadius, 0, Math.PI * 2);
        ctx.fill();

        // Moss Cap on Top
        ctx.fillStyle = '#40916c';
        ctx.beginPath();
        ctx.arc(rx, ry - 3, rockRadius * 0.6, Math.PI, 0);
        ctx.fill();
      }

      // Water Body Gradient
      const waterGrad = ctx.createRadialGradient(
        POND_CENTER_X,
        POND_CENTER_Y,
        20,
        POND_CENTER_X,
        POND_CENTER_Y,
        POND_RADIUS_X
      );
      waterGrad.addColorStop(0, '#1b494e');
      waterGrad.addColorStop(0.6, '#113538');
      waterGrad.addColorStop(1, '#091f21');

      ctx.fillStyle = waterGrad;
      ctx.beginPath();
      ctx.ellipse(POND_CENTER_X, POND_CENTER_Y, POND_RADIUS_X, POND_RADIUS_Y, 0, 0, Math.PI * 2);
      ctx.fill();

      // Animated Water Caustic Ripples
      ctx.strokeStyle = 'rgba(143, 227, 207, 0.15)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const rippleR = ((time * 18 + i * 80) % 240) + 20;
        const alpha = Math.max(0, 1 - rippleR / 260) * 0.18;
        ctx.strokeStyle = `rgba(143, 227, 207, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(
          POND_CENTER_X + Math.sin(time + i) * 20,
          POND_CENTER_Y + Math.cos(time + i) * 10,
          rippleR,
          rippleR * 0.45,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      // Reeds & Cattails on Pond Bank
      const REEDS = [
        { x: 170, y: 220 },
        { x: 180, y: 210 },
        { x: 720, y: 230 },
        { x: 735, y: 220 },
        { x: 300, y: 390 },
      ];
      REEDS.forEach((reed) => {
        ctx.strokeStyle = '#2d6a4f';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(reed.x, reed.y + 15);
        ctx.quadraticCurveTo(reed.x - 5, reed.y - 10, reed.x - 8, reed.y - 25);
        ctx.stroke();

        // Cattail tip
        ctx.fillStyle = '#6c5842';
        ctx.fillRect(reed.x - 10, reed.y - 22, 4, 12);
      });

      // Fallen Wooden Log on Right Shore
      ctx.save();
      ctx.translate(730, 360);
      ctx.rotate(-0.25);
      ctx.fillStyle = '#4a3319';
      ctx.fillRect(-35, -10, 70, 20);
      ctx.fillStyle = '#362410';
      ctx.fillRect(-35, -10, 8, 20);
      ctx.fillStyle = '#52b788';
      ctx.beginPath();
      ctx.arc(0, -6, 12, Math.PI, 0);
      ctx.fill();
      ctx.restore();

      // Stone Lantern on Top Shore
      ctx.save();
      ctx.translate(POND_CENTER_X, 105);
      // Base
      ctx.fillStyle = '#384841';
      ctx.fillRect(-12, 12, 24, 6);
      ctx.fillRect(-8, -4, 16, 16);
      // Glowing Window
      ctx.fillStyle = '#ffb703';
      ctx.shadowColor = '#ffb703';
      ctx.shadowBlur = 12;
      ctx.fillRect(-5, -2, 10, 8);
      ctx.shadowBlur = 0;
      // Roof
      ctx.fillStyle = '#283630';
      ctx.beginPath();
      ctx.moveTo(-16, -4);
      ctx.lineTo(16, -4);
      ctx.lineTo(0, -14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ----------------------------------------------------
      // D. Draw Overhanging Trees & Canopy
      // ----------------------------------------------------
      // Left Tree Trunk
      ctx.fillStyle = '#2b1e17';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(80, 40, 60, 140);
      ctx.lineTo(0, 140);
      ctx.closePath();
      ctx.fill();

      // Right Tree Trunk
      ctx.beginPath();
      ctx.moveTo(width, 0);
      ctx.quadraticCurveTo(width - 80, 40, width - 60, 140);
      ctx.lineTo(width, 140);
      ctx.closePath();
      ctx.fill();

      // Overhanging Leaves (Top Frame)
      ctx.fillStyle = '#1b4332';
      const leafClusterTime = Math.sin(time * 0.8) * 3;
      for (let c = 0; c < 12; c++) {
        const cx = c * 80 + 30;
        const cy = 20 + Math.sin(c + time) * 4 + leafClusterTime;
        const cr = 35 + (c % 3) * 10;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#2d6a4f';
      for (let c = 0; c < 10; c++) {
        const cx = c * 95 + 40;
        const cy = 10 + Math.cos(c * 2 + time) * 3;
        const cr = 28 + (c % 2) * 8;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }

      // ----------------------------------------------------
      // E. Draw Lily Pads inside Pond
      // ----------------------------------------------------
      PAD_POSITIONS.forEach((pad, index) => {
        const occupant = roomOccupants.find((p) => p.padIndex === index);
        const isOccupied = !!occupant;

        ctx.save();
        ctx.translate(pad.x, pad.y);

        // Pad Shadow
        ctx.fillStyle = 'rgba(5, 15, 16, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 14, 48, 24, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pad Green Leaves
        ctx.fillStyle = isOccupied ? '#2d6a4f' : '#1b4332';
        ctx.beginPath();
        ctx.arc(0, 0, 44, 0.25, Math.PI * 2 - 0.25);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();

        // Inner Leaf Veins
        ctx.strokeStyle = '#40916c';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(26, -22);
        ctx.moveTo(0, 0);
        ctx.lineTo(-26, -22);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 34);
        ctx.stroke();

        // Water Lily Flower on unassigned pads
        if (!isOccupied && index % 2 === 1) {
          ctx.fillStyle = '#ffb703';
          ctx.beginPath();
          ctx.arc(18, -12, 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          for (let p = 0; p < 6; p++) {
            const angle = (p * Math.PI) / 3;
            ctx.beginPath();
            ctx.ellipse(18 + Math.cos(angle) * 10, -12 + Math.sin(angle) * 10, 5, 2.5, angle, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      });

      // ----------------------------------------------------
      // F. Draw Swarm Particles & Fireflies
      // ----------------------------------------------------
      if (swarmActive) {
        if (Math.random() < 0.45 && particlesRef.current.length < 60) {
          particlesRef.current.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 1.8,
            vy: (Math.random() - 0.5) * 1.8,
            size: 2 + Math.random() * 3.5,
            color: '#ffee8c',
            alpha: 0.85,
            life: 0,
            maxLife: 90 + Math.random() * 80,
          });
        }
      }

      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx + Math.sin(time + idx) * 0.6;
        p.y += p.vy + Math.cos(time + idx) * 0.6;
        p.life++;
        const pAlpha = (1 - p.life / p.maxLife) * p.alpha;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, pAlpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 238, 140, 0.25)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      });

      particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);
      ctx.globalAlpha = 1.0;

      // ----------------------------------------------------
      // G. Draw Toad Sprites
      // ----------------------------------------------------
      PAD_POSITIONS.forEach((pad, index) => {
        const player = roomOccupants.find((p) => p.padIndex === index);
        if (!player) return;

        const isLocal = player.playerId === localPlayerId;
        const species = TOAD_SPECIES_DATA[player.toadSpecies] || TOAD_SPECIES_DATA['common'];

        // Position determination
        let toadX = pad.x;
        let toadY = pad.y - 10;

        if (isLocal) {
          if (localPosRef.current) {
            toadX = localPosRef.current.x;
            toadY = localPosRef.current.y - currentHopY;
          }
        }

        // Breathing & idle animation pulse
        const isStill = player.isStill;
        const breathScale = isStill ? 1 + Math.sin(time * 3 + index) * 0.04 : 1.1;
        const blinkOpen = Math.sin(time * 0.8 + index * 2) > -0.92;

        ctx.save();
        ctx.translate(toadX, toadY);

        // Movement trail effects
        if (isLocal && (isKeyMoving || isDragging)) {
          if (player.toadSpecies === 'poison_dart') {
            ctx.fillStyle = 'rgba(0, 180, 216, 0.45)';
            ctx.beginPath();
            ctx.arc(-12 + (Math.random() - 0.5) * 10, 10 + (Math.random() - 0.5) * 10, 7, 0, Math.PI * 2);
            ctx.fill();
          } else if (player.toadSpecies === 'golden') {
            ctx.fillStyle = 'rgba(255, 243, 176, 0.55)';
            ctx.beginPath();
            ctx.arc((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Shadow under toad
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 16 + currentHopY, 28 * breathScale, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Scale & Body
        ctx.scale(breathScale, breathScale);

        // Body Main Shape
        ctx.fillStyle = species.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly Accent
        ctx.fillStyle = species.accentColor;
        ctx.beginPath();
        ctx.ellipse(0, 5, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Horned Toad Spikes
        if (player.toadSpecies === 'horned') {
          ctx.fillStyle = '#eddcd2';
          ctx.beginPath();
          ctx.moveTo(-14, -18);
          ctx.lineTo(-20, -28);
          ctx.lineTo(-8, -20);
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(14, -18);
          ctx.lineTo(20, -28);
          ctx.lineTo(8, -20);
          ctx.fill();
        }

        // Eyes
        ctx.fillStyle = species.accentColor;
        ctx.beginPath();
        ctx.arc(-13, -16, 8, 0, Math.PI * 2);
        ctx.arc(13, -16, 8, 0, Math.PI * 2);
        ctx.fill();

        if (blinkOpen) {
          ctx.fillStyle = '#101010';
          ctx.beginPath();
          ctx.arc(-13, -16, 3.5, 0, Math.PI * 2);
          ctx.arc(13, -16, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = '#101010';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-16, -16);
          ctx.lineTo(-10, -16);
          ctx.moveTo(10, -16);
          ctx.lineTo(16, -16);
          ctx.stroke();
        }

        // Golden Toad Aura
        if (player.toadSpecies === 'golden') {
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.4 + Math.sin(time * 5) * 0.3})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, 0, 34, 26, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Tongue Flick Animation occasionally when still
        if (isStill && Math.sin(time * 2 + index * 3) > 0.96) {
          ctx.strokeStyle = '#ff758f';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -34);
          ctx.stroke();
          ctx.fillStyle = '#ff758f';
          ctx.beginPath();
          ctx.arc(0, -34, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // 10-Second Settling Loading Ring on TOP of toad's head (Appears after 1s sitting tight)
        if (isLocal && isSettlingRef.current && !isKeyMoving && !isDragging && settleTimerRef.current >= SETTLE_DELAY) {
          const activeSettlingTime = settleTimerRef.current - SETTLE_DELAY;
          const progress = Math.min(1.0, activeSettlingTime / SETTLE_DURATION);
          const remainingSec = Math.max(0, Math.ceil(SETTLE_DURATION - activeSettlingTime));
          const ringRadius = 24;
          const headY = -48 + Math.sin(time * 4) * 2;

          ctx.save();
          // Background Track
          ctx.beginPath();
          ctx.arc(0, headY, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.25)';
          ctx.lineWidth = 4.5;
          ctx.stroke();

          // Outer Pulse Aura
          const pulse = 0.85 + Math.sin(time * 5) * 0.15;
          ctx.beginPath();
          ctx.arc(0, headY, ringRadius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(52, 211, 153, ${0.2 * pulse})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Active Animated Filling Arc
          if (progress > 0) {
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + progress * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(0, headY, ringRadius, startAngle, endAngle);
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 8;
            ctx.stroke();

            // Leading Spark
            const tipX = Math.cos(endAngle) * ringRadius;
            const tipY = headY + Math.sin(endAngle) * ringRadius;
            ctx.beginPath();
            ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 6;
            ctx.fill();
          }

          // Center Countdown Number (Just the number, NO background box)
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#34d399';
          ctx.font = 'bold 15px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${remainingSec}`, 0, headY + 1);

          ctx.restore();
        }

        ctx.restore();

        // Player Name & Status Tag
        ctx.save();
        ctx.font = '11px "Silkscreen", monospace, sans-serif';
        ctx.textAlign = 'center';

        ctx.fillStyle = '#ffffff';
        ctx.fillText(player.displayName, toadX, toadY + 38);

        if (player.isStill) {
          ctx.fillStyle = 'rgba(45, 106, 79, 0.9)';
          ctx.fillRect(toadX - 35, toadY + 44, 70, 16);
          ctx.fillStyle = '#90be6d';
          ctx.font = '10px sans-serif';
          ctx.fillText('STILL (XP x1)', toadX, toadY + 56);
        } else {
          ctx.fillStyle = 'rgba(189, 52, 52, 0.9)';
          ctx.fillRect(toadX - 40, toadY + 44, 80, 16);
          ctx.fillStyle = '#ffadad';
          ctx.font = '10px sans-serif';
          ctx.fillText('MOVING [PAUSED]', toadX, toadY + 56);
        }

        ctx.restore();
      });

      // ----------------------------------------------------
      // H. Draw Strict Mode Target Firefly
      // ----------------------------------------------------
      if (strictMode && fireflyRef.current.active) {
        const ff = fireflyRef.current;
        ff.x += ff.vx;
        ff.y += ff.vy;

        if (ff.x < 50 || ff.x > width - 50) ff.vx *= -1;
        if (ff.y < 50 || ff.y > height - 80) ff.vy *= -1;

        ctx.fillStyle = '#ffee8c';
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(ff.x, ff.y, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CLICK!', ff.x, ff.y - 12);
        ctx.shadowBlur = 0;
      }

      // ----------------------------------------------------
      // I. Animated Speech Bubbles
      // ----------------------------------------------------
      if (!quietMode) {
        const now = Date.now();

        bubbles.forEach((bubble) => {
          const occupant = roomOccupants.find((p) => p.playerId === bubble.playerId);
          if (!occupant) return;

          const pad = PAD_POSITIONS[occupant.padIndex] || PAD_POSITIONS[0];
          let bx = pad.x;
          let by = pad.y - 60;

          if (occupant.playerId === localPlayerId && localPosRef.current) {
            bx = localPosRef.current.x;
            by = localPosRef.current.y - 60;
          }

          const age = now - bubble.createdAt;
          if (age > 5000) return;

          let alpha = 1.0;
          if (age > 4500) {
            alpha = (5000 - age) / 500;
          }

          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.font = '11px "Silkscreen", monospace, sans-serif';

          const textMetrics = ctx.measureText(bubble.text);
          const padding = 10;
          const bubbleW = Math.min(180, Math.max(80, textMetrics.width + padding * 2));
          const bubbleH = 34;

          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#101010';
          ctx.lineWidth = 3;

          ctx.beginPath();
          ctx.rect(bx - bubbleW / 2, by - bubbleH, bubbleW, bubbleH);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(bx - 6, by);
          ctx.lineTo(bx + 6, by);
          ctx.lineTo(bx, by + 8);
          ctx.closePath();
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#101010';
          ctx.textAlign = 'center';

          if (bubble.text.length > 22) {
            const line1 = bubble.text.slice(0, 22);
            const line2 = bubble.text.slice(22, 44);
            ctx.fillText(line1, bx, by - bubbleH + 13);
            ctx.fillText(line2, bx, by - bubbleH + 26);
          } else {
            ctx.fillText(bubble.text, bx, by - bubbleH / 2 + 4);
          }

          ctx.restore();
        });
      }

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [
    roomOccupants,
    localPlayerId,
    isDragging,
    swarmActive,
    quietMode,
    bubbles,
    strictMode,
    getLocalDefaultPos,
    onStillnessChange,
  ]);

  // Pointer Dragging Fallback handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 900 / rect.width;
    const scaleY = 500 / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if (strictMode && fireflyRef.current.active) {
      const dist = Math.hypot(clickX - fireflyRef.current.x, clickY - fireflyRef.current.y);
      if (dist < 30) {
        fireflyRef.current.active = false;
        audioService.playChime();
        if (onFireflyCatch) onFireflyCatch();
        return;
      }
    }

    const currentPos = localPosRef.current || getLocalDefaultPos();
    const distToToad = Math.hypot(clickX - currentPos.x, clickY - currentPos.y);

    if (distToToad < 50) {
      setIsDragging(true);
      localPosRef.current = { x: clickX, y: clickY };
      isMovingRef.current = true;
      isSettlingRef.current = false;
      settleTimerRef.current = 0;
      onStillnessChange(false, { x: clickX, y: clickY });
      audioService.playCroak(1.2);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 900 / rect.width;
    const scaleY = 500 / rect.height;

    const moveX = (e.clientX - rect.left) * scaleX;
    const moveY = (e.clientY - rect.top) * scaleY;

    localPosRef.current = { x: moveX, y: moveY };
  };

  const handlePointerUp = () => {
    if (!isDragging) return;

    setIsDragging(false);
    isMovingRef.current = false;
    audioService.playSplash();

    // Start 10-second settling transition before stillness
    isSettlingRef.current = true;
    settleTimerRef.current = 0;
  };

  return (
    <div ref={containerRef} className="relative w-full aspect-[9/5] rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 bg-emerald-950">
      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full object-cover cursor-grab active:cursor-grabbing select-none"
      />

      {/* Swarm Multiplier Active Banner */}
      {swarmActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-2xl bg-orange-500 border-b-4 border-orange-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-2xl animate-pulse z-20">
          <span className="text-base">🔥</span>
          <span>SWARM BONUS ACTIVE! {swarmMultiplier}x XP</span>
        </div>
      )}

      {/* Keyboard Movement Helper Tooltip */}
      <div className="absolute bottom-4 left-4 px-4 py-2 bg-black/70 backdrop-blur-md rounded-2xl text-emerald-200 text-xs font-bold flex items-center gap-2.5 border border-white/20 shadow-xl z-20">
        <span className="px-2 py-0.5 rounded bg-emerald-800 text-emerald-200 border border-emerald-500 font-mono text-[11px] font-black">
          WASD / ⬆️⬇️⬅️➡️
        </span>
        <span>Hop around with keyboard • Stop to stay still & earn XP</span>
      </div>
    </div>
  );
};
