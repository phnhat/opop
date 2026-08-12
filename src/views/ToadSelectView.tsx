import React from 'react';
import { ToadSpecies, UserProfile } from '../types';
import { TOAD_SPECIES_DATA } from '../data/species';
import { Check, Lock, Zap, Award, Sparkles } from 'lucide-react';

interface ToadSelectViewProps {
  profile: UserProfile;
  onSelectSpecies: (species: ToadSpecies) => void;
}

export const ToadSelectView: React.FC<ToadSelectViewProps> = ({ profile, onSelectSpecies }) => {
  const totalHours = profile.totalFocusMinutes / 60;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black tracking-tight text-emerald-100 font-mono">CHOOSE YOUR SPECIES</h2>
        <p className="text-sm text-emerald-300/80 max-w-xl mx-auto">
          Each species offers a unique passive focus trait tailored to your study or work style.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(TOAD_SPECIES_DATA).map((species) => {
          const isSelected = profile.toadSpecies === species.id;
          const isUnlocked = profile.unlockedSpecies.includes(species.id) || totalHours >= species.requiredHours;

          return (
            <div
              key={species.id}
              className={`relative rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-emerald-900/90 border-emerald-400 ring-2 ring-emerald-400 shadow-2xl scale-[1.02]'
                  : isUnlocked
                  ? 'bg-emerald-950/70 border-emerald-800 hover:border-emerald-600 hover:bg-emerald-900/40'
                  : 'bg-emerald-950/30 border-emerald-900/60 opacity-60'
              }`}
            >
              <div>
                {/* Visual Header Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl p-2 rounded-xl bg-emerald-900/80 border border-emerald-700">
                    {species.id === 'common'
                      ? '🐸'
                      : species.id === 'bullfrog'
                      ? '🐸'
                      : species.id === 'poison_dart'
                      ? '🫐'
                      : species.id === 'horned'
                      ? '🌵'
                      : '👑'}
                  </span>

                  {isSelected && (
                    <span className="px-3 py-1 bg-emerald-500 text-emerald-950 font-bold text-xs rounded-full flex items-center gap-1 shadow">
                      <Check className="w-3.5 h-3.5" />
                      <span>SELECTED</span>
                    </span>
                  )}

                  {!isUnlocked && (
                    <span className="px-3 py-1 bg-amber-950 border border-amber-700 text-amber-300 font-bold text-xs rounded-full flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{species.requiredHours}h Needed</span>
                    </span>
                  )}
                </div>

                {/* Name & Passive Name */}
                <h3 className="text-xl font-bold text-emerald-100 font-mono">{species.name}</h3>
                <p className="text-xs font-semibold text-amber-300 mt-0.5 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>{species.passiveName}</span>
                </p>

                {/* Description */}
                <p className="text-xs text-emerald-200/80 mt-3 leading-relaxed">{species.description}</p>

                {/* Visual Feature Note */}
                <div className="mt-4 p-2.5 rounded-xl bg-emerald-900/50 border border-emerald-800/80 text-[11px] text-emerald-300 space-y-1">
                  <div className="font-semibold text-emerald-200">Aesthetic Spec:</div>
                  <div>{species.visualFeature}</div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6">
                {isSelected ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl bg-emerald-800/50 text-emerald-300 font-bold text-xs border border-emerald-700"
                  >
                    Active Companion
                  </button>
                ) : isUnlocked ? (
                  <button
                    onClick={() => onSelectSpecies(species.id)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Select {species.name}</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl bg-emerald-950 text-emerald-600 font-bold text-xs border border-emerald-900 flex items-center justify-center gap-1"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Focus {species.requiredHours - totalHours > 0 ? (species.requiredHours - totalHours).toFixed(1) : 0}h More to Unlock</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
