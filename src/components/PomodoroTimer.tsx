import React from 'react';
import { Play, Pause, RotateCcw, Bug, Flame } from 'lucide-react';

interface PomodoroTimerProps {
  timeLeft: number; // in seconds
  totalTime: number; // in seconds
  isRunning: boolean;
  mode: 'focus' | 'break';
  isStill: boolean;
  swarmActive: boolean;
  swarmMultiplier: number;
  sessionXp: number;
  onTogglePlay: () => void;
  onReset: () => void;
  onSwitchMode: (mode: 'focus' | 'break') => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  timeLeft,
  totalTime,
  isRunning,
  mode,
  isStill,
  swarmActive,
  swarmMultiplier,
  sessionXp,
  onTogglePlay,
  onReset,
  onSwitchMode,
}) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formatTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const progressPercent = Math.min(100, Math.max(0, ((totalTime - timeLeft) / totalTime) * 100));

  return (
    <div className="bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col justify-between text-white">
      {/* Mode Switcher & Stillness Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-black/20 p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => onSwitchMode('focus')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
              mode === 'focus' ? 'bg-emerald-500 text-emerald-950 shadow-md' : 'text-white/70 hover:text-white'
            }`}
          >
            Focus
          </button>
          <button
            onClick={() => onSwitchMode('break')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
              mode === 'break' ? 'bg-teal-500 text-teal-950 shadow-md' : 'text-white/70 hover:text-white'
            }`}
          >
            Break
          </button>
        </div>

        {/* Stillness Status Pill */}
        {isStill ? (
          <div className="px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-400/50 text-emerald-300 text-xs font-black flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
            <span>STILL (XP x1.5)</span>
          </div>
        ) : (
          <div className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-300 text-xs font-black flex items-center gap-1.5 shadow-sm animate-bounce">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>MOVING (PAUSED)</span>
          </div>
        )}
      </div>

      {/* Timer Main Digital Display */}
      <div className="bg-black/20 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-2xl text-center my-2 flex flex-col items-center">
        <span className="text-[10px] uppercase tracking-[0.3em] font-black text-emerald-300 mb-1">
          {mode === 'focus' ? 'Focus Timer' : 'Break Timer'}
        </span>
        <div className="text-5xl sm:text-6xl font-black font-mono tracking-tighter text-white drop-shadow-xl">
          {formatTime}
        </div>
      </div>

      {/* Progress & Bug Meter */}
      <div className="my-3 space-y-1.5">
        <div className="flex justify-between items-center text-xs font-bold text-emerald-200">
          <span className="flex items-center gap-1 font-mono">
            <Bug className="w-4 h-4 text-amber-400" />
            <span>Bug XP: {sessionXp}</span>
          </span>
          {swarmActive && (
            <span className="text-orange-400 font-black flex items-center gap-1 text-[11px] uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 fill-orange-400" />
              <span>{swarmMultiplier}x Swarm</span>
            </span>
          )}
        </div>

        {/* Outer Bar */}
        <div className="w-full h-5 bg-emerald-950/80 rounded-full p-1 border border-emerald-700/80 shadow-inner overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 rounded-full transition-all duration-300 relative shadow-md"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-2">
        <button
          onClick={onReset}
          title="Reset Timer"
          className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/20 shadow-lg active:translate-y-0.5"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onTogglePlay}
          className={`px-8 py-3 rounded-2xl font-black text-xs tracking-wider uppercase flex items-center gap-2 shadow-xl transition-all border-b-4 active:translate-y-0.5 ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 border-amber-700'
              : 'bg-orange-500 hover:bg-orange-400 text-white border-orange-700'
          }`}
        >
          {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isRunning ? 'PAUSE FOCUS' : 'START FOCUS'}</span>
        </button>
      </div>
    </div>
  );
};
