import { PlayerState, RoomState, ChatMessage } from '../types';

export type SocketEventCallback = (data: any) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<SocketEventCallback>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private currentRoomId: string = 'main-pond';
  private playerState: Partial<PlayerState> = {};
  private isConnected = false;

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Pond Socket] Connected to server');
        this.isConnected = true;
        this.emitLocal('connection_status', { connected: true });

        // Auto re-join room if state stored
        if (this.playerState.playerId) {
          this.joinRoom(this.currentRoomId, this.playerState as PlayerState);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type) {
            this.emitLocal(data.type, data);
          }
        } catch (e) {
          console.error('[Pond Socket] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        console.warn('[Pond Socket] Closed. Reconnecting in 3s...');
        this.isConnected = false;
        this.emitLocal('connection_status', { connected: false });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[Pond Socket] Connection issue, attempting reconnect...');
      };
    } catch (err) {
      console.error('[Pond Socket] Connection exception:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  public joinRoom(roomId: string, player: PlayerState) {
    this.currentRoomId = roomId;
    this.playerState = player;
    this.send({
      type: 'join_room',
      roomId,
      playerId: player.playerId,
      displayName: player.displayName,
      toadSpecies: player.toadSpecies,
      moltStage: player.moltStage,
      focusMinutes: player.focusMinutes,
      xp: player.xp,
      streakDays: player.streakDays,
    });
  }

  public updateStillState(isStill: boolean, position?: { x: number; y: number }) {
    this.send({
      type: 'update_still_state',
      isStill,
      position,
    });
  }

  public sendChat(text: string, displayName: string) {
    this.send({
      type: 'send_chat',
      text,
      displayName,
    });
  }

  public plantBomb(bomb: { id: string; col: number; row: number; mapName: string }) {
    this.send({
      type: 'plant_bomb',
      ...bomb,
    });
  }

  public detonateBomb(bombId: string, col: number, row: number, mapName: string) {
    this.send({
      type: 'detonate_bomb',
      bombId,
      col,
      row,
      mapName,
    });
  }

  public sendHop(fromCol: number, fromRow: number, toCol: number, toRow: number, facingAngle: number, carriedPlayerIds: string[] = []) {
    this.send({
      type: 'player_hop',
      fromCol,
      fromRow,
      toCol,
      toRow,
      facingAngle,
      carriedPlayerIds,
    });
  }

  public pushFrog(targetPlayerId: string, dCol: number, dRow: number, toCol: number, toRow: number) {
    this.send({
      type: 'push_frog',
      targetPlayerId,
      dCol,
      dRow,
      toCol,
      toRow,
    });
  }

  public leaveRoom() {
    this.send({
      type: 'leave_room',
    });
  }

  private send(data: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public on(event: string, callback: SocketEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: SocketEventCallback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emitLocal(event: string, data: any) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)!) {
        cb(data);
      }
    }
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
