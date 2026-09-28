import React from 'react';
import { 
  X, 
  Flame, 
  Bot, 
  WifiOff, 
  RotateCcw, 
  Play, 
  Pause, 
  FastForward, 
  Zap,
  MountainSnow,
  CheckCircle2
} from 'lucide-react';
import { sound } from '../utils/audio';

interface SimulationControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInjectGasLeak: () => void;
  onInjectRoverFault: () => void;
  onInjectCommDrop: () => void;
  onInjectRockfall: () => void;
  onResetBaseline: () => void;
  simSpeed: number;
  setSimSpeed: (speed: number) => void;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
}

export const SimulationControlsModal: React.FC<SimulationControlsModalProps> = ({
  isOpen,
  onClose,
  onInjectGasLeak,
  onInjectRoverFault,
  onInjectCommDrop,
  onInjectRockfall,
  onResetBaseline,
  simSpeed,
  setSimSpeed,
  isPaused,
  setIsPaused
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b121b] border border-[#223142] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col text-xs font-mono">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0e1724] border-b border-[#1c2938] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="font-display font-bold text-base text-slate-100">
              SIMULATION ENGINE &amp; SCENARIO INJECTOR
            </h3>
          </div>
          <button
            onClick={() => { sound.playClick(); onClose(); }}
            className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-slate-300 font-sans text-xs leading-relaxed">
            Test and evaluate the Underground Mine Command Center response by injecting synthetic anomalies into the sensor mesh, rover systems, and atmospheric monitors.
          </p>

          {/* Time & Speed Controls */}
          <div className="bg-[#080d14] p-3 rounded-lg border border-slate-800 space-y-2">
            <div className="text-[10px] text-slate-400 font-bold">TELEMETRY CLOCK CONTROLS</div>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => { sound.playClick(); setIsPaused(!isPaused); }}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 border transition-colors ${
                  isPaused
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                }`}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? 'Resume Simulation' : 'Pause Simulation'}</span>
              </button>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded">
                {[1, 2, 5].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => { sound.playClick(); setSimSpeed(spd); }}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      simSpeed === spd
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scenarios Grid */}
          <div className="space-y-2">
            <div className="text-[10px] text-slate-400 font-bold">INJECT HAZARD SCENARIOS</div>

            {/* Scenario 1: Gas Leak */}
            <button
              onClick={() => { sound.playCritical(); onInjectGasLeak(); onClose(); }}
              className="w-full text-left p-3 rounded-lg bg-[#140c10] hover:bg-[#1f1016] border border-rose-900/60 hover:border-rose-500/60 transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded bg-rose-950/80 border border-rose-600/40 text-rose-400 group-hover:scale-105 transition-transform">
                <Flame className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-rose-300 text-xs">Methane Cavity Breach (Tunnel D)</div>
                <div className="text-slate-400 font-sans text-[11px] mt-0.5">
                  Surges Node 08 to 225 ppm CH₄ (exceeding 1.0% LEL), generating critical safety sirens and dispatch protocols.
                </div>
              </div>
            </button>

            {/* Scenario 2: Rover Obstacle */}
            <button
              onClick={() => { sound.playWarning(); onInjectRoverFault(); onClose(); }}
              className="w-full text-left p-3 rounded-lg bg-[#14100a] hover:bg-[#1f180d] border border-amber-900/60 hover:border-amber-500/60 transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded bg-amber-950/80 border border-amber-600/40 text-amber-400 group-hover:scale-105 transition-transform">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-amber-300 text-xs">Rover Obstacle / Low Battery Alert</div>
                <div className="text-slate-400 font-sans text-[11px] mt-0.5">
                  Simulates BOT-01 battery dropping to 18% with an unclassified rockfall obstacle obstructing WP-03.
                </div>
              </div>
            </button>

            {/* Scenario 3: Mesh Repeater Comm Drop */}
            <button
              onClick={() => { sound.playWarning(); onInjectCommDrop(); onClose(); }}
              className="w-full text-left p-3 rounded-lg bg-[#0e131d] hover:bg-[#131b29] border border-blue-900/60 hover:border-blue-500/60 transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded bg-blue-950/80 border border-blue-600/40 text-blue-400 group-hover:scale-105 transition-transform">
                <WifiOff className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-blue-300 text-xs">Tunnel E RF Comm Attenuation</div>
                <div className="text-slate-400 font-sans text-[11px] mt-0.5">
                  Simulates repeater power outage causing Node 09 &amp; 10 to lose LoRa mesh sync.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#0c1420] border-t border-[#1c2938] flex items-center justify-between">
          <button
            onClick={() => { sound.playSuccess(); onResetBaseline(); onClose(); }}
            className="px-3 py-1.5 rounded bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition-colors font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Restore Nominal Baseline</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
