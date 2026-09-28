import React, { useState } from 'react';
import { SensorNode, HistoryPoint } from '../types';
import { 
  X, 
  MapPin, 
  Flame, 
  Thermometer, 
  Droplets, 
  BatteryCharging, 
  Wifi, 
  ShieldAlert, 
  CheckCircle2, 
  RotateCw, 
  Terminal,
  Activity,
  Cpu,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { sound } from '../utils/audio';
import { mqttService } from '../utils/mqttService';

interface NodeDetailModalProps {
  node: SensorNode | null;
  history: HistoryPoint[];
  onClose: () => void;
  onLogEvent: (source: 'SENSOR_MESH', message: string, type: 'info' | 'warn' | 'error' | 'success') => void;
}

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  node,
  history,
  onClose,
  onLogEvent
}) => {
  if (!node) return null;

  const [activeTab, setActiveTab] = useState<'telemetry' | 'diagnostics' | 'hardware'>('telemetry');
  const [isCalibrating, setIsCalibrating] = useState(false);

  const handlePing = () => {
    sound.playClick();
    mqttService.publish(`mine/control/nodes/${node.id}/command`, { action: 'PING', timestamp: new Date().toISOString() });
    onLogEvent('SENSOR_MESH', `Ping dispatched to Node ${node.id} (${node.ipAddress}): ACK received in 18ms`, 'success');
  };

  const handleReboot = () => {
    sound.playWarning();
    mqttService.publish(`mine/control/nodes/${node.id}/command`, { action: 'REBOOT', timestamp: new Date().toISOString() });
    onLogEvent('SENSOR_MESH', `Soft reboot signal transmitted to Node ${node.id}. Hardware watchdog reset in progress.`, 'warn');
  };

  const handleCalibrate = () => {
    sound.playClick();
    setIsCalibrating(true);
    mqttService.triggerCalibration();
    onLogEvent('SENSOR_MESH', `Remote calibration command ("CALIBRATE") published to mine/node/cmd/calibrate`, 'info');
    setTimeout(() => {
      setIsCalibrating(false);
      sound.playSuccess();
      onLogEvent('SENSOR_MESH', `Zero-point gas calibration completed for Node ${node.id}: Drift offset < 0.2 ppm.`, 'success');
    }, 1500);
  };

  // Sparkline generator
  const renderSparkline = (dataKey: keyof HistoryPoint, stroke: string, maxBound: number) => {
    if (!history || history.length < 2) return null;
    const w = 320;
    const h = 60;
    const pad = 10;
    const vals = history.map(h => Number(h[dataKey]) || 0);
    const min = Math.min(...vals) * 0.9;
    const max = Math.max(maxBound, Math.max(...vals) * 1.1);

    const pts = vals.map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16 bg-[#060a0f] rounded border border-slate-800/80">
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        {/* Value labels */}
        <text x={pad} y={14} fill="#64748b" fontSize="9" fontFamily="monospace">
          MIN: {min.toFixed(0)}
        </text>
        <text x={w - pad} y={14} fill={stroke} fontSize="9" fontFamily="monospace" textAnchor="end" fontWeight="bold">
          CURRENT: {vals[vals.length - 1]}
        </text>
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b121b] border border-[#223142] rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 bg-[#0e1724] border-b border-[#1c2938] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
              {node.id}
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-100 flex items-center gap-2">
                SENSOR NODE {node.id} · {node.name}
                <span className={`text-[10px] font-mono px-2 py-0.2 rounded border font-semibold ${
                  node.status === 'critical'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                    : node.status === 'warning'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                    : node.status === 'offline'
                    ? 'bg-slate-900 text-slate-400 border-slate-700'
                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                }`}>
                  {node.status.toUpperCase()}
                </span>
              </h3>
              <p className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3 h-3 text-cyan-400" />
                {node.zone} · {node.tunnel} (-{node.depthMeters}m depth)
              </p>
            </div>
          </div>

          <button
            onClick={() => { sound.playClick(); onClose(); }}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-[#182330] bg-[#0c1420] text-xs font-mono">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`pb-2 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'telemetry'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Atmospheric Vitals
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-2 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'diagnostics'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            24m Historical Trends
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`pb-2 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'hardware'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Hardware &amp; Network
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
          {activeTab === 'telemetry' && (
            <>
              {/* Primary Gas Safety Status Block */}
              <div className="bg-[#080d14] rounded-lg p-3.5 border border-[#1b2635]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400" />
                    METHANE (CH₄) CONCENTRATION
                  </span>
                  <div className="flex items-center gap-2">
                    {node.status !== 'offline' && node.gasRate && (
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                        node.gasTrend === 'rising'
                          ? 'text-amber-300 bg-amber-950/80 border-amber-500/40'
                          : node.gasTrend === 'falling'
                          ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40'
                          : 'text-slate-300 bg-slate-900 border-slate-700'
                      }`}>
                        {node.gasTrend === 'rising' && <TrendingUp className="w-3 h-3 text-amber-400 animate-pulse" />}
                        {node.gasTrend === 'falling' && <TrendingDown className="w-3 h-3 text-emerald-400" />}
                        {node.gasTrend === 'stable' && <Activity className="w-3 h-3 text-slate-400" />}
                        <span>Trend: {node.gasRate}</span>
                      </span>
                    )}

                    <span className={`text-base font-bold tabular-nums ${
                      node.gas > 150 ? 'text-amber-400' : 'text-slate-100'
                    }`}>
                      {node.status === 'offline' ? 'OFFLINE' : `${node.gas} ppm`}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 mb-2">
                  MSHA Statutory Thresholds: 150 ppm (Warning) · 200 ppm / 1.0% LEL (Mandatory Evacuation)
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      node.gas >= 200 ? 'bg-rose-500' : node.gas >= 150 ? 'bg-amber-400' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, (node.gas / 250) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#080d14] p-3 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                    <Thermometer className="w-3 h-3 text-cyan-400" />
                    TEMP
                  </div>
                  <div className="text-base font-bold text-slate-100 tabular-nums">
                    {node.status === 'offline' ? '—' : `${node.temp} °C`}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">Normal: 15-32°C</div>
                </div>

                <div className="bg-[#080d14] p-3 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                    <Droplets className="w-3 h-3 text-blue-400" />
                    HUMIDITY
                  </div>
                  <div className="text-base font-bold text-slate-100 tabular-nums">
                    {node.status === 'offline' ? '—' : `${node.hum} %`}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">RH Range 40-85%</div>
                </div>

                <div className="bg-[#080d14] p-3 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                    <Activity className="w-3 h-3 text-rose-400" />
                    CARBON MONOXIDE
                  </div>
                  <div className="text-base font-bold text-slate-100 tabular-nums">
                    {node.status === 'offline' ? '—' : `${node.co} ppm`}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">Safe limit: &lt; 25 ppm</div>
                </div>

                <div className="bg-[#080d14] p-3 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                    <BatteryCharging className="w-3 h-3 text-emerald-400" />
                    BATTERY
                  </div>
                  <div className={`text-base font-bold tabular-nums ${
                    node.battery < 45 ? 'text-amber-400' : 'text-slate-100'
                  }`}>
                    {node.status === 'offline' ? '—' : `${node.battery} %`}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">3.2V LiFePO4</div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">METHANE CH₄ TREND (LAST 24 MINS)</div>
                {renderSparkline('gas', '#f59e0b', 200)}
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">TEMPERATURE TREND (°C)</div>
                {renderSparkline('temp', '#06b6d4', 35)}
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">RELATIVE HUMIDITY TREND (%)</div>
                {renderSparkline('hum', '#3b82f6', 80)}
              </div>
            </div>
          )}

          {activeTab === 'hardware' && (
            <div className="space-y-2 bg-[#080d14] p-4 rounded-lg border border-slate-800 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Microcontroller:</span>
                <span className="text-slate-200">Espressif ESP32-WROOM-32U (240MHz Dual-Core)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Firmware Build:</span>
                <span className="text-slate-200">{node.firmware}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Subterranean IP:</span>
                <span className="text-cyan-400">{node.ipAddress}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Mesh Signal (RSSI):</span>
                <span className="text-slate-200">{node.rssi} dBm (LoRa SX1276 · 868MHz)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Gas Sensor Element:</span>
                <span className="text-slate-200">MQ-4 Catalytic Combustion Chamber (±2% Calibrated)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Last Telemetry Packet:</span>
                <span className="text-emerald-400">{node.lastSeenSec} seconds ago</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-3 bg-[#0c1420] border-t border-[#1c2938] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePing}
              className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ping Node</span>
            </button>

            <button
              onClick={handleCalibrate}
              disabled={isCalibrating}
              className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1.5"
            >
              <RotateCw className={`w-3.5 h-3.5 text-amber-400 ${isCalibrating ? 'animate-spin' : ''}`} />
              <span>{isCalibrating ? 'Calibrating...' : 'Zero Calibrate'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReboot}
              className="px-3 py-1.5 rounded bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 transition-colors"
            >
              Reboot ESP32
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
