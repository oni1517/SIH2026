import React, { useRef, useEffect, useState } from 'react';
import { RobotState } from '../types';
import { 
  Radar, 
  Rotate3d, 
  Layers, 
  Download, 
  Maximize2, 
  Scan, 
  ShieldCheck, 
  Sliders, 
  Eye,
  RefreshCw
} from 'lucide-react';
import { sound } from '../utils/audio';

interface LidarReconstructionProps {
  robot: RobotState;
  onLogEvent: (source: 'LIDAR', message: string, type: 'info' | 'warn' | 'error' | 'success') => void;
}

export const LidarReconstruction: React.FC<LidarReconstructionProps> = ({
  robot,
  onLogEvent
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotX, setRotX] = useState(-20);
  const [rotY, setRotY] = useState(35);
  const [zoom, setZoom] = useState(1.1);
  const [colorMode, setColorMode] = useState<'elevation' | 'intensity' | 'deformation'>('elevation');
  const [sliceDepth, setSliceDepth] = useState(100);
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Generate 3D Tunnel Point Cloud
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let autoAngle = rotY;

    // Generate static tunnel point cloud database
    const rings = 40;
    const pointsPerRing = 32;
    const tunnelRadius = 75;
    const tunnelLength = 800;

    const basePoints: { x: number; y: number; z: number; intensity: number; deformation: number }[] = [];

    for (let r = 0; r < rings; r++) {
      const z = (r / rings) * tunnelLength - tunnelLength / 2;
      // Add subtle undulation to tunnel
      const tunnelCurveX = Math.sin(r * 0.15) * 45;
      const tunnelCurveY = Math.cos(r * 0.12) * 20;

      for (let p = 0; p < pointsPerRing; p++) {
        const theta = (p / pointsPerRing) * Math.PI * 2;
        // Introduce rock roughness
        const roughness = (Math.sin(r * 3 + p * 5) * 0.08 + Math.cos(r * 7 + p * 2) * 0.05);
        const rad = tunnelRadius * (1 + roughness);

        // Simulated rock roof sag anomaly near ring 28
        let sag = 0;
        if (r > 24 && r < 32 && theta > Math.PI * 0.3 && theta < Math.PI * 0.7) {
          sag = Math.sin((r - 24) / 8 * Math.PI) * 12;
        }

        const x = tunnelCurveX + Math.cos(theta) * rad;
        const y = tunnelCurveY + Math.sin(theta) * rad + sag;
        const intensity = 0.5 + Math.sin(r * 0.4 + p * 0.8) * 0.45;
        const deformation = sag > 5 ? 0.85 : 0.05;

        basePoints.push({ x, y, z, intensity, deformation });
      }
    }

    const render = () => {
      if (isAutoRotate && !isDraggingRef.current) {
        autoAngle += 0.25;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#05080c';
      ctx.fillRect(0, 0, w, h);

      // Draw faint spatial 3D grid
      ctx.strokeStyle = '#0d1722';
      ctx.lineWidth = 1;
      const gridSpacing = 40;
      for (let x = -200; x <= 200; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + x, h / 2 - 120);
        ctx.lineTo(w / 2 + x, h / 2 + 120);
        ctx.stroke();
      }

      const currentRotX = (rotX * Math.PI) / 180;
      const currentRotY = (autoAngle * Math.PI) / 180;

      const cosX = Math.cos(currentRotX);
      const sinX = Math.sin(currentRotX);
      const cosY = Math.cos(currentRotY);
      const sinY = Math.sin(currentRotY);

      // Filter points by slice depth
      const maxZ = ((sliceDepth / 100) * tunnelLength) - tunnelLength / 2;
      const visiblePoints = basePoints.filter(p => p.z <= maxZ);

      // Sort points back-to-front for proper depth perception
      const transformed = visiblePoints.map(p => {
        // Rotate around Y axis
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;

        // Rotate around X axis
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        // Perspective projection
        const fov = 420 * zoom;
        const cameraDistance = 480;
        const pz = z2 + cameraDistance;

        if (pz <= 10) return null;

        const sx = (x1 * fov) / pz + w / 2;
        const sy = (y2 * fov) / pz + h / 2;
        const size = Math.max(1, (2.8 * fov) / pz);

        return { sx, sy, size, z: pz, orig: p };
      }).filter((pt): pt is NonNullable<typeof pt> => pt !== null);

      transformed.sort((a, b) => b.z - a.z);

      // Draw projected points
      for (const pt of transformed) {
        let fill = '#06b6d4';

        if (colorMode === 'elevation') {
          // Color by height / Y
          const normY = (pt.orig.y + tunnelRadius) / (tunnelRadius * 2);
          if (normY < 0.3) fill = '#06b6d4'; // Crown/roof: cyan
          else if (normY < 0.7) fill = '#3b82f6'; // Rib walls: blue
          else fill = '#8b5cf6'; // Invert/floor: purple
        } else if (colorMode === 'intensity') {
          const val = Math.round(pt.orig.intensity * 255);
          fill = `rgb(${val}, ${val}, ${Math.min(255, val + 40)})`;
        } else if (colorMode === 'deformation') {
          fill = pt.orig.deformation > 0.5 ? '#f43f5e' : '#10b981';
        }

        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw BOT-01 Scanner Node in 3D center
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Scan Sweep Ring
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 35, 0, Math.PI * 2);
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [rotX, rotY, zoom, colorMode, sliceDepth, isAutoRotate]);

  // Mouse Drag Handlers for 3D Orbit
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setRotY(prev => prev + dx * 0.6);
    setRotX(prev => Math.max(-80, Math.min(80, prev - dy * 0.6)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleExportPoints = () => {
    sound.playSuccess();
    onLogEvent('LIDAR', `Exported ${robot.lidarPointsCaptured.toLocaleString()} points to standard LAS format.`, 'success');
    const blob = new Blob([`# LAS 1.4 Point Cloud Export - Mine Command\n# Points: ${robot.lidarPointsCaptured}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MINE_POINTCLOUD_${Date.now()}.las`;
    a.click();
  };

  return (
    <div className="bg-[#090f17] rounded-lg border border-[#1a2533] overflow-hidden shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0c1420] border-b border-[#182330]">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
          <h2 className="text-xs font-mono font-bold tracking-wider text-slate-100 flex items-center gap-2">
            3D SUBTERRANEAN DRIFT POINT CLOUD
            <span className="text-[10px] text-cyan-400 font-semibold px-1.5 py-0.2 bg-cyan-950/60 rounded border border-cyan-500/30">
              10 Hz LIDAR
            </span>
          </h2>
        </div>

        {/* Color Palette & Visual Mode Toggles */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <button
            onClick={() => { sound.playClick(); setColorMode('elevation'); }}
            className={`px-2.5 py-1 rounded border transition-colors ${
              colorMode === 'elevation'
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Elevation Depth
          </button>

          <button
            onClick={() => { sound.playClick(); setColorMode('intensity'); }}
            className={`px-2.5 py-1 rounded border transition-colors ${
              colorMode === 'intensity'
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Reflectivity
          </button>

          <button
            onClick={() => { sound.playClick(); setColorMode('deformation'); }}
            className={`px-2.5 py-1 rounded border transition-colors ${
              colorMode === 'deformation'
                ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Roof Sag Anomaly
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Auto-Rotate toggle */}
          <button
            onClick={() => setIsAutoRotate(!isAutoRotate)}
            className={`p-1.5 rounded border transition-colors ${
              isAutoRotate
                ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title="Toggle Continuous Orbit"
          >
            <Rotate3d className="w-3.5 h-3.5" />
          </button>

          {/* Export LAS Button */}
          <button
            onClick={handleExportPoints}
            className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Download LAS Point Cloud"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Stage */}
      <div
        className="relative aspect-[16/9] min-h-[380px] max-h-[520px] bg-[#05080c] cursor-grab active:cursor-grabbing select-none overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={760}
          height={420}
          className="w-full h-full object-cover"
        />

        {/* 3D Viewport Floating Telemetry HUD */}
        <div className="absolute top-3 left-3 bg-[#0a111a]/85 border border-[#1b2636] backdrop-blur-md rounded p-2.5 text-xs font-mono space-y-1 pointer-events-none">
          <div className="text-[10px] text-slate-400 tracking-wider">LIDAR METRICS</div>
          <div className="text-slate-200 flex justify-between gap-4">
            <span className="text-slate-400">Captured Points:</span>
            <span className="font-bold text-cyan-300 tabular-nums">
              {robot.lidarPointsCaptured.toLocaleString()}
            </span>
          </div>
          <div className="text-slate-200 flex justify-between gap-4">
            <span className="text-slate-400">Mesh Coverage:</span>
            <span className="font-bold text-emerald-400 tabular-nums">
              {robot.mapCoveragePct}%
            </span>
          </div>
          <div className="text-slate-200 flex justify-between gap-4">
            <span className="text-slate-400">Scan Rate:</span>
            <span className="text-slate-300">10 Hz (360° LiDAR)</span>
          </div>
          <div className="text-slate-200 flex justify-between gap-4">
            <span className="text-slate-400">Structural Sag:</span>
            <span className="font-semibold text-amber-400">1.2 cm @ Ring 28</span>
          </div>
        </div>

        {/* Orbit hint in bottom-left */}
        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-slate-500 pointer-events-none">
          Click and drag to rotate 3D view · Use slider to slice depth
        </div>

        {/* Zoom Controls Overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <button
            onClick={() => setZoom(z => Math.min(2.0, z + 0.15))}
            className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded backdrop-blur-sm"
          >
            +
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}
            className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded backdrop-blur-sm"
          >
            -
          </button>
        </div>
      </div>

      {/* Geotechnical Slicer & Cross-Section Controls */}
      <div className="p-3 bg-[#0c1420] border-t border-[#182330] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <span className="text-slate-400 whitespace-nowrap">CROSS-SECTION SLICE DEPTH:</span>
          <input
            type="range"
            min="10"
            max="100"
            value={sliceDepth}
            onChange={(e) => setSliceDepth(Number(e.target.value))}
            className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
          />
          <span className="text-cyan-300 tabular-nums min-w-[38px] text-right">
            {sliceDepth}%
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Rockbolt Integrity: 99.4%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Scan className="w-3.5 h-3.5 text-cyan-400" />
            <span>Resolution: 2.5 mm</span>
          </span>
        </div>
      </div>
    </div>
  );
};
