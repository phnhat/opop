import { UserProfile, UserSettings, ToadSpecies, PondDecoration } from '../types';
import { TOAD_SPECIES_DATA } from '../data/species';

const PROFILE_KEY = 'pond_user_profile_v1';
const SETTINGS_KEY = 'pond_user_settings_v1';

export const DEFAULT_DECORATIONS: PondDecoration[] = [
  { id: 'pad_1', name: 'Emerald Lily Pad', type: 'pad', unlocked: true, requiredHours: 0, x: 20, y: 50, icon: '🍃' },
  { id: 'flower_1', name: 'Lotus Bloom', type: 'flower', unlocked: true, requiredHours: 0, x: 75, y: 35, icon: '🪷' },
  { id: 'rock_1', name: 'Mossy Boulder', type: 'rock', unlocked: true, requiredHours: 0, x: 80, y: 70, icon: '🪨' },
  { id: 'firefly_1', name: 'Nocturnal Swarm', type: 'firefly', unlocked: false, requiredHours: 3, x: 50, y: 20, icon: '✨' },
  { id: 'lantern_1', name: 'Pond Stone Lantern', type: 'lantern', unlocked: false, requiredHours: 8, x: 15, y: 25, icon: '🏮' },
  { id: 'statue_1', name: 'Sacred Frog Idol', type: 'statue', unlocked: false, requiredHours: 15, x: 50, y: 75, icon: '🗿' },
];

export const DEFAULT_SETTINGS: UserSettings = {
  focusDuration: 25,
  breakDuration: 5,
  soundVolume: 0.7,
  ambientEnabled: true,
  quietMode: false,
  strictMode: false,
  devMode: false,
};

export class UserService {
  public static getProfile(): UserProfile {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading user profile:', e);
    }

    const randomId = `toad_${Math.floor(1000 + Math.random() * 9000)}`;
    const newProfile: UserProfile = {
      playerId: randomId,
      displayName: `Toad ${randomId.slice(-4)}`,
      toadSpecies: 'common',
      xp: 0,
      bugsEaten: 0,
      totalFocusMinutes: 0,
      streakDays: 1,
      lastFocusDate: new Date().toISOString().slice(0, 10),
      unlockedSpecies: ['common', 'bullfrog'],
      decorations: DEFAULT_DECORATIONS,
    };

    this.saveProfile(newProfile);
    return newProfile;
  }

  public static saveProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Error saving profile:', e);
    }
  }

  public static getSettings(): UserSettings {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Error reading settings:', e);
    }
    return DEFAULT_SETTINGS;
  }

  public static saveSettings(settings: UserSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  }

  public static addFocusTime(minutes: number, xpEarned: number): UserProfile {
    const profile = this.getProfile();
    profile.totalFocusMinutes += minutes;
    profile.xp += xpEarned;
    profile.bugsEaten += Math.floor(xpEarned / 10);

    // Update streak check
    const today = new Date().toISOString().slice(0, 10);
    if (profile.lastFocusDate !== today) {
      const last = new Date(profile.lastFocusDate);
      const curr = new Date(today);
      const diffTime = Math.abs(curr.getTime() - last.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        profile.streakDays += 1;
      } else if (diffDays > 1) {
        profile.streakDays = 1;
      }
      profile.lastFocusDate = today;
    }

    // Check unlockable species & decorations based on total focus hours
    const totalHours = profile.totalFocusMinutes / 60;
    Object.values(TOAD_SPECIES_DATA).forEach((species) => {
      if (!profile.unlockedSpecies.includes(species.id) && totalHours >= species.requiredHours) {
        profile.unlockedSpecies.push(species.id);
      }
    });

    profile.decorations.forEach((dec) => {
      if (!dec.unlocked && totalHours >= dec.requiredHours) {
        dec.unlocked = true;
      }
    });

    this.saveProfile(profile);
    return profile;
  }
}
