import React from 'react';
import { ActiveTab } from '../types';
import { 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  SlidersHorizontal, 
  Flame, 
  RotateCcw,
  Layers,
  Cpu,
  Radio,
  BarChart3,
  Bot,
  Radar,
  Camera,
  ScrollText,
  LayoutDashboard,
  Sparkles
} from 'lucide-react';
import { sound } from '../utils/audio';

interface TopNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  unacknowledgedAlertsCount: number;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  onOpenSimulation: () => void;
  isEmergencyActive: boolean;
  onToggleEmergency: () => void;
  onResetData: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  unacknowledgedAlertsCount,
  soundEnabled,
  setSoundEnabled,
  onOpenSimulation,
  isEmergencyActive,
  onToggleEmergency,
  onResetData
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'map', label: 'Mine Map', icon: <Layers className="w-4 h-4" /> },
    { id: 'nodes', label: 'Sensors', icon: <Cpu className="w-4 h-4" /> },
    { id: 'robot', label: 'Rover BOT-01', icon: <Bot className="w-4 h-4" /> },
    { id: 'lidar', label: '3D LiDAR', icon: <Radar className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { 
      id: 'alerts', 
      label: 'Alerts', 
      icon: <ShieldAlert className="w-4 h-4" />, 
      badge: unacknowledgedAlertsCount 
    },
    { id: 'ai-assistant', label: 'AI Advisor & Voice', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
    { id: 'architecture', label: 'Architecture', icon: <Radio className="w-4 h-4" /> },
    { id: 'logs', label: 'Event Logs', icon: <ScrollText className="w-4 h-4" /> },
  ];

  const handleTabClick = (tab: ActiveTab) => {
    sound.playClick();
    setActiveTab(tab);
  };

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    sound.enabled = next;
    setSoundEnabled(next);
    if (next) sound.playClick();
  };

  return (
    <header className="sticky top-0 z-40 bg-[#090e15]/95 backdrop-blur-md border-b border-[#1b2633] px-4 lg:px-6 py-2.5 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* Zone 1: Single element brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded border border-cyan-500/40 bg-cyan-950/40 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm tracking-wider shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            ⛏
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-base tracking-wide text-slate-100 flex items-center gap-2">
              MINE COMMAND
              <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
                LEVEL 4 AUTONOMY
              </span>
            </span>
            <span className="text-[10px] font-mono text-slate-400 tracking-wider">
              SUBTERRANEAN SAFETY &amp; ROBOTICS
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Clean single-line with indicators) */}
        <nav className="hidden xl:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions & Emergency Protocol */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Sound Toggle */}
          <button
            onClick={handleSoundToggle}
            title={soundEnabled ? 'Mute Audio Alerts' : 'Unmute Audio Alerts'}
            className="p-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 rounded transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Simulation Injector */}
          <button
            onClick={onOpenSimulation}
            className="px-2.5 py-1.5 text-xs font-mono font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded transition-colors flex items-center gap-1.5"
            title="Inject simulated conditions (gas spike, rockfall, rover fault)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Scenario Sim</span>
          </button>

          {/* Reset Baseline */}
          <button
            onClick={onResetData}
            title="Reset telemetry to nominal baseline"
            className="p-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Emergency Evacuation Strobe Button */}
          <button
            onClick={onToggleEmergency}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded flex items-center gap-1.5 transition-all shadow-sm ${
              isEmergencyActive
                ? 'bg-rose-600 text-white animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.6)] border border-rose-400'
                : 'bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/60'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{isEmergencyActive ? 'EVAC ACTIVE' : 'MUSTER CALL'}</span>
          </button>
        </div>
      </div>

      {/* Sub-bar for mobile/tablet screen navigation */}
      <div className="flex xl:hidden overflow-x-auto gap-1 pt-2 pb-0.5 border-t border-[#17222e] mt-2 no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'text-cyan-300 bg-cyan-950/80 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-1 text-[9px] font-mono bg-rose-500/20 text-rose-400 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
