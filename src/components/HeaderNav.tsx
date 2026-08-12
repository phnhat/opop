import React from 'react';
import { UserProfile } from '../types';
import { getMoltStage } from '../data/species';
import { TOAD_SPECIES_DATA } from '../data/species';
import { Sparkles, Flame, Clock, Bug, Volume2, VolumeX } from 'lucide-react';

interface HeaderNavProps {
  profile: UserProfile;
  currentTab: 'room' | 'personal' | 'species' | 'progression' | 'settings';
  connectedCount: number;
  soundEnabled: boolean;
  onTabChange: (tab: 'room' | 'personal' | 'species' | 'progression' | 'settings') => void;
  onToggleSound: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  profile,
  currentTab,
  connectedCount,
  soundEnabled,
  onTabChange,
  onToggleSound,
}) => {
  const totalHours = profile.totalFocusMinutes / 60;
  const molt = getMoltStage(totalHours);
  const species = TOAD_SPECIES_DATA[profile.toadSpecies] || TOAD_SPECIES_DATA['common'];

  return (
    <header className="w-full bg-black/20 border-b border-white/10 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('room')}>
          <div className="bg-emerald-800 border-2 border-emerald-400 p-2.5 rounded-2xl flex flex-col items-center justify-center shadow-lg">
            <span className="text-[9px] uppercase tracking-widest font-black text-emerald-300">Room</span>
            <span className="font-mono text-base font-bold text-white">MISTY POND</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wider text-white font-mono">POND</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                Focus Swarm
              </span>
            </div>
            <p className="text-xs text-emerald-300/80">Stillness yields flies & evolution</p>
          </div>
        </div>

        {/* User Quick Stats Bar */}
        <div className="flex items-center gap-3 text-xs bg-white/10 px-4 py-2 rounded-2xl border border-white/20 shadow-lg backdrop-blur-md text-white font-mono">
          <div className="flex items-center gap-1.5 text-amber-300" title="Daily Focus Streak">
            <Flame className="w-4 h-4 fill-amber-400" />
            <span className="font-bold">{profile.streakDays}d Streak</span>
          </div>

          <div className="h-4 w-px bg-white/20"></div>

          <div className="flex items-center gap-1.5 text-emerald-300" title="Total Focus Hours">
            <Clock className="w-4 h-4" />
            <span>{totalHours.toFixed(1)}h</span>
          </div>

          <div className="h-4 w-px bg-white/20"></div>

          <div className="flex items-center gap-1.5 text-teal-300" title="Flies & Bugs Eaten">
            <Bug className="w-4 h-4" />
            <span>{profile.bugsEaten} Bugs</span>
          </div>

          <div className="h-4 w-px bg-white/20"></div>

          {/* Current Molt Badge */}
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${molt.badgeColor}`}>
            {molt.label}
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-white/5 p-1.5 rounded-2xl border border-white/20 backdrop-blur-md shadow-inner">
          <button
            onClick={() => onTabChange('room')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
              currentTab === 'room'
                ? 'bg-emerald-500 text-emerald-950 shadow-lg'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>Shared Pond</span>
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
          </button>

          <button
            onClick={() => onTabChange('personal')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
              currentTab === 'personal'
                ? 'bg-emerald-500 text-emerald-950 shadow-lg'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            My Pond
          </button>

          <button
            onClick={() => onTabChange('species')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
              currentTab === 'species'
                ? 'bg-emerald-500 text-emerald-950 shadow-lg'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>Species</span>
            <span className="text-[10px] text-amber-300">({species.name})</span>
          </button>

          <button
            onClick={() => onTabChange('progression')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
              currentTab === 'progression'
                ? 'bg-emerald-500 text-emerald-950 shadow-lg'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Unlocks</span>
          </button>

          <button
            onClick={() => onTabChange('settings')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
              currentTab === 'settings'
                ? 'bg-emerald-500 text-emerald-950 shadow-lg'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            Settings
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title="Toggle Ambient Sounds"
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>
        </nav>
      </div>
    </header>
  );
};
