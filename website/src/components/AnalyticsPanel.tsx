import React, { useState } from 'react';
import { SensorNode, HistoryPoint } from '../types';
import { 
  BarChart3, 
  Flame, 
  Thermometer, 
  Droplets, 
  BatteryCharging, 
  Activity, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  Download
} from 'lucide-react';
import { sound } from '../utils/audio';

interface AnalyticsPanelProps {
  nodes: SensorNode[];
  histories: Record<string, HistoryPoint[]>;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  nodes,
  histories
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id || '01');
  const [metric, setMetric] = useState<'gas' | 'temp' | 'hum' | 'battery' | 'co'>('gas');
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '6h' | '24h'>('1h');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];
  const nodeHistory = histories[selectedNodeId] || [];

  const metricConfigs = {
    gas: {
      label: 'Methane (CH₄)',
      unit: 'ppm',
      color: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.12)',
      warningThreshold: 150,
      criticalThreshold: 200,
      minScale: 50,
      maxScale: 250
    },
    temp: {
      label: 'Temperature',
      unit: '°C',
      color: '#06b6d4',
      fill: 'rgba(6, 182, 212, 0.12)',
      warningThreshold: 32,
      criticalThreshold: 38,
      minScale: 15,
      maxScale: 45
    },
    hum: {
      label: 'Relative Humidity',
      unit: '%',
      color: '#3b82f6',
      fill: 'rgba(59, 130, 246, 0.12)',
      warningThreshold: 75,
      criticalThreshold: 90,
      minScale: 30,
      maxScale: 100
    },
    battery: {
      label: 'Battery SOC',
      unit: '%',
      color: '#10b981',
      fill: 'rgba(16, 185, 129, 0.12)',
      warningThreshold: 45,
      criticalThreshold: 20,
      minScale: 0,
      maxScale: 100
    },
    co: {
      label: 'Carbon Monoxide',
      unit: 'ppm',
      color: '#f43f5e',
      fill: 'rgba(244, 63, 94, 0.12)',
      warningThreshold: 25,
      criticalThreshold: 50,
      minScale: 0,
      maxScale: 60
    }
  };

  const config = metricConfigs[metric];
  const values = nodeHistory.map(h => Number(h[metric]) || 0);
  const currentVal = values.length > 0 ? values[values.length - 1] : 0;
  const peakVal = values.length > 0 ? Math.max(...values) : 0;
  const avgVal = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '0';

  // SVG Chart Dimensions
  const w = 780;
  const h = 260;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;

  const minVal = Math.min(config.minScale, Math.min(...(values.length ? values : [0])));
  const maxVal = Math.max(config.maxScale, Math.max(...(values.length ? values : [100])));

  const getY = (val: number) => {
    return h - padBottom - ((val - minVal) / (maxVal - minVal || 1)) * (h - padTop - padBottom);
  };

  const getX = (idx: number) => {
    if (values.length <= 1) return padLeft;
    return padLeft + (idx / (values.length - 1)) * (w - padLeft - padRight);
  };

  const points = values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
  const areaPoints = values.length > 1
    ? `${getX(0)},${h - padBottom} ${points} ${getX(values.length - 1)},${h - padBottom}`
    : '';

  const warningY = getY(config.warningThreshold);
  const criticalY = getY(config.criticalThreshold);

  return (
    <div className="bg-[#090f17] rounded-lg border border-[#1a2533] p-4 space-y-4 shadow-xl">
      {/* Top Header & Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#182330]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-slate-100">
            ATMOSPHERIC SAFETY &amp; SENSOR TIME-SERIES ANALYTICS
          </h2>
        </div>

        {/* Controls: Node Select, Sensor Select, Time Range */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          {/* Node Selector */}
          <select
            value={selectedNodeId}
            onChange={(e) => { sound.playClick(); setSelectedNodeId(e.target.value); }}
            className="bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-1 rounded focus:outline-none focus:border-cyan-500"
          >
            {nodes.map(n => (
              <option key={n.id} value={n.id}>
                NODE {n.id} ({n.zone.split('·')[0]})
              </option>
            ))}
          </select>

          {/* Metric Selector */}
          <select
            value={metric}
            onChange={(e) => { sound.playClick(); setMetric(e.target.value as any); }}
            className="bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-1 rounded focus:outline-none focus:border-cyan-500"
          >
            <option value="gas">Methane (CH₄ ppm)</option>
            <option value="temp">Temperature (°C)</option>
            <option value="hum">Relative Humidity (%)</option>
            <option value="co">Carbon Monoxide (CO)</option>
            <option value="battery">Battery Voltage (%)</option>
          </select>

          {/* Time range tabs */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5">
            {(['15m', '1h', '6h', '24h'] as const).map(t => (
              <button
                key={t}
                onClick={() => { sound.playClick(); setTimeRange(t); }}
                className={`px-2 py-0.5 rounded transition-colors ${
                  timeRange === t ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-[#0b121b] p-3 rounded-lg border border-[#1b2633]">
          <div className="text-[10px] text-slate-400">CURRENT VALUE</div>
          <div className="text-xl font-bold text-slate-100 tabular-nums mt-0.5" style={{ color: config.color }}>
            {currentVal} <span className="text-xs font-normal text-slate-400">{config.unit}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Status: {currentVal >= config.criticalThreshold ? 'CRITICAL' : currentVal >= config.warningThreshold ? 'WARNING' : 'SAFE'}
          </div>
        </div>

        <div className="bg-[#0b121b] p-3 rounded-lg border border-[#1b2633]">
          <div className="text-[10px] text-slate-400">PEAK EXPOSURE</div>
          <div className="text-xl font-bold text-slate-100 tabular-nums mt-0.5">
            {peakVal} <span className="text-xs font-normal text-slate-400">{config.unit}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Recorded in session</div>
        </div>

        <div className="bg-[#0b121b] p-3 rounded-lg border border-[#1b2633]">
          <div className="text-[10px] text-slate-400">TIME-WEIGHTED AVG</div>
          <div className="text-xl font-bold text-slate-100 tabular-nums mt-0.5">
            {avgVal} <span className="text-xs font-normal text-slate-400">{config.unit}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">TWA compliance nominal</div>
        </div>

        <div className="bg-[#0b121b] p-3 rounded-lg border border-[#1b2633]">
          <div className="text-[10px] text-slate-400">REGULATORY CEILING</div>
          <div className="text-xl font-bold text-rose-400 tabular-nums mt-0.5">
            {config.criticalThreshold} <span className="text-xs font-normal text-slate-400">{config.unit}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">MSHA Title 30 CFR §75</div>
        </div>
      </div>

      {/* Primary SVG Chart Canvas */}
      <div className="relative w-full aspect-[21/9] min-h-[280px] bg-[#05080c] rounded-lg border border-[#182330] overflow-hidden p-2 select-none">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-full"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const val = minVal + pct * (maxVal - minVal);
            const y = getY(val);
            return (
              <g key={i}>
                <line x1={padLeft} y1={y} x2={w - padRight} y2={y} stroke="#131e2b" strokeWidth="1" strokeDasharray="3 3" />
                <text x={padLeft - 8} y={y + 3} fill="#475569" fontSize="9" fontFamily="monospace" textAnchor="end">
                  {Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Warning Threshold Line */}
          {warningY > padTop && warningY < h - padBottom && (
            <g>
              <line x1={padLeft} y1={warningY} x2={w - padRight} y2={warningY} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 4" />
              <text x={w - padRight} y={warningY - 4} fill="#f59e0b" fontSize="8.5" fontFamily="monospace" textAnchor="end">
                WARNING CEILING {config.warningThreshold} {config.unit}
              </text>
            </g>
          )}

          {/* Critical Threshold Line */}
          {criticalY > padTop && criticalY < h - padBottom && (
            <g>
              <line x1={padLeft} y1={criticalY} x2={w - padRight} y2={criticalY} stroke="#f43f5e" strokeWidth="1.4" strokeDasharray="4 4" />
              <text x={w - padRight} y={criticalY - 4} fill="#f43f5e" fontSize="8.5" fontFamily="monospace" textAnchor="end" fontWeight="bold">
                CRITICAL EVACUATION {config.criticalThreshold} {config.unit}
              </text>
            </g>
          )}

          {/* Shaded Area */}
          {areaPoints && (
            <polygon points={areaPoints} fill={config.fill} />
          )}

          {/* Telemetry Line */}
          {points && (
            <polyline
              points={points}
              fill="none"
              stroke={config.color}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points & Interactive Hover Circles */}
          {values.map((v, i) => {
            const cx = getX(i);
            const cy = getY(v);
            const isHovered = hoveredIndex === i;

            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : 2.5}
                  fill={isHovered ? '#ffffff' : config.color}
                  stroke="#05080c"
                  strokeWidth="1.5"
                  className="transition-all duration-100"
                />
                {/* Invisible hover hitbox */}
                <rect
                  x={cx - 10}
                  y={padTop}
                  width={20}
                  height={h - padTop - padBottom}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  className="cursor-pointer"
                />
              </g>
            );
          })}

          {/* Hover Crosshair Guide */}
          {hoveredIndex !== null && values[hoveredIndex] !== undefined && (
            <g>
              <line
                x1={getX(hoveredIndex)}
                y1={padTop}
                x2={getX(hoveredIndex)}
                y2={h - padBottom}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoveredIndex)}
                cy={getY(values[hoveredIndex])}
                r="6"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X Axis Time Labels */}
          {nodeHistory.map((pt, i) => {
            if (i % 6 !== 0 && i !== nodeHistory.length - 1) return null;
            return (
              <text
                key={i}
                x={getX(i)}
                y={h - padBottom + 16}
                fill="#64748b"
                fontSize="8.5"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {pt.time}
              </text>
            );
          })}
        </svg>

        {/* Hovered Tooltip HUD */}
        {hoveredIndex !== null && nodeHistory[hoveredIndex] && (
          <div
            className="absolute top-4 bg-[#0d1622]/95 border border-cyan-500/40 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 pointer-events-none shadow-xl backdrop-blur-md"
            style={{
              left: `${Math.min(w - 180, Math.max(20, getX(hoveredIndex) * 0.95))}px`
            }}
          >
            <div className="text-[10px] text-slate-400">{nodeHistory[hoveredIndex].time}</div>
            <div className="font-bold text-cyan-300">
              {config.label}: {nodeHistory[hoveredIndex][metric]} {config.unit}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
