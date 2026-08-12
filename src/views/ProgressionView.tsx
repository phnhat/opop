import React from 'react';
import { UserProfile } from '../types';
import { getMoltStage } from '../data/species';
import { Sparkles, Trophy, Award, Bug, Check, ArrowRight } from 'lucide-react';

interface ProgressionViewProps {
  profile: UserProfile;
}

export const ProgressionView: React.FC<ProgressionViewProps> = ({ profile }) => {
  const totalHours = profile.totalFocusMinutes / 60;
  const currentMolt = getMoltStage(totalHours);

  const STAGES = [
    {
      stage: 'tadpole',
      name: 'Tadpole',
      minHours: 0,
      maxHours: 5,
      icon: '🫧',
      desc: 'Fresh swimmer in the lily pond. Swims around gaining base focus stamina.',
    },
    {
      stage: 'froglet',
      name: 'Froglet',
      minHours: 5,
      maxHours: 20,
      icon: '🐸',
      desc: 'Developing back legs! Learns species-specific passive traits.',
    },
    {
      stage: 'adult',
      name: 'Adult Toad',
      minHours: 20,
      maxHours: 75,
      icon: '🐸',
      desc: 'Full-grown focus master. Earning high XP and unlocked decorative pond items.',
    },
    {
      stage: 'elder',
      name: 'Elder Toad',
      minHours: 75,
      maxHours: 999,
      icon: '👑',
      desc: 'Celestial pond guardian. Possesses glowing aura and prestige golden radiance.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black tracking-tight text-emerald-100 font-mono">MOLT & EVOLUTION GALLERY</h2>
        <p className="text-sm text-emerald-300/80 max-w-lg mx-auto">
          As you remain still during focus sessions, your toad molts through life stages and catches bugs.
        </p>
      </div>

      {/* Bug Meter Level Progress Card */}
      <div className="bg-emerald-950/80 p-6 rounded-2xl border border-emerald-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-900/60 rounded-xl border border-amber-700 text-amber-300">
              <Bug className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-100 font-mono">ACTIVE BUG METER</h3>
              <p className="text-xs text-emerald-300">Total Flies & Insects Consumed: {profile.bugsEaten}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-emerald-400">Total Focus Time</div>
            <div className="text-2xl font-bold font-mono text-emerald-100">{totalHours.toFixed(1)} Hours</div>
          </div>
        </div>

        {/* Big Progress Bar to Next Stage */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-emerald-300 font-semibold">
            <span>Stage: {currentMolt.label}</span>
            <span>
              {totalHours >= currentMolt.maxHours
                ? 'MAX STAGE REACHED 🎉'
                : `${(currentMolt.maxHours - totalHours).toFixed(1)}h to next evolution`}
            </span>
          </div>

          <div className="w-full h-4 bg-emerald-900 rounded-full overflow-hidden border border-emerald-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    5,
                    ((totalHours - currentMolt.minHours) / (currentMolt.maxHours - currentMolt.minHours)) * 100
                  )
                )}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Molt Stages Timeline Cards */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-emerald-100 font-mono">LIFECYCLE STAGES</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STAGES.map((s) => {
            const isCompleted = totalHours >= s.maxHours;
            const isCurrent = totalHours >= s.minHours && totalHours < s.maxHours;

            return (
              <div
                key={s.stage}
                className={`p-5 rounded-2xl border transition-all flex gap-4 ${
                  isCurrent
                    ? 'bg-emerald-900/80 border-emerald-400 ring-2 ring-emerald-400 shadow-xl'
                    : isCompleted
                    ? 'bg-emerald-950/60 border-emerald-800'
                    : 'bg-emerald-950/20 border-emerald-900/60 opacity-50'
                }`}
              >
                <div className="text-4xl p-3 bg-emerald-900/60 rounded-xl border border-emerald-800 h-fit">
                  {s.icon}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-emerald-100 font-mono">{s.name}</h4>
                    {isCurrent && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-emerald-950 text-[10px] font-bold">
                        CURRENT
                      </span>
                    )}
                    {isCompleted && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-300 text-[10px] flex items-center gap-1">
                        <Check className="w-3 h-3" /> Done
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-amber-300 font-semibold font-mono">
                    {s.minHours}h - {s.maxHours === 999 ? '∞' : `${s.maxHours}h`} Required
                  </p>

                  <p className="text-xs text-emerald-200/80 leading-relaxed pt-1">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
