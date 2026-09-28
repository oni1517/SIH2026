import React, { useState } from 'react';
import { SensorNode, NodeStatus } from '../types';
import { 
  Cpu, 
  Flame, 
  Thermometer, 
  Droplets, 
  BatteryCharging, 
  Wifi, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Filter,
  ArrowUpDown,
  Search,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { sound } from '../utils/audio';

interface SensorNodeGridProps {
  nodes: SensorNode[];
  onSelectNode: (node: SensorNode) => void;
  pulseNodeId?: string | null;
}

export const SensorNodeGrid: React.FC<SensorNodeGridProps> = ({
  nodes,
  onSelectNode,
  pulseNodeId
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'attention' | 'normal' | 'offline'>('all');
  const [tunnelFilter, setTunnelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'id' | 'gas' | 'temp' | 'battery'>('id');

  const filteredNodes = nodes
    .filter((n) => {
      if (statusFilter === 'attention') return n.status === 'warning' || n.status === 'critical';
      if (statusFilter === 'normal') return n.status === 'normal';
      if (statusFilter === 'offline') return n.status === 'offline';
      return true;
    })
    .filter((n) => {
      if (tunnelFilter !== 'all' && !n.tunnel.includes(tunnelFilter)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          n.id.toLowerCase().includes(query) ||
          n.name.toLowerCase().includes(query) ||
          n.zone.toLowerCase().includes(query) ||
          n.tunnel.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'gas') return b.gas - a.gas;
      if (sortBy === 'temp') return b.temp - a.temp;
      if (sortBy === 'battery') return a.battery - b.battery;
      return a.id.localeCompare(b.id);
    });

  const getStatusBadge = (status: NodeStatus) => {
    switch (status) {
      case 'critical':
        return {
          label: 'CRITICAL',
          classes: 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse',
          dot: 'bg-rose-500'
        };
      case 'warning':
        return {
          label: 'CAUTION',
          classes: 'bg-amber-950/80 text-amber-300 border-amber-500/50',
          dot: 'bg-amber-400'
        };
      case 'offline':
        return {
          label: 'OFFLINE',
          classes: 'bg-slate-900 text-slate-400 border-slate-700',
          dot: 'bg-slate-500'
        };
      case 'normal':
      default:
        return {
          label: 'NOMINAL',
          classes: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400'
        };
    }
  };

  const handleCardClick = (node: SensorNode) => {
    sound.playClick();
    onSelectNode(node);
  };

  return (
    <div className="space-y-3">
      {/* Control / Filter Ribbon */}
      <div className="p-3 bg-[#0a111a] border border-[#1b2633] rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            FILTER:
          </span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              statusFilter === 'all'
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            All ({nodes.length})
          </button>
          <button
            onClick={() => setStatusFilter('attention')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              statusFilter === 'attention'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Attention ({nodes.filter(n => n.status === 'warning' || n.status === 'critical').length})
          </button>
          <button
            onClick={() => setStatusFilter('normal')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              statusFilter === 'normal'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Nominal ({nodes.filter(n => n.status === 'normal').length})
          </button>
          <button
            onClick={() => setStatusFilter('offline')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              statusFilter === 'offline'
                ? 'bg-slate-800 text-slate-200 border-slate-600'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Offline ({nodes.filter(n => n.status === 'offline').length})
          </button>
        </div>

        {/* Tunnel Select, Sort & Search */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Tunnel Filter Dropdown */}
          <select
            value={tunnelFilter}
            onChange={(e) => setTunnelFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Tunnels (A-E)</option>
            <option value="Tunnel A">Tunnel A (North Drift)</option>
            <option value="Tunnel B">Tunnel B (Central Stope)</option>
            <option value="Tunnel C">Tunnel C (Lower Incline)</option>
            <option value="Tunnel D">Tunnel D (South Crosscut)</option>
            <option value="Tunnel E">Tunnel E (Exhaust Shaft)</option>
          </select>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none"
            >
              <option value="id">Sort: Node ID</option>
              <option value="gas">Sort: CH₄ Gas Level</option>
              <option value="temp">Sort: Temperature</option>
              <option value="battery">Sort: Battery Level</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sensor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {filteredNodes.map((n) => {
          const badge = getStatusBadge(n.status);
          const isPulsing = pulseNodeId === n.id;
          const gasPercent = Math.min(100, Math.round((n.gas / 250) * 100));

          return (
            <div
              key={n.id}
              onClick={() => handleCardClick(n)}
              className={`bg-[#0a111a] border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:border-cyan-500/50 hover:bg-[#0d1622] flex flex-col justify-between group ${
                n.status === 'critical'
                  ? 'border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                  : n.status === 'warning'
                  ? 'border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.1)]'
                  : 'border-[#1b2633]'
              } ${isPulsing ? 'ring-2 ring-rose-500 animate-pulse' : ''}`}
            >
              {/* Card Top: Node ID, Depth & Status Badge */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors">
                      NODE {n.id}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      -{n.depthMeters}m
                    </span>
                  </div>

                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 ${badge.classes}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    {badge.label}
                  </span>
                </div>

                {/* Zone description */}
                <div className="text-[11px] font-sans text-slate-400 truncate mb-3" title={n.zone}>
                  {n.zone}
                </div>

                {/* Methane Gas Reading (Primary Safety Vital with Trend Indicator) */}
                <div className="bg-[#060a0f] rounded p-2 border border-slate-800/80 mb-2.5">
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      CH₄ METHANE
                    </span>
                    <div className="flex items-center gap-1.5">
                      {/* Trend Velocity Pill */}
                      {n.status !== 'offline' && n.gasRate && (
                        <span className={`text-[10px] font-mono px-1 py-0.2 rounded flex items-center gap-0.5 ${
                          n.gasTrend === 'rising'
                            ? 'text-amber-400 bg-amber-950/60'
                            : n.gasTrend === 'falling'
                            ? 'text-emerald-400 bg-emerald-950/60'
                            : 'text-slate-400 bg-slate-900'
                        }`}>
                          {n.gasTrend === 'rising' && <TrendingUp className="w-2.5 h-2.5 text-amber-400" />}
                          {n.gasTrend === 'falling' && <TrendingDown className="w-2.5 h-2.5 text-emerald-400" />}
                          {n.gasTrend === 'stable' && <Activity className="w-2.5 h-2.5 text-slate-500" />}
                          <span>{n.gasRate}</span>
                        </span>
                      )}

                      <span className={`font-bold tabular-nums ${
                        n.gas > 150 ? 'text-amber-400' : 'text-slate-200'
                      }`}>
                        {n.status === 'offline' ? '—' : `${n.gas} ppm`}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        n.gas >= 200 ? 'bg-rose-500' : n.gas >= 150 ? 'bg-amber-400' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${n.status === 'offline' ? 0 : gasPercent}%` }}
                    />
                  </div>
                </div>

                {/* Secondary Vitals: Temp & Humidity */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                  <div className="bg-[#080d14] px-2 py-1.5 rounded border border-slate-800/60">
                    <div className="text-[9px] text-slate-400 flex items-center gap-1 mb-0.5">
                      <Thermometer className="w-2.5 h-2.5 text-cyan-400" />
                      TEMP
                    </div>
                    <div className="text-slate-200 font-semibold tabular-nums">
                      {n.status === 'offline' ? '—' : `${n.temp}°C`}
                    </div>
                  </div>

                  <div className="bg-[#080d14] px-2 py-1.5 rounded border border-slate-800/60">
                    <div className="text-[9px] text-slate-400 flex items-center gap-1 mb-0.5">
                      <Droplets className="w-2.5 h-2.5 text-blue-400" />
                      HUMIDITY
                    </div>
                    <div className="text-slate-200 font-semibold tabular-nums">
                      {n.status === 'offline' ? '—' : `${n.hum}%`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer: Battery, RSSI, Ping */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className={`flex items-center gap-1 ${
                  n.battery < 45 ? 'text-amber-400 font-semibold' : 'text-slate-400'
                }`}>
                  <BatteryCharging className="w-3 h-3" />
                  {n.status === 'offline' ? '—' : `${n.battery}%`}
                </span>

                <span className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-cyan-400" />
                  {n.status === 'offline' ? 'LOSS' : `${n.rssi}dB`}
                </span>

                <span className="text-slate-400">
                  {n.status === 'offline' ? 'TIMEOUT' : `${n.lastSeenSec}s ago`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
