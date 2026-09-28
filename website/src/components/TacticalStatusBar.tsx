import React, { useState, useEffect } from 'react';
import { SensorNode, RobotState } from '../types';
import { MqttStatus } from '../utils/mqttService';
import { 
  Users, 
  Wifi, 
  Radio, 
  Wind, 
  ShieldCheck, 
  AlertTriangle, 
  Bot, 
  Clock, 
  Cpu,
  Camera
} from 'lucide-react';

interface TacticalStatusBarProps {
  nodes: SensorNode[];
  robot: RobotState;
  packetRate: number;
  isEmergencyActive: boolean;
  mqttStatus?: MqttStatus;
  laptopCamStreaming?: boolean;
  onOpenCamModal?: () => void;
}

export const TacticalStatusBar: React.FC<TacticalStatusBarProps> = ({
  nodes,
  robot,
  packetRate,
  isEmergencyActive,
  mqttStatus,
  laptopCamStreaming,
  onOpenCamModal
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [utcStr, setUtcStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }));
      setUtcStr(now.toISOString().slice(11, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const onlineNodes = nodes.filter(n => n.status !== 'offline').length;
  const criticalCount = nodes.filter(n => n.status === 'critical').length;
  const warningCount = nodes.filter(n => n.status === 'warning').length;
  const maxGasNode = [...nodes].sort((a, b) => b.gas - a.gas)[0];

  const overallStatus = isEmergencyActive
    ? { text: 'MUSTER EVACUATION', color: 'text-rose-400 bg-rose-950/60 border-rose-500/50', dot: 'bg-rose-500 animate-ping' }
    : criticalCount > 0
    ? { text: 'CRITICAL HAZARD', color: 'text-rose-400 bg-rose-950/60 border-rose-500/50', dot: 'bg-rose-500 animate-pulse' }
    : warningCount > 0
    ? { text: 'CAUTION ELEVATED', color: 'text-amber-400 bg-amber-950/60 border-amber-500/50', dot: 'bg-amber-400' }
    : { text: 'ATMOSPHERE NOMINAL', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40', dot: 'bg-emerald-400' };

  return (
    <div className="bg-[#090e14] border-b border-[#182330] px-4 lg:px-6 py-1.5 text-xs font-mono">
      <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
        {/* Left: Overall Status & Atmospheric Vital */}
        <div className="flex items-center gap-3 shrink-0">
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[11px] font-bold tracking-wider ${overallStatus.color}`}>
            <span className={`w-2 h-2 rounded-full ${overallStatus.dot}`} />
            <span>{overallStatus.text}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">CREW UNDERGROUND:</span>
            <span className="font-semibold text-slate-200">24 / 24 TAGGED</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-slate-300">
            <Wind className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">PEAK CH₄:</span>
            <span className={`font-semibold ${maxGasNode.gas > 150 ? 'text-amber-400' : 'text-slate-200'}`}>
              {maxGasNode.gas} ppm
            </span>
            <span className="text-[10px] text-slate-400">({maxGasNode.zone.split('·')[0]})</span>
          </div>
        </div>

        {/* Center: Rover Telemetry Snapshot */}
        <div className="hidden lg:flex items-center gap-4 text-slate-300 shrink-0">
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">ROVER:</span>
            <span className="text-cyan-300 font-medium">BOT-01</span>
            <span className="text-slate-400">({robot.depthMeters}m depth)</span>
            <span className="text-[10px] px-1 py-0.2 bg-slate-800 rounded text-slate-300">
              {robot.battery}% BAT
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">NODES:</span>
            <span className="text-slate-200 font-medium">
              {onlineNodes}/{nodes.length} ONLINE
            </span>
          </div>

          <div className="flex items-center gap-1.5" title={`HiveMQ Broker: ${mqttStatus?.brokerUrl || 'wss://broker.hivemq.com:8884/mqtt'}`}>
            <Radio className={`w-3.5 h-3.5 ${mqttStatus?.connected ? 'text-emerald-400 animate-pulse' : mqttStatus?.connecting ? 'text-cyan-400 animate-spin' : 'text-slate-500'}`} />
            <span className="text-slate-400">MQTT:</span>
            <span className={`font-semibold ${mqttStatus?.connected ? 'text-emerald-400' : mqttStatus?.connecting ? 'text-cyan-300' : 'text-slate-400'}`}>
              {mqttStatus?.connected ? 'HIVEMQ LIVE' : mqttStatus?.connecting ? 'CONNECTING...' : 'OFFLINE'}
            </span>
            <span className="text-[10px] text-slate-500">({packetRate} pkt/s)</span>
          </div>

          {/* Connected Laptop Camera Indicator */}
          <button 
            onClick={onOpenCamModal}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
              laptopCamStreaming 
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                : 'text-slate-400 hover:text-cyan-300 border-slate-800 bg-slate-900/60'
            }`}
            title="Laptop Camera Streaming Status (Click to configure)"
          >
            <Camera className={`w-3.5 h-3.5 ${laptopCamStreaming ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <span>CAM:</span>
            <span className={`font-semibold ${laptopCamStreaming ? 'text-emerald-300' : 'text-slate-300'}`}>
              {laptopCamStreaming ? 'LIVE LAPTOP FEED' : 'OPTICS STANDBY'}
            </span>
          </button>
        </div>

        {/* Right: Clock & Sync */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-100">{timeStr}</span>
            <span className="hidden xl:inline text-[10px] text-slate-400">{utcStr}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">LIVE SYNC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
