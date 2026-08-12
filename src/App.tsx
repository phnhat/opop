import React, { useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { PlayerState, RoomState, ChatMessage, UserProfile, UserSettings, ToadSpecies } from './types';
import { UserService } from './services/userService';
import { socketService } from './services/socketService';
import { audioService } from './services/audioService';
import { TOAD_SPECIES_DATA, getMoltStage } from './data/species';

import { HeaderNav } from './components/HeaderNav';
import { IslandPondCanvas } from './components/IslandPondCanvas';
import { PomodoroTimer } from './components/PomodoroTimer';
import { ChatInputBar } from './components/ChatInputBar';

import { ToadSelectView } from './views/ToadSelectView';
import { PersonalPondView } from './views/PersonalPondView';
import { ProgressionView } from './views/ProgressionView';
import { SettingsView } from './views/SettingsView';

import { Users, Copy, Check, Sparkles, RefreshCw } from 'lucide-react';

export default function App() {
  // Navigation tab state
  const [currentTab, setCurrentTab] = useState<'room' | 'personal' | 'species' | 'progression' | 'settings'>('room');

  // User profile & settings
  const [profile, setProfile] = useState<UserProfile>(() => UserService.getProfile());
  const [settings, setSettings] = useState<UserSettings>(() => UserService.getSettings());
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Room & WebSocket state
  const [roomId, setRoomId] = useState('main-pond');
  const [roomOccupants, setRoomOccupants] = useState<PlayerState[]>([]);
  const [swarmActive, setSwarmActive] = useState(false);
  const [swarmMultiplier, setSwarmMultiplier] = useState(1.0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [latestChatMessage, setLatestChatMessage] = useState<ChatMessage | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Timer & Focus state
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings.focusDuration * 60);
  const [isStill, setIsStill] = useState(true);
  const [sessionXp, setSessionXp] = useState(0);

  // Sync timer when settings change
  useEffect(() => {
    if (!isTimerRunning) {
      setTimeLeft(timerMode === 'focus' ? settings.focusDuration * 60 : settings.breakDuration * 60);
    }
  }, [settings.focusDuration, settings.breakDuration, timerMode, isTimerRunning]);

  // Connect to Socket & Handle Events
  useEffect(() => {
    socketService.connect();

    // Create current player object for room join
    const totalHours = profile.totalFocusMinutes / 60;
    const molt = getMoltStage(totalHours);

    const localPlayer: PlayerState = {
      playerId: profile.playerId,
      displayName: profile.displayName,
      toadSpecies: profile.toadSpecies,
      moltStage: molt.stage,
      isStill: true,
      padIndex: 0,
      position: { x: 200, y: 310 },
      focusMinutes: profile.totalFocusMinutes,
      xp: profile.xp,
      streakDays: profile.streakDays,
    };

    socketService.joinRoom(roomId, localPlayer);

    const unsubRoomSync = socketService.on('room_state_sync', (data) => {
      if (data.roomOccupants) {
        setRoomOccupants(data.roomOccupants);
      }
      setSwarmActive(!!data.swarmActive);
      setSwarmMultiplier(data.swarmMultiplier || 1.0);
    });

    const unsubChat = socketService.on('chat_broadcast', (data: ChatMessage) => {
      setLatestChatMessage(data);
      setChatHistory((prev) => [...prev, data]);
    });

    return () => {
      unsubRoomSync();
      unsubChat();
    };
  }, [roomId, profile.playerId]);

  // Pomodoro Timer Interval Tick
  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer Finish Event
          clearInterval(interval);
          setIsTimerRunning(false);
          audioService.playChime();
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

          if (timerMode === 'focus') {
            const minutesEarned = settings.focusDuration;
            const xpGained = sessionXp + 50;
            const updated = UserService.addFocusTime(minutesEarned, xpGained);
            setProfile(updated);
            alert(`🎉 Focus Session Complete! Earned ${xpGained} XP & ate flies!`);
          }

          return 0;
        }

        // Increment Session XP every second IF toad is STILL
        if (isStill && timerMode === 'focus') {
          const speciesTrait = TOAD_SPECIES_DATA[profile.toadSpecies] || TOAD_SPECIES_DATA['common'];
          const baseGain = 1 * speciesTrait.baseXpMultiplier;
          const totalGain = baseGain * swarmMultiplier;
          setSessionXp((x) => x + Math.round(totalGain));
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, isStill, timerMode, profile.toadSpecies, swarmMultiplier, sessionXp, settings.focusDuration]);

  // Handle Stillness State Change (Triggered when user drags or releases toad sprite)
  const handleStillnessChange = useCallback(
    (newIsStill: boolean, pos?: { x: number; y: number }) => {
      setIsStill(newIsStill);
      socketService.updateStillState(newIsStill, pos);
    },
    []
  );

  // Send chat message
  const handleSendMessage = (text: string) => {
    socketService.sendChat(text, profile.displayName);
  };

  // Toggle ambient sound
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioService.toggleAmbient(next, settings.soundVolume);
  };

  // Switch species
  const handleSelectSpecies = (species: ToadSpecies) => {
    const updated = { ...profile, toadSpecies: species };
    setProfile(updated);
    UserService.saveProfile(updated);
    audioService.playCroak(1.1);

    // Update socket player species
    socketService.joinRoom(roomId, {
      playerId: updated.playerId,
      displayName: updated.displayName,
      toadSpecies: species,
      moltStage: getMoltStage(updated.totalFocusMinutes / 60).stage,
      isStill: true,
      padIndex: 0,
      position: { x: 200, y: 310 },
      focusMinutes: updated.totalFocusMinutes,
      xp: updated.xp,
      streakDays: updated.streakDays,
    });

    setCurrentTab('room');
  };

  // Copy Room Code / Share Link
  const handleCopyRoomCode = () => {
    const shareUrl = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Timer Control Callbacks
  const handleTogglePlayTimer = () => {
    setIsTimerRunning(!isTimerRunning);
    audioService.playCroak(1.0);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(timerMode === 'focus' ? settings.focusDuration * 60 : settings.breakDuration * 60);
    setSessionXp(0);
  };

  const handleSwitchMode = (mode: 'focus' | 'break') => {
    setTimerMode(mode);
    setIsTimerRunning(false);
    setTimeLeft(mode === 'focus' ? settings.focusDuration * 60 : settings.breakDuration * 60);
  };

  return (
    <div
      className="min-h-screen text-emerald-100 font-sans flex flex-col selection:bg-emerald-400 selection:text-emerald-950 relative overflow-x-hidden"
      style={{ background: 'radial-gradient(circle at center, #065f46 0%, #042f2e 100%)' }}
    >
      {/* Background Dot Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '36px 36px' }}
      ></div>

      {/* Top Header Navigation */}
      <HeaderNav
        profile={profile}
        currentTab={currentTab}
        connectedCount={roomOccupants.length}
        soundEnabled={soundEnabled}
        onTabChange={setCurrentTab}
        onToggleSound={handleToggleSound}
      />

      {/* Main View Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 z-10">
        {currentTab === 'room' && (
          <div className="space-y-6">
            {/* Room Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-800 border-2 border-emerald-400 text-white text-xs font-bold font-mono shadow-md">
                  <Users className="w-4 h-4 text-emerald-300" />
                  <span>Pond Room: {roomId} ({roomOccupants.length}/4 Toads)</span>
                </div>

                {swarmActive ? (
                  <div className="bg-orange-500 px-3 py-1 rounded-xl border-b-4 border-orange-700 shadow-md flex items-center gap-1.5 animate-pulse text-white font-black text-xs">
                    <span>🔥 SWARM BONUS (x{swarmMultiplier} XP)</span>
                  </div>
                ) : (
                  <span className="px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-medium">
                    Get all 4 occupants still for 1.5x Swarm Bonus!
                  </span>
                )}
              </div>

              {/* Share Room Button */}
              <button
                onClick={handleCopyRoomCode}
                className="px-4 py-2 rounded-xl bg-emerald-100 hover:bg-white text-emerald-950 text-xs font-black uppercase border-b-2 border-emerald-300 flex items-center gap-1.5 transition-all shadow-md active:translate-y-0.5"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-800" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Link Copied!' : 'Invite Friends'}</span>
              </button>
            </div>

            {/* Core Shared Pond Canvas with Local Player Fallback */}
            {(() => {
              const hasLocal = roomOccupants.some((p) => p.playerId === profile.playerId);
              const effectiveOccupants: PlayerState[] = hasLocal
                ? roomOccupants
                : [
                    {
                      playerId: profile.playerId,
                      displayName: profile.displayName,
                      toadSpecies: profile.toadSpecies,
                      moltStage: getMoltStage(profile.totalFocusMinutes / 60).stage,
                      isStill: isStill,
                      padIndex: 0,
                      position: { x: 200, y: 310 },
                      focusMinutes: profile.totalFocusMinutes,
                      xp: profile.xp,
                      streakDays: profile.streakDays,
                    },
                    ...roomOccupants,
                  ];

              return (
                <IslandPondCanvas
                  roomOccupants={effectiveOccupants}
                  localPlayerId={profile.playerId}
                  swarmActive={swarmActive}
                  swarmMultiplier={swarmMultiplier}
                  quietMode={settings.quietMode}
                  strictMode={settings.strictMode}
                  devMode={settings.devMode}
                  latestChatMessage={latestChatMessage}
                  onStillnessChange={handleStillnessChange}
                  onFireflyCatch={() => {
                    const updated = UserService.addFocusTime(0, 25);
                    setProfile(updated);
                  }}
                />
              );
            })()}

            {/* Interactive Grid: Pomodoro Timer & In-Room Speech Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Pomodoro Timer Widget */}
              <div className="lg:col-span-1">
                <PomodoroTimer
                  timeLeft={timeLeft}
                  totalTime={timerMode === 'focus' ? settings.focusDuration * 60 : settings.breakDuration * 60}
                  isRunning={isTimerRunning}
                  mode={timerMode}
                  isStill={isStill}
                  swarmActive={swarmActive}
                  swarmMultiplier={swarmMultiplier}
                  sessionXp={sessionXp}
                  onTogglePlay={handleTogglePlayTimer}
                  onReset={handleResetTimer}
                  onSwitchMode={handleSwitchMode}
                />
              </div>

              {/* Right Column: Real-time In-Room Speech Bubble Chat Bar */}
              <div className="lg:col-span-2 flex flex-col justify-between space-y-4">
                {/* Active Occupants Status Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((slotIndex) => {
                    const occupant = roomOccupants.find((p) => p.padIndex === slotIndex);

                    if (!occupant) {
                      return (
                        <div
                          key={slotIndex}
                          className="p-3.5 rounded-2xl bg-white/5 border border-dashed border-white/20 text-center flex flex-col items-center justify-center text-emerald-300/60 backdrop-blur-sm"
                        >
                          <span className="text-2xl mb-1 opacity-40">🪷</span>
                          <span className="text-[11px] font-mono font-bold">Empty Pad</span>
                        </div>
                      );
                    }

                    const isLocal = occupant.playerId === profile.playerId;
                    const spec = TOAD_SPECIES_DATA[occupant.toadSpecies] || TOAD_SPECIES_DATA['common'];

                    return (
                      <div
                        key={occupant.playerId}
                        className={`p-3.5 rounded-2xl border-2 transition-all shadow-xl backdrop-blur-md ${
                          isLocal
                            ? 'bg-emerald-800/80 border-emerald-400 text-white shadow-emerald-950/50'
                            : 'bg-white/10 border-white/20 text-emerald-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xl">🐸</span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                              occupant.isStill
                                ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/50'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-400/50'
                            }`}
                          >
                            {occupant.isStill ? 'Stillness' : 'Moving'}
                          </span>
                        </div>
                        <div className="text-xs font-black truncate">{occupant.displayName}</div>
                        <div className="text-[10px] text-emerald-300 font-mono truncate">{spec.name}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Overlay Chat Bar */}
                <ChatInputBar
                  quietMode={settings.quietMode}
                  chatHistory={chatHistory}
                  onSendMessage={handleSendMessage}
                  onToggleQuietMode={() => {
                    const nextSettings = { ...settings, quietMode: !settings.quietMode };
                    setSettings(nextSettings);
                    UserService.saveSettings(nextSettings);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === 'personal' && <PersonalPondView profile={profile} />}

        {currentTab === 'species' && <ToadSelectView profile={profile} onSelectSpecies={handleSelectSpecies} />}

        {currentTab === 'progression' && <ProgressionView profile={profile} />}

        {currentTab === 'settings' && (
          <SettingsView
            settings={settings}
            profile={profile}
            onSaveSettings={(s) => {
              setSettings(s);
              UserService.saveSettings(s);
            }}
            onSaveProfile={(p) => {
              setProfile(p);
              UserService.saveProfile(p);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-emerald-900/80 py-4 text-center text-xs text-emerald-500 font-mono">
        POND • Multiplayer Pomodoro Focus App • Built with Bloxorz Floating Island 3D Grid & WebSockets
      </footer>
    </div>
  );
}
