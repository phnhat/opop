import React, { useState } from 'react';
import { UserSettings, UserProfile } from '../types';
import { Settings, Volume2, Clock, EyeOff, ShieldCheck, User, Hash } from 'lucide-react';

interface SettingsViewProps {
  settings: UserSettings;
  profile: UserProfile;
  onSaveSettings: (settings: UserSettings) => void;
  onSaveProfile: (profile: UserProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  profile,
  onSaveSettings,
  onSaveProfile,
}) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>({ ...settings });
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(localSettings);

    const updatedProfile = { ...profile, displayName: displayName.trim() || 'Ribbit Friend' };
    onSaveProfile(updatedProfile);

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-3xl font-black tracking-tight text-emerald-100 font-mono flex items-center justify-center gap-2">
          <Settings className="w-7 h-7 text-emerald-400" />
          <span>APP CONFIGURATION</span>
        </h2>
        <p className="text-xs text-emerald-300/80">Customize Pomodoro timers, sound levels, and chat quiet mode.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 bg-emerald-950/80 p-6 rounded-2xl border border-emerald-800 shadow-xl">
        {/* Profile Name */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-emerald-200 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            <span>Display Name in Pond Rooms</span>
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
            placeholder="Your toad nickname..."
            className="w-full bg-emerald-900/60 border border-emerald-700 text-emerald-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        {/* Pomodoro Timer Timings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-bold text-emerald-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Focus Duration (Minutes)</span>
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={localSettings.focusDuration}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, focusDuration: Math.max(1, parseInt(e.target.value) || 25) })
              }
              className="w-full bg-emerald-900/60 border border-emerald-700 text-emerald-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-emerald-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>Break Duration (Minutes)</span>
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={localSettings.breakDuration}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, breakDuration: Math.max(1, parseInt(e.target.value) || 5) })
              }
              className="w-full bg-emerald-900/60 border border-emerald-700 text-emerald-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Sound Volume Slider */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-emerald-200 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Sound Volume</span>
            </span>
            <span className="text-emerald-400 font-mono">{Math.round(localSettings.soundVolume * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={localSettings.soundVolume}
            onChange={(e) => setLocalSettings({ ...localSettings, soundVolume: parseFloat(e.target.value) })}
            className="w-full accent-emerald-400 bg-emerald-900 h-2 rounded-lg cursor-pointer"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-4 pt-2">
          {/* Quiet Mode */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-900/40 border border-emerald-800">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-emerald-100 flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-amber-400" />
                <span>Quiet Focus Mode (Hide Chat Speech Bubbles)</span>
              </div>
              <p className="text-[11px] text-emerald-300/80">
                Suppresses incoming chat speech bubbles floating on the pond canvas.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.quietMode}
              onChange={(e) => setLocalSettings({ ...localSettings, quietMode: e.target.checked })}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* Strict Mode Presence Checks */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-900/40 border border-emerald-800">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-emerald-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Strict Mode (Firefly Presence Checks)</span>
              </div>
              <p className="text-[11px] text-emerald-300/80">
                Occasionally drifts a golden firefly across the canvas to verify active desk presence.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.strictMode}
              onChange={(e) => setLocalSettings({ ...localSettings, strictMode: e.target.checked })}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* Dev Switch: Show Tile Numbers on Canvas Grid */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/80">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-amber-200 flex items-center gap-2">
                <Hash className="w-4 h-4 text-amber-400" />
                <span>Developer Switch (Show Tile Coordinates & Numbers)</span>
              </div>
              <p className="text-[11px] text-amber-300/80">
                Displays tile numbers, row/col coordinates [r,c], and tile characters directly in the middle of each map tile to easily identify which tile to update.
              </p>
            </div>
            <input
              type="checkbox"
              checked={!!localSettings.devMode}
              onChange={(e) => setLocalSettings({ ...localSettings, devMode: e.target.checked })}
              className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Save Submit */}
        <div className="pt-4 flex items-center justify-between">
          {savedNotice ? (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-fade-in">
              <span>✓ Settings saved successfully!</span>
            </span>
          ) : (
            <span></span>
          )}

          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};
