import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PlayerState {
  playerId: string;
  displayName: string;
  toadSpecies: "common" | "bullfrog" | "poison_dart" | "horned" | "golden";
  moltStage: "tadpole" | "froglet" | "adult" | "elder";
  isStill: boolean;
  padIndex: number; // 0..3
  position: { x: number; y: number };
  focusMinutes: number;
  xp: number;
  streakDays: number;
}

interface Room {
  id: string;
  name: string;
  occupants: Map<string, { ws: WebSocket; player: PlayerState }>;
  swarmActive: boolean;
  swarmMultiplier: number;
  graceTimeout: NodeJS.Timeout | null;
}

const app = express();
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(express.json());

// In-memory room store
const rooms = new Map<string, Room>();

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      name: `Pond Room ${roomId}`,
      occupants: new Map(),
      swarmActive: false,
      swarmMultiplier: 1.0,
      graceTimeout: null,
    });
  }
  return rooms.get(roomId)!;
}

function calculateSwarmStatus(room: Room) {
  const occupants = Array.from(room.occupants.values());
  const count = occupants.length;
  if (count < 1) {
    room.swarmActive = false;
    room.swarmMultiplier = 1.0;
    return;
  }

  const allStill = occupants.every((o) => o.player.isStill);

  if (allStill) {
    if (room.graceTimeout) {
      clearTimeout(room.graceTimeout);
      room.graceTimeout = null;
    }
    room.swarmActive = count > 1;
    // Scaling multiplier
    if (count === 2) room.swarmMultiplier = 1.1;
    else if (count === 3) room.swarmMultiplier = 1.25;
    else if (count >= 4) room.swarmMultiplier = 1.5;
    else room.swarmMultiplier = 1.0;
  } else {
    // If one player moved, grant a 3-second grace period before turning off swarm
    if (!room.graceTimeout && room.swarmActive) {
      room.graceTimeout = setTimeout(() => {
        room.swarmActive = false;
        room.swarmMultiplier = 1.0;
        room.graceTimeout = null;
        broadcastRoomState(room);
      }, 3000);
    }
  }
}

function broadcastRoomState(room: Room) {
  const occupantsList = Array.from(room.occupants.values()).map((o) => o.player);
  const payload = JSON.stringify({
    type: "room_state_sync",
    roomId: room.id,
    roomOccupants: occupantsList,
    swarmActive: room.swarmActive,
    swarmMultiplier: room.swarmMultiplier,
  });

  for (const occupant of room.occupants.values()) {
    if (occupant.ws.readyState === WebSocket.OPEN) {
      occupant.ws.send(payload);
    }
  }
}

function broadcastToRoom(room: Room, messagePayload: object, excludePlayerId?: string) {
  const messageStr = JSON.stringify(messagePayload);
  for (const [pId, occupant] of room.occupants.entries()) {
    if (pId !== excludePlayerId && occupant.ws.readyState === WebSocket.OPEN) {
      occupant.ws.send(messageStr);
    }
  }
}

