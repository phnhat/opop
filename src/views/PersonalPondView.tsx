import React, { useState } from 'react';
import { UserProfile, PondDecoration } from '../types';
import { getMoltStage } from '../data/species';
import { Sun, Moon, Sparkles, Flame, Clock, Bug, ShieldCheck, Lock } from 'lucide-react';

interface PersonalPondViewProps {
  profile: UserProfile;
  onUpdateDecorations?: (decorations: PondDecoration[]) => void;
}

export const PersonalPondView: React.FC<PersonalPondViewProps> = ({ profile }) => {
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'dusk' | 'night'>('night');
  const totalHours = profile.totalFocusMinutes / 60;
  const molt = getMoltStage(totalHours);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner & Atmosphere Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-emerald-950/80 p-5 rounded-2xl border border-emerald-800 shadow-xl">
        <div>
          <h2 className="text-2xl font-bold font-mono text-emerald-100 flex items-center gap-2">
            <span>MY PRIVATE POND</span>
            <span className="text-xs font-sans px-2.5 py-0.5 rounded-full bg-emerald-900 border border-emerald-700 text-emerald-300">
              Personal Sanctuary
            </span>
          </h2>
          <p className="text-xs text-emerald-300/80 mt-1">
            An evolving, tranquil habitat reflecting your total focus time and milestones.
          </p>
        </div>

        {/* Time of Day Switcher */}
        <div className="flex bg-emerald-900/60 p-1 rounded-xl border border-emerald-800">
          <button
            onClick={() => setTimeOfDay('day')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              timeOfDay === 'day' ? 'bg-amber-500 text-amber-950 shadow' : 'text-emerald-400 hover:text-emerald-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Day</span>
          </button>
          <button
            onClick={() => setTimeOfDay('dusk')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              timeOfDay === 'dusk' ? 'bg-orange-600 text-white shadow' : 'text-emerald-400 hover:text-emerald-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Dusk</span>
          </button>
          <button
            onClick={() => setTimeOfDay('night')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              timeOfDay === 'night' ? 'bg-indigo-600 text-white shadow' : 'text-emerald-400 hover:text-emerald-200'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Night</span>
          </button>
        </div>
      </div>

      {/* Visual Canvas Stage of Personal Pond */}
      <div
        className={`relative w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-emerald-800/80 shadow-2xl p-6 transition-all duration-700 ${
          timeOfDay === 'day'
            ? 'bg-gradient-to-b from-teal-800 via-emerald-800 to-emerald-950'
            : timeOfDay === 'dusk'
            ? 'bg-gradient-to-b from-indigo-900 via-purple-950 to-emerald-950'
            : 'bg-gradient-to-b from-slate-950 via-indigo-950 to-emerald-950'
        }`}
      >
        {/* Floating Ambient Sparks or Fireflies */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/3 w-3 h-3 rounded-full bg-amber-300 blur-sm animate-ping"></div>
          <div className="absolute top-1/2 left-2/3 w-4 h-4 rounded-full bg-teal-300 blur-md animate-pulse"></div>
          <div className="absolute top-3/4 left-1/4 w-2 h-2 rounded-full bg-emerald-300 blur-xs animate-ping"></div>
        </div>

        {/* Center Toad Resting Pad */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative group cursor-pointer">
            {/* Soft Pad Shadow */}
            <div className="w-48 h-24 bg-black/40 rounded-[100%] blur-md"></div>
            {/* Center Lily Pad */}
            <div className="w-44 h-20 bg-emerald-700 border-2 border-emerald-500 rounded-[100%] flex items-center justify-center -mt-20 shadow-inner">
              {/* Toad Emoji Avatar */}
              <div className="text-6xl -mt-6 animate-bounce" style={{ animationDuration: '3s' }}>
                🐸
              </div>
            </div>
            {/* Ripple Circles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 border border-emerald-400/20 rounded-[100%] animate-ping pointer-events-none"></div>
          </div>

          <div className="mt-4 px-4 py-1.5 bg-black/60 backdrop-blur rounded-full border border-emerald-700/60 text-emerald-200 text-xs font-mono font-bold">
            {profile.displayName}'s Personal Sanctuary
          </div>
        </div>

        {/* Positioned Unlocked Decorations */}
        {profile.decorations.map((dec) => {
          if (!dec.unlocked) return null;
          return (
            <div
              key={dec.id}
              style={{ left: `${dec.x}%`, top: `${dec.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-3xl sm:text-4xl drop-shadow-lg hover:scale-125 transition-transform cursor-pointer"
              title={dec.name}
            >
              {dec.icon}
            </div>
          );
        })}
      </div>

      {/* Stats Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-950/80 p-4 rounded-2xl border border-emerald-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-900/60 text-amber-300 border border-amber-700">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-emerald-400 font-medium">Daily Streak</div>
            <div className="text-xl font-bold font-mono text-emerald-100">{profile.streakDays} Days</div>
          </div>
        </div>

        <div className="bg-emerald-950/80 p-4 rounded-2xl border border-emerald-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-900/60 text-emerald-300 border border-emerald-700">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-emerald-400 font-medium">Total Focus</div>
            <div className="text-xl font-bold font-mono text-emerald-100">{totalHours.toFixed(1)} Hours</div>
          </div>
        </div>

        <div className="bg-emerald-950/80 p-4 rounded-2xl border border-emerald-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-900/60 text-teal-300 border border-teal-700">
            <Bug className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-emerald-400 font-medium">Flies Eaten</div>
            <div className="text-xl font-bold font-mono text-emerald-100">{profile.bugsEaten} Bugs</div>
          </div>
        </div>

        <div className="bg-emerald-950/80 p-4 rounded-2xl border border-emerald-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-900/60 text-indigo-300 border border-indigo-700">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-emerald-400 font-medium">Current Lifecycle</div>
            <div className="text-xl font-bold font-mono text-emerald-100">{molt.label}</div>
          </div>
        </div>
      </div>

      {/* Decorations Unlock Gallery */}
      <div className="bg-emerald-950/80 p-5 rounded-2xl border border-emerald-800 space-y-4">
        <h3 className="text-lg font-bold text-emerald-100 font-mono">POND DECORATIONS GALLERY</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {profile.decorations.map((dec) => (
            <div
              key={dec.id}
              className={`p-3 rounded-xl border flex flex-col items-center text-center justify-between ${
                dec.unlocked
                  ? 'bg-emerald-900/50 border-emerald-700 text-emerald-100'
                  : 'bg-emerald-950/40 border-emerald-900 text-emerald-600 opacity-60'
              }`}
            >
              <div className="text-3xl my-1">{dec.icon}</div>
              <div className="text-xs font-bold">{dec.name}</div>
              <div className="text-[10px] mt-1 text-emerald-400">
                {dec.unlocked ? (
                  <span className="text-emerald-400 font-semibold">Unlocked</span>
                ) : (
                  <span className="text-amber-400 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" />
                    {dec.requiredHours}h Focus
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
