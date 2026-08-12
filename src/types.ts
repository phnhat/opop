export type ToadSpecies = 'common' | 'bullfrog' | 'poison_dart' | 'horned' | 'golden';

export type MoltStage = 'tadpole' | 'froglet' | 'adult' | 'elder';

export interface ToadTrait {
  id: ToadSpecies;
  name: string;
  passiveName: string;
  description: string;
  visualFeature: string;
  baseXpMultiplier: number;
  tickIntervalMs: number;
  unlockedByDefault: boolean;
  requiredHours: number;
  color: string;
  accentColor: string;
  spriteUrl?: string;
}

export interface PlayerState {
  playerId: string;
  displayName: string;
  toadSpecies: ToadSpecies;
  moltStage: MoltStage;
  isStill: boolean;
  padIndex: number; // 0..3
  position: { x: number; y: number };
  focusMinutes: number;
  xp: number;
  level?: number;
  streakDays: number;
}

export interface RoomState {
  roomId: string;
  roomOccupants: PlayerState[];
  swarmActive: boolean;
  swarmMultiplier: number;
}

export interface ChatMessage {
  messageId: string;
  playerId: string;
  displayName: string;
  text: string;
  timestamp: number;
}

export interface PondDecoration {
  id: string;
  name: string;
  type: 'pad' | 'flower' | 'firefly' | 'rock' | 'statue' | 'lantern';
  unlocked: boolean;
  requiredHours: number;
  x: number;
  y: number;
  icon: string;
}

export interface UserSettings {
  focusDuration: number; // in minutes
  breakDuration: number; // in minutes
  soundVolume: number;   // 0 to 1
  ambientEnabled: boolean;
  quietMode: boolean;    // Hide speech bubbles
  strictMode: boolean;   // Enable Firefly presence checks
  devMode?: boolean;     // Dev switch to show tile numbers/coordinates on canvas grid
}

export interface UserProfile {
  playerId: string;
  displayName: string;
  toadSpecies: ToadSpecies;
  xp: number;
  bugsEaten: number;
  totalFocusMinutes: number;
  streakDays: number;
  lastFocusDate: string;
  unlockedSpecies: ToadSpecies[];
  decorations: PondDecoration[];
}