wss.on("connection", (ws) => {
  let currentRoomId: string | null = null;
  let currentPlayerId: string | null = null;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case "join_room": {
          const roomId = msg.roomId || "main-pond";
          const room = getOrCreateRoom(roomId);

          // If room has 4 occupants and user is not in it, find/create another room
          if (room.occupants.size >= 4 && !room.occupants.has(msg.playerId)) {
            const fallbackRoomId = `${roomId}-${Math.floor(Date.now() / 60000)}`;
            const fallbackRoom = getOrCreateRoom(fallbackRoomId);
            joinPlayerToRoom(ws, fallbackRoom, msg);
            currentRoomId = fallbackRoom.id;
            currentPlayerId = msg.playerId;
            return;
          }

          joinPlayerToRoom(ws, room, msg);
          currentRoomId = room.id;
          currentPlayerId = msg.playerId;
          break;
        }

        case "update_still_state": {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const occupant = room.occupants.get(currentPlayerId);
          if (occupant) {
            occupant.player.isStill = !!msg.isStill;
            if (msg.position) {
              occupant.player.position = msg.position;
            }
            calculateSwarmStatus(room);
            broadcastRoomState(room);
          }
          break;
        }

        case "send_chat": {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const text = (msg.text || "").trim().slice(0, 60);
          if (!text) return;

          const chatPayload = {
            type: "chat_broadcast",
            playerId: currentPlayerId,
            displayName: msg.displayName || "Lilypad Toad",
            text,
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
          };

          broadcastToRoom(room, chatPayload);
          break;
        }

        case "plant_bomb": {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const bombPayload = {
            type: "bomb_planted",
            id: msg.id || `bomb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            planterId: currentPlayerId,
            col: msg.col,
            row: msg.row,
            mapName: msg.mapName || "island",
            createdAt: Date.now(),
          };

          broadcastToRoom(room, bombPayload);
          break;
        }

        case "detonate_bomb": {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          broadcastToRoom(room, {
            type: "bomb_detonated",
            bombId: msg.bombId,
            col: msg.col,
            row: msg.row,
            mapName: msg.mapName,
            detonatedBy: currentPlayerId,
          });
          break;
        }

        case "player_hop": {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          broadcastToRoom(room, {
            type: "player_hop",
            playerId: currentPlayerId,
            fromCol: msg.fromCol,
            fromRow: msg.fromRow,
            toCol: msg.toCol,
            toRow: msg.toRow,
            facingAngle: msg.facingAngle,
            carriedPlayerIds: msg.carriedPlayerIds || [],
          });
          break;
        }

        case "push_frog": {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          broadcastToRoom(room, {
            type: "frog_pushed",
            pusherId: currentPlayerId,
            targetPlayerId: msg.targetPlayerId,
            dCol: msg.dCol,
            dRow: msg.dRow,
            toCol: msg.toCol,
            toRow: msg.toRow,
          });
          break;
        }

        case "leave_room": {
          if (currentRoomId && currentPlayerId) {
            removePlayerFromRoom(currentRoomId, currentPlayerId);
            currentRoomId = null;
            currentPlayerId = null;
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error("Error processing socket message:", err);
    }
  });

  ws.on("close", () => {
    if (currentRoomId && currentPlayerId) {
      removePlayerFromRoom(currentRoomId, currentPlayerId);
    }
  });
});

function joinPlayerToRoom(ws: WebSocket, room: Room, msg: any) {
  // Determine available pad index (0..3)
  const usedPads = new Set(Array.from(room.occupants.values()).map((o) => o.player.padIndex));
  let padIndex = 0;
  for (let i = 0; i < 4; i++) {
    if (!usedPads.has(i)) {
      padIndex = i;
      break;
    }
  }

  const player: PlayerState = {
    playerId: msg.playerId || `toad_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    displayName: msg.displayName || "Ribbit Friend",
    toadSpecies: msg.toadSpecies || "common",
    moltStage: msg.moltStage || "tadpole",
    isStill: true,
    padIndex,
    position: msg.position || { x: 100 + padIndex * 150, y: 200 },
    focusMinutes: msg.focusMinutes || 0,
    xp: msg.xp || 0,
    streakDays: msg.streakDays || 1,
  };

  room.occupants.set(player.playerId, { ws, player });
  calculateSwarmStatus(room);
  broadcastRoomState(room);

  // Send player join notice to others
  broadcastToRoom(
    room,
    {
      type: "player_joined",
      player,
    },
    player.playerId
  );
}

function removePlayerFromRoom(roomId: string, playerId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.occupants.delete(playerId);
  if (room.occupants.size === 0) {
    if (room.graceTimeout) clearTimeout(room.graceTimeout);
    rooms.delete(roomId);
  } else {
    calculateSwarmStatus(room);
    broadcastRoomState(room);
    broadcastToRoom(room, {
      type: "player_left",
      playerId,
    });
  }
}

// REST API endpoints
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", activeRooms: rooms.size, timestamp: new Date().toISOString() });
});

app.get("/api/rooms", (_req, res) => {
  const roomList = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    occupantCount: r.occupants.size,
    swarmActive: r.swarmActive,
    swarmMultiplier: r.swarmMultiplier,
  }));
  res.json({ rooms: roomList });
});

async function start() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Pond Server] Running on http://0.0.0.0:${PORT}`);
  });
}

start();
