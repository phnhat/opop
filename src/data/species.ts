import { ToadTrait, MoltStage } from '../types';

export const TOAD_SPECIES_DATA: Record<string, ToadTrait> = {
  common: {
    id: 'common',
    name: 'Common Toad',
    passiveName: 'Standard Rest',
    description: 'Balanced baseline XP ticking rate. Reliable and steady focus companion.',
    visualFeature: 'Classic olive-green pixel sprite with warm earthy spots.',
    baseXpMultiplier: 1.0,
    tickIntervalMs: 1000,
    unlockedByDefault: true,
    requiredHours: 0,
    color: '#4a7c59',
    accentColor: '#8fc0a9'
  },
  bullfrog: {
    id: 'bullfrog',
    name: 'Bullfrog',
    passiveName: 'Deep Focus Burst',
    description: 'Slower tick frequency, but delivers larger XP chunks per tick for deep sessions.',
    visualFeature: 'Chunky dark-green pixel frame with a bold yellowish gullet.',
    baseXpMultiplier: 1.25,
    tickIntervalMs: 2000,
    unlockedByDefault: true,
    requiredHours: 0,
    color: '#2d5a27',
    accentColor: '#d4a373'
  },
  poison_dart: {
    id: 'poison_dart',
    name: 'Poison Dart Toad',
    passiveName: 'Hyper Focus Trail',
    description: '10% faster baseline XP ticking speed. Emits bright cyan neon particle trails when dragged.',
    visualFeature: 'Vibrant neon blue & electric yellow poison warning markings.',
    baseXpMultiplier: 1.1,
    tickIntervalMs: 900,
    unlockedByDefault: false,
    requiredHours: 2,
    color: '#00b4d8',
    accentColor: '#ffb703'
  },
  horned: {
    id: 'horned',
    name: 'Horned Toad',
    passiveName: 'Hot Streak Multiplier',
    description: 'Grants +5% bonus XP for each consecutive day in your focus streak (up to +50%).',
    visualFeature: 'Spiky horned brow ridge with sandy desert camouflage textures.',
    baseXpMultiplier: 1.0,
    tickIntervalMs: 1000,
    unlockedByDefault: false,
    requiredHours: 5,
    color: '#cb997e',
    accentColor: '#ddbea9'
  },
  golden: {
    id: 'golden',
    name: 'Golden Toad',
    passiveName: 'Prestige Aura',
    description: 'Prestige companion. Emits glowing golden shimmer sparkles and +30% flat XP boost.',
    visualFeature: 'Pure metallic gold shimmer body with a glowing sacred aura.',
    baseXpMultiplier: 1.3,
    tickIntervalMs: 1000,
    unlockedByDefault: false,
    requiredHours: 10,
    color: '#ffb703',
    accentColor: '#fff3b0'
  }
};

export function getMoltStage(totalFocusHours: number): { stage: MoltStage; label: string; minHours: number; maxHours: number; badgeColor: string } {
  if (totalFocusHours >= 75) {
    return { stage: 'elder', label: 'Elder Toad', minHours: 75, maxHours: 999, badgeColor: 'bg-purple-900/80 text-purple-200 border-purple-500' };
  }
  if (totalFocusHours >= 20) {
    return { stage: 'adult', label: 'Adult Toad', minHours: 20, maxHours: 75, badgeColor: 'bg-emerald-900/80 text-emerald-200 border-emerald-500' };
  }
  if (totalFocusHours >= 5) {
    return { stage: 'froglet', label: 'Froglet', minHours: 5, maxHours: 20, badgeColor: 'bg-amber-900/80 text-amber-200 border-amber-500' };
  }
  return { stage: 'tadpole', label: 'Tadpole', minHours: 0, maxHours: 5, badgeColor: 'bg-teal-900/80 text-teal-200 border-teal-500' };
}
