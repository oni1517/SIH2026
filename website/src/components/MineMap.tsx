import React, { useState } from 'react';
import { SensorNode, RobotState } from '../types';
import { 
  Wind, 
  Flame, 
  Bot, 
  Shield, 
  ZoomIn, 
  ZoomOut, 
  Compass, 
  MapPin, 
  Eye,
  Info
} from 'lucide-react';
import { sound } from '../utils/audio';

interface MineMapProps {
  nodes: SensorNode[];
  robot: RobotState;
  onSelectNode: (node: SensorNode) => void;
  isEmergencyActive?: boolean;
}

export const MineMap: React.FC<MineMapProps> = ({
  nodes,
  robot,
  onSelectNode,
  isEmergencyActive = false
}) => {
  const [showAirflow, setShowAirflow] = useState(true);
  const [showGasHeatmap, setShowGasHeatmap] = useState(true);
  const [showEscapeways, setShowEscapeways] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<SensorNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return '#f43f5e'; // rose-500
      case 'warning':
        return '#f59e0b'; // amber-500
      case 'offline':
        return '#64748b'; // slate-500
      case 'normal':
      default:
        return '#10b981'; // emerald-500
    }
  };

  const handleNodeClick = (n: SensorNode) => {
    sound.playClick();
    onSelectNode(n);
  };

  return (
    <div className="relative bg-[#080d14] rounded-lg border border-[#1a2533] overflow-hidden shadow-xl flex flex-col">
      {/* Map Header & Interactive Layer Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0b121b] border-b border-[#182330]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-slate-200">
            SUBTERRANEAN TOPOLOGICAL GRID · LEVEL -140m TO -460m
          </h2>
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <button
            onClick={() => setShowAirflow(!showAirflow)}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors border ${
              showAirflow
                ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Wind className="w-3 h-3" />
            <span className="hidden sm:inline">Ventilation</span>
          </button>

          <button
            onClick={() => setShowGasHeatmap(!showGasHeatmap)}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors border ${
              showGasHeatmap
                ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span className="hidden sm:inline">CH₄ Hazard</span>
          </button>

          <button
            onClick={() => setShowEscapeways(!showEscapeways)}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors border ${
              showEscapeways
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3 h-3" />
            <span className="hidden sm:inline">Escapeways</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 1.4))}
            className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.85))}
            className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Stage */}
      <div className="relative w-full aspect-[16/9] min-h-[380px] max-h-[560px] overflow-hidden bg-[#070b10]">
        <svg
          viewBox="0 0 860 480"
          className="w-full h-full select-none cursor-crosshair transition-transform duration-300 ease-out"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            {/* Background Stratum Gradient */}
            <radialGradient id="rockStrata" cx="45%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#0e1724" />
              <stop offset="60%" stopColor="#080e16" />
              <stop offset="100%" stopColor="#040609" />
            </radialGradient>

            {/* Glowing filter for nodes and rover */}
            <filter id="mapGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Gas Cloud Heatmap Gradients */}
            <radialGradient id="gasZone4" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(245, 158, 11, 0.35)" />
              <stop offset="70%" stopColor="rgba(245, 158, 11, 0.08)" />
              <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
            </radialGradient>

            <radialGradient id="gasZone8" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(244, 63, 94, 0.45)" />
              <stop offset="65%" stopColor="rgba(244, 63, 94, 0.12)" />
              <stop offset="100%" stopColor="rgba(244, 63, 94, 0)" />
            </radialGradient>

            {/* Headlight beam for robot */}
            <radialGradient id="botBeam" cx="10%" cy="50%" r="90%">
              <stop offset="0%" stopColor="rgba(6, 182, 212, 0.4)" />
              <stop offset="60%" stopColor="rgba(6, 182, 212, 0.1)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
            </radialGradient>

            {/* Airflow Arrow Marker */}
            <marker id="arrowIntake" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#06b6d4" />
            </marker>
            <marker id="arrowExhaust" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
            </marker>
          </defs>

          {/* Canvas Background */}
          <rect width="860" height="480" fill="url(#rockStrata)" />

          {/* Geological Fault Lines & Depth Benches */}
          <g stroke="#16202c" strokeWidth="1" strokeDasharray="3 3">
            <line x1="40" y1="90" x2="820" y2="90" />
            <text x="50" y="85" fill="#475569" fontSize="9" fontFamily="monospace">BENCH LEVEL -140m · SURFACE CRUST</text>

            <line x1="40" y1="190" x2="820" y2="190" />
            <text x="50" y="185" fill="#475569" fontSize="9" fontFamily="monospace">BENCH LEVEL -260m · ORE HORIZON 1</text>

            <line x1="40" y1="310" x2="820" y2="310" />
            <text x="50" y="305" fill="#475569" fontSize="9" fontFamily="monospace">BENCH LEVEL -380m · ACTIVE STOPING ZONE</text>

            <line x1="40" y1="420" x2="820" y2="420" />
            <text x="50" y="415" fill="#475569" fontSize="9" fontFamily="monospace">BENCH LEVEL -460m · SUMP &amp; DRIFT ADVANCE</text>
          </g>

          {/* Subterranean Tunnels & Drifts (Double line representing rock walls) */}
          <g fill="none">
            {/* Outer Tunnel Wall Glow / Rock Shadow */}
            <path
              d="
                M 80 40 L 120 140
                L 230 95
                L 380 160
                L 520 110
                L 720 130
                L 780 40
                M 230 95 L 180 270 L 320 310 L 480 290 L 640 240 L 720 130
                M 380 160 L 480 290
                M 320 310 L 330 420
                M 640 240 L 750 320
              "
              stroke="#0a121c"
              strokeWidth="24"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Tunnel Floor Haulage Track */}
            <path
              d="
                M 80 40 L 120 140
                L 230 95
                L 380 160
                L 520 110
                L 720 130
                L 780 40
                M 230 95 L 180 270 L 320 310 L 480 290 L 640 240 L 720 130
                M 380 160 L 480 290
                M 320 310 L 330 420
                M 640 240 L 750 320
              "
              stroke="#1b2836"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Center rail track line */}
            <path
              d="
                M 80 40 L 120 140
                L 230 95
                L 380 160
                L 520 110
                L 720 130
                L 780 40
                M 230 95 L 180 270 L 320 310 L 480 290 L 640 240 L 720 130
                M 380 160 L 480 290
                M 320 310 L 330 420
                M 640 240 L 750 320
              "
              stroke="#2c3e50"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          </g>

          {/* Gas Dispersion Clouds (Heatmap layer) */}
          {showGasHeatmap && (
            <g>
              {/* Elevated Gas around Node 08 (Zone 2, Tunnel D) */}
              <circle cx="640" cy="240" r="75" fill="url(#gasZone8)" />
              {/* Moderate Gas around Crusher Node 03 */}
              <circle cx="380" cy="160" r="55" fill="url(#gasZone4)" />
              <text x="640" y="275" fill="#f43f5e" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                CH₄ POCKET: 178 ppm
              </text>
            </g>
          )}

          {/* Escapeways & Refuge Chambers (Emergency Layer) */}
          {showEscapeways && (
            <g>
              {/* Emergency Refuge Station #1 */}
              <rect x="290" y="145" width="28" height="20" rx="3" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
              <text x="304" y="159" fill="#a7f3d0" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                REFUGE
              </text>

              {/* Emergency Escapeway Glow when Evac is active */}
              {isEmergencyActive && (
                <path
                  d="M 640 240 L 480 290 L 380 160 L 230 95 L 120 140 L 80 40"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray="6 4"
                  className="animate-pulse"
                />
              )}
            </g>
          )}

          {/* Ventilation Airflow Vectors */}
          {showAirflow && (
            <g opacity="0.8">
              {/* Fresh air intake (Portal down into drifts) */}
              <path d="M 85 45 L 115 130" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowIntake)" strokeDasharray="5 5" />
              <path d="M 130 135 L 215 100" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowIntake)" strokeDasharray="5 5" />
              <path d="M 245 105 L 360 155" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowIntake)" strokeDasharray="5 5" />
              <path d="M 375 175 L 465 275" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowIntake)" strokeDasharray="5 5" />
              
              {/* Return foul air (Exhaust up Tunnel E vent raise) */}
              <path d="M 625 225 L 705 145" stroke="#f43f5e" strokeWidth="2" markerEnd="url(#arrowExhaust)" strokeDasharray="5 5" />
              <path d="M 725 120 L 775 55" stroke="#f43f5e" strokeWidth="2" markerEnd="url(#arrowExhaust)" strokeDasharray="5 5" />
              <text x="790" y="45" fill="#f43f5e" fontSize="9" fontFamily="monospace">
                EXHAUST 450 m³/min
              </text>
            </g>
          )}

          {/* Infrastructure Landmarks */}
          <g>
            {/* Mine Portal / Surface Adit */}
            <rect x="65" y="28" width="30" height="24" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="80" y="22" fill="#38bdf8" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              PORTAL ENTRY 0m
            </text>

            {/* Primary Crusher Station */}
            <circle cx="380" cy="160" r="14" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
            <text x="380" y="190" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">
              CRUSHER BAY
            </text>

            {/* Sump Pump Station */}
            <circle cx="330" cy="420" r="12" fill="#0f172a" stroke="#0284c7" strokeWidth="1.5" />
            <text x="330" y="442" fill="#38bdf8" fontSize="8" fontFamily="monospace" textAnchor="middle">
              DEEP SUMP -460m
            </text>

            {/* Master Node ESP32 Mesh Gateway */}
            <rect x="440" y="18" width="40" height="28" rx="3" fill="#091824" stroke="#06b6d4" strokeWidth="1.6" filter="url(#mapGlow)" />
            <text x="460" y="34" fill="#38bdf8" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              MASTER
            </text>
            <text x="460" y="43" fill="#67e8f9" fontSize="6.5" fontFamily="monospace" textAnchor="middle">
              ESP32 GATEWAY
            </text>
          </g>

          {/* Sensor Nodes */}
          {nodes.map((n) => {
            const color = getStatusColor(n.status);
            const isHovered = hoveredNode?.id === n.id;
            return (
              <g
                key={n.id}
                className="cursor-pointer group"
                onClick={() => handleNodeClick(n)}
                onMouseEnter={() => setHoveredNode(n)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Outer status ring */}
                {n.status !== 'offline' && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={isHovered ? 20 : 16}
                    fill="none"
                    stroke={color}
                    strokeWidth="1"
                    strokeOpacity="0.4"
                    className={n.status === 'critical' ? 'animate-ping' : ''}
                  />
                )}

                {/* Node Body */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isHovered ? 12 : 10}
                  fill="#090f17"
                  stroke={color}
                  strokeWidth="2"
                  filter={n.status !== 'offline' ? 'url(#mapGlow)' : undefined}
                  className="transition-all duration-150"
                />

                {/* Node ID label */}
                <text
                  x={n.x}
                  y={n.y + 3.5}
                  fill={color}
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {n.id}
                </text>

                {/* Micro tooltip pill on map */}
                <text
                  x={n.x}
                  y={n.y - 14}
                  fill="#94a3b8"
                  fontSize="7.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="pointer-events-none opacity-80 group-hover:opacity-100"
                >
                  {n.status === 'offline' ? 'OFFLINE' : `${n.gas}ppm`}
                </text>
              </g>
            );
          })}

          {/* Autonomous Rover BOT-01 */}
          <g transform={`translate(${robot.x}, ${robot.y})`}>
            {/* Headlight cone */}
            <path
              d="M 0 0 L 70 -35 L 70 35 Z"
              fill="url(#botBeam)"
              transform={`rotate(${robot.heading - 90})`}
              className="pointer-events-none"
            />

            {/* Radar scanner sweep ping */}
            <circle
              r="22"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1"
              strokeDasharray="3 3"
              className="pulse-glow"
            />

            {/* Rover chassis polygon */}
            <g transform={`rotate(${robot.heading})`}>
              <polygon
                points="0,-12 9,8 -9,8"
                fill="#06b6d4"
                stroke="#e0f2fe"
                strokeWidth="1.2"
                filter="url(#mapGlow)"
              />
              <circle cx="0" cy="0" r="3" fill="#082f49" />
            </g>

            {/* Rover Label */}
            <text
              x="0"
              y="22"
              fill="#38bdf8"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
              filter="url(#mapGlow)"
            >
              BOT-01
            </text>
          </g>
        </svg>

        {/* Hovered Node Quick Telemetry Overlay Panel */}
        {hoveredNode && (
          <div className="absolute bottom-3 left-3 bg-[#0c141e]/95 border border-cyan-500/40 rounded p-2.5 shadow-2xl backdrop-blur-md pointer-events-none text-xs font-mono max-w-[260px] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-1.5 mb-1.5">
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                NODE {hoveredNode.id} ({hoveredNode.name})
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase"
                style={{
                  color: getStatusColor(hoveredNode.status),
                  backgroundColor: `${getStatusColor(hoveredNode.status)}15`,
                  border: `1px solid ${getStatusColor(hoveredNode.status)}40`
                }}
              >
                {hoveredNode.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <span className="text-slate-400">Tunnel:</span>
              <span className="text-slate-200 text-right truncate">{hoveredNode.tunnel.split(' ')[0]}</span>
              <span className="text-slate-400">Depth:</span>
              <span className="text-slate-200 text-right">-{hoveredNode.depthMeters} m</span>
              <span className="text-slate-400">CH₄ Methane:</span>
              <span className={`text-right font-semibold ${hoveredNode.gas > 150 ? 'text-amber-400' : 'text-slate-200'}`}>
                {hoveredNode.status === 'offline' ? '—' : `${hoveredNode.gas} ppm`}
              </span>
              <span className="text-slate-400">Temp / Hum:</span>
              <span className="text-slate-200 text-right">
                {hoveredNode.status === 'offline' ? '—' : `${hoveredNode.temp}°C / ${hoveredNode.hum}%`}
              </span>
              <span className="text-slate-400">Battery:</span>
              <span className="text-slate-200 text-right">
                {hoveredNode.status === 'offline' ? '—' : `${hoveredNode.battery}%`}
              </span>
            </div>
            <div className="text-[10px] text-cyan-400 mt-2 text-right">Click node to inspect &rarr;</div>
          </div>
        )}
      </div>

      {/* Map Legend & Summary Status Bar */}
      <div className="px-4 py-2 bg-[#090f17] border-t border-[#16212d] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-4 flex-wrap text-slate-400 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
            <span>Nominal (&lt;150 ppm)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
            <span>Caution (150-200 ppm)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
            <span>Critical (&gt;200 ppm / 1% LEL)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span>Offline</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span>Rover Speed: <b className="text-slate-200">{robot.speed} m/s</b></span>
          <span>Heading: <b className="text-slate-200">{Math.round(robot.heading)}°</b></span>
          <span>Patrol: <b className="text-cyan-400">{robot.currentWaypoint}</b></span>
        </div>
      </div>
    </div>
  );
};
