import React, { useRef, useEffect, useState } from 'react';
import { RobotState } from '../types';
import { 
  Camera, 
  Lightbulb, 
  ZoomIn, 
  ZoomOut, 
  ShieldCheck, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  Video,
  Laptop,
  Radio,
  SlidersHorizontal,
  AlertTriangle,
  RefreshCw,
  Power,
  Monitor,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Globe,
  Battery,
  BatteryMedium,
  BatteryLow,
  ArrowDown
} from 'lucide-react';
import { sound } from '../utils/audio';
import { useLaptopCamera } from '../utils/useLaptopCamera';
import { CameraConnectionModal } from './CameraConnectionModal';

interface RobotCameraFeedProps {
  robot: RobotState;
  onUpdateRobot: (updater: (prev: RobotState) => RobotState) => void;
  onLogEvent: (source: 'ROBOT', message: string, type: 'info' | 'warn' | 'error' | 'success') => void;
}

export const RobotCameraFeed: React.FC<RobotCameraFeedProps> = ({
  robot,
  onUpdateRobot,
  onLogEvent
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const urlImgRef = useRef<HTMLImageElement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  // Hook for laptop webcam / RealSense / Window stream & plug detection
  const {
    isStreaming,
    stream,
    sourceMode,
    streamUrl,
    activeLabel,
    devices,
    selectedDeviceId,
    error: cameraError,
    isDeviceInUseError,
    hasRealSense,
    detectedPromptDevice,
    startStream,
    startDisplayStream,
    startUrlStream,
    stopStream,
    refreshDevices,
    dismissDetectedPrompt,
    simulateConnect,
    clearError
  } = useLaptopCamera();

  // Keep hidden video element synced with MediaStream
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && (sourceMode === 'camera' || sourceMode === 'display')) {
      videoEl.srcObject = stream;
      setIsVideoReady(false);

      const handlePlaying = () => {
        setIsVideoReady(true);
        if (videoEl.videoWidth && videoEl.videoHeight) {
          setVideoDimensions({ width: videoEl.videoWidth, height: videoEl.videoHeight });
        }
      };

      videoEl.addEventListener('loadeddata', handlePlaying);
      videoEl.addEventListener('playing', handlePlaying);

      videoEl.play().catch(err => {
        console.warn('[Camera] Autoplay suppressed or pending user gesture:', err);
      });

      return () => {
        videoEl.removeEventListener('loadeddata', handlePlaying);
        videoEl.removeEventListener('playing', handlePlaying);
      };
    } else {
      videoEl.srcObject = null;
      setIsVideoReady(false);
      setVideoDimensions(null);
    }
  }, [stream, sourceMode]);

  // Log streaming state changes to event log
  useEffect(() => {
    if (isStreaming) {
      const modeDesc = sourceMode === 'display' 
        ? 'RealSense App Window Stream' 
        : sourceMode === 'url' 
        ? `Local Video Stream (${streamUrl})`
        : `Connected Camera Device (${activeLabel})`;

      onLogEvent('ROBOT', `Live video streaming initiated: ${modeDesc}`, 'success');
    }
  }, [isStreaming, sourceMode, activeLabel, streamUrl]);

  // Automatically open modal when a new device is plugged into the laptop
  useEffect(() => {
    if (detectedPromptDevice) {
      setIsModalOpen(true);
      onLogEvent(
        'ROBOT', 
        `Hardware camera plugged into laptop: ${detectedPromptDevice.label} ${detectedPromptDevice.isRealSense ? '[Intel RealSense]' : ''}`, 
        'warn'
      );
    }
  }, [detectedPromptDevice]);

  // Canvas rendering loop: draws live camera feed (camera/display/url) or simulated mine optics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let tick = 0;

    const render = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;

      // Base background
      ctx.fillStyle = '#030508';
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2 + robot.cameraPan * 2.5;
      const cy = h / 2 + robot.cameraTilt * 2.5;
      const zoom = robot.zoomLevel;

      ctx.save();
      // Apply PTZ Gimbal Pan, Tilt, and Optical Zoom
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);

      const videoEl = videoRef.current;
      const urlImgEl = urlImgRef.current;
      const hasLiveVideo = isStreaming && (sourceMode === 'camera' || sourceMode === 'display') && videoEl && isVideoReady;
      const hasUrlStream = isStreaming && sourceMode === 'url' && urlImgEl && urlImgEl.complete && urlImgEl.naturalWidth > 0;

      if (hasLiveVideo || hasUrlStream) {
        // ================= LIVE VIDEO FEED RENDERING =================
        try {
          const vw = hasLiveVideo ? (videoEl!.videoWidth || 640) : (urlImgEl!.naturalWidth || 640);
          const vh = hasLiveVideo ? (videoEl!.videoHeight || 360) : (urlImgEl!.naturalHeight || 360);

          // Fill canvas preserving aspect ratio
          const scale = Math.max(w / vw, h / vh);
          const dw = vw * scale;
          const dh = vh * scale;
          const dx = (w - dw) / 2;
          const dy = (h - dh) / 2;

          // Dynamic floodlight lighting enhancement filter
          if (robot.spotlightOn) {
            ctx.filter = 'brightness(1.22) contrast(1.18) saturate(1.1)';
          } else {
            ctx.filter = 'brightness(0.98) contrast(1.06)';
          }

          if (hasLiveVideo) {
            ctx.drawImage(videoEl!, dx, dy, dw, dh);
          } else if (hasUrlStream) {
            ctx.drawImage(urlImgEl!, dx, dy, dw, dh);
          }

          ctx.filter = 'none';

          // Spotlight illumination beam overlay on live video
          if (robot.spotlightOn) {
            const beamGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 360);
            beamGrad.addColorStop(0, 'rgba(255, 255, 230, 0.12)');
            beamGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.05)');
            beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
            ctx.fillStyle = beamGrad;
            ctx.fillRect(0, 0, w, h);
          }
        } catch {
          // Momentary frame skip
        }
      } else if (isStreaming && !isVideoReady && sourceMode !== 'none') {
        // Connecting state on canvas
        ctx.fillStyle = '#060c14';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('INITIALIZING REALSENSE VIDEO PIPELINE...', w / 2, h / 2 - 10);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px monospace';
        ctx.fillText('Synchronizing WebRTC frames with camera sensor...', w / 2, h / 2 + 15);
      } else {
        // ================= SIMULATED ROVER TUNNEL OPTICS =================
        const lightRadius = robot.spotlightOn ? 380 : 180;
        const lightGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, lightRadius);
        lightGrad.addColorStop(0, robot.spotlightOn ? '#475569' : '#1e293b');
        lightGrad.addColorStop(0.45, robot.spotlightOn ? '#1e293b' : '#0f172a');
        lightGrad.addColorStop(0.85, '#080d14');
        lightGrad.addColorStop(1, '#030508');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(0, 0, w, h);

        // Tunnel Rock Contour rings
        ctx.strokeStyle = '#273544';
        ctx.lineWidth = 1.4;
        for (let i = 1; i <= 6; i++) {
          const r = i * 50;
          ctx.beginPath();
          ctx.strokeRect(cx - r, cy - r * 0.65, r * 2, r * 1.3);
        }

        // Overhead ventilation duct & cables
        ctx.strokeStyle = '#1e2d3d';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 140, cy - 80);
        ctx.lineTo(0, cy - 140);
        ctx.stroke();

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 80, cy - 70);
        ctx.lineTo(w, cy - 120);
        ctx.stroke();

        // Subterranean Ground Rails & Ties
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 35, cy + 50); ctx.lineTo(cx - 190, h);
        ctx.moveTo(cx + 35, cy + 50); ctx.lineTo(cx + 190, h);
        ctx.stroke();

        // Cross ties
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const y = cy + 60 + i * 24;
          const spread = (y - cy) * 1.6;
          ctx.beginPath();
          ctx.moveTo(cx - spread, y);
          ctx.lineTo(cx + spread, y);
          ctx.stroke();
        }

        // Floating subterranean dust & particulate motes
        ctx.fillStyle = robot.spotlightOn ? 'rgba(255, 255, 255, 0.45)' : 'rgba(148, 163, 184, 0.25)';
        for (let i = 0; i < 28; i++) {
          const px = (cx + Math.sin(i * 137.5 + tick * 0.02) * 230) % w;
          const py = (cy + Math.cos(i * 93.1 + tick * 0.03) * 170) % h;
          ctx.beginPath();
          ctx.arc(px, py, (i % 3) * 0.6 + 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // CRT Scanline Overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [robot.spotlightOn, robot.zoomLevel, robot.cameraPan, robot.cameraTilt, isStreaming, isVideoReady, sourceMode]);

  const handlePanTilt = (deltaPan: number, deltaTilt: number) => {
    sound.playClick();
    onUpdateRobot(prev => ({
      ...prev,
      cameraPan: Math.max(-45, Math.min(45, prev.cameraPan + deltaPan)),
      cameraTilt: Math.max(-30, Math.min(30, prev.cameraTilt + deltaTilt))
    }));
  };

  const handleResetPTZ = () => {
    sound.playClick();
    onUpdateRobot(prev => ({
      ...prev,
      cameraPan: 0,
      cameraTilt: 0,
      zoomLevel: 1.0
    }));
  };

  const handleZoom = (delta: number) => {
    sound.playClick();
    onUpdateRobot(prev => ({
      ...prev,
      zoomLevel: Math.max(1.0, Math.min(3.5, +(prev.zoomLevel + delta).toFixed(1)))
    }));
  };

  const handleToggleSpotlight = () => {
    sound.playClick();
    onUpdateRobot(prev => {
      const nextState = !prev.spotlightOn;
      onLogEvent('ROBOT', `Auxiliary floodlights ${nextState ? 'ENGAGED' : 'DISENGAGED'}`, 'info');
      return { ...prev, spotlightOn: nextState };
    });
  };

  const handleSnapshot = () => {
    sound.playSuccess();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `SENTINEL_REALSENSE_${Date.now()}.png`;
    a.click();
    onLogEvent(
      'ROBOT', 
      `High-resolution ${isStreaming ? 'RealSense live feed' : 'synthetic inspection'} frame captured and archived`, 
      'success'
    );
  };

  return (
    <div className="bg-[#090f17] rounded-lg border border-[#1a2533] overflow-hidden shadow-xl flex flex-col relative">
      {/* Hidden Video Element receiving WebRTC camera or screen stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* Hidden Image element for local MJPEG stream */}
      {sourceMode === 'url' && streamUrl && (
        <img
          ref={urlImgRef}
          src={streamUrl}
          alt="Local MJPEG stream"
          className="hidden"
          crossOrigin="anonymous"
        />
      )}

      {/* Pop-up Modal when Camera is connected to laptop */}
      <CameraConnectionModal
        isOpen={isModalOpen}
        detectedDevice={detectedPromptDevice}
        devices={devices}
        isStreaming={isStreaming}
        sourceMode={sourceMode}
        activeLabel={activeLabel}
        isDeviceInUseError={isDeviceInUseError}
        onStartStream={async (id) => {
          return await startStream(id);
        }}
        onStartDisplayStream={async () => {
          return await startDisplayStream();
        }}
        onStartUrlStream={(url) => {
          startUrlStream(url);
        }}
        onStopStream={stopStream}
        onClose={() => {
          setIsModalOpen(false);
          dismissDetectedPrompt();
        }}
        onRefreshDevices={refreshDevices}
        onSimulateConnect={simulateConnect}
      />

      {/* Camera Error / Device-in-use Banner */}
      {cameraError && (
        <div className="bg-rose-950/95 border-b border-rose-500/60 px-4 py-2.5 text-xs font-mono text-rose-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{cameraError}</span>
          </div>
          <div className="flex items-center gap-2">
            {isDeviceInUseError && (
              <button
                onClick={async () => {
                  clearError();
                  await startDisplayStream();
                }}
                className="px-2.5 py-1 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[11px] shadow flex items-center gap-1 cursor-pointer"
              >
                <Monitor className="w-3.5 h-3.5" />
                Stream RealSense Window Instead
              </button>
            )}
            <button
              onClick={clearError}
              className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-300 text-[11px] border border-rose-500/40 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Persistent Camera Detection Alert Toast */}
      {detectedPromptDevice && !isModalOpen && !isStreaming && (
        <div className="bg-cyan-950/95 border-b border-cyan-500/60 px-4 py-2 text-xs font-mono text-cyan-200 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              RealSense / Camera Plugged In: <b>{detectedPromptDevice.label}</b>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 cursor-pointer"
            >
              <Video className="w-3 h-3" />
              Stream Live Feed
            </button>
            <button
              onClick={dismissDetectedPrompt}
              className="text-slate-400 hover:text-slate-200 text-[11px] px-1.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Feed Header - Single Primary Camera Feed */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-[#0c1420] border-b border-[#182330]">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
          <h2 className="text-xs font-mono font-bold tracking-wider text-slate-100 flex items-center gap-2 flex-wrap">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            <span>BOT-01 REALSENSE ROVER FEED</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
              isStreaming 
                ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/50' 
                : 'text-amber-400 bg-amber-950/60 border-amber-500/30'
            }`}>
              {isStreaming 
                ? (sourceMode === 'display' ? 'LIVE REALSENSE WINDOW' : sourceMode === 'url' ? 'LIVE LOCAL URL' : 'LIVE REALSENSE USB') 
                : 'SYNTHETIC OPTICS'}
            </span>
          </h2>
        </div>

        {/* Action Controls for RealSense video feed */}
        <div className="flex items-center gap-1.5 text-xs font-mono flex-wrap">
          {/* Quick Option 1: Stream RealSense Window (Ideal for users with RealSense Viewer open) */}
          <button
            onClick={async () => {
              if (isStreaming && sourceMode === 'display') {
                stopStream();
              } else {
                await startDisplayStream();
              }
            }}
            className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 cursor-pointer ${
              isStreaming && sourceMode === 'display'
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/70 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50 hover:bg-cyan-900/60'
            }`}
            title="Stream whatever RealSense Viewer or app window is running on your laptop"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">
              {isStreaming && sourceMode === 'display' ? 'Window: LIVE' : 'Stream RealSense Window'}
            </span>
            <span className="sm:hidden">Window</span>
          </button>

          {/* Quick Option 2: Direct RealSense USB Webcam */}
          <button
            onClick={async () => {
              if (isStreaming && sourceMode === 'camera') {
                stopStream();
              } else {
                await startStream();
              }
            }}
            className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 cursor-pointer ${
              isStreaming && sourceMode === 'camera'
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/70 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-cyan-300'
            }`}
            title="Direct Hardware USB Camera Capture"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">
              {isStreaming && sourceMode === 'camera' ? 'USB Cam: LIVE' : 'Direct USB'}
            </span>
            <span className="sm:hidden">USB</span>
          </button>

          {/* Configuration Modal Trigger */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-cyan-300 border border-slate-800 transition-colors cursor-pointer"
            title="Open Camera Options &amp; RealSense Device Manager"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Spotlight Toggle */}
          <button
            onClick={handleToggleSpotlight}
            className={`px-2 py-1 rounded border transition-colors flex items-center gap-1.5 cursor-pointer ${
              robot.spotlightOn
                ? 'bg-yellow-950/60 text-yellow-300 border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.3)]'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle High-Lumen Cavern Spotlight"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{robot.spotlightOn ? 'Light ON' : 'Light OFF'}</span>
          </button>

          {/* Snapshot Button */}
          <button
            onClick={handleSnapshot}
            className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
            title="Capture HD PNG Frame"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Video Viewport Canvas */}
      <div className="relative aspect-video w-full bg-black select-none overflow-hidden">
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="w-full h-full object-cover block"
        />

        {/* HUD Overlay - Corner Targeting Brackets */}
        <div className="pointer-events-none absolute inset-4 border border-cyan-500/25 flex flex-col justify-between">
          <div className="flex justify-between">
            <div className="w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
            <div className="w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
          </div>
          <div className="flex justify-between">
            <div className="w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
            <div className="w-3 h-3 border-b-2 border-r-2 border-cyan-400" />
          </div>
        </div>

        {/* Center Reticle Crosshair */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-12 h-12 flex items-center justify-center opacity-80">
            <div className="absolute w-12 h-[1px] bg-cyan-400/50" />
            <div className="absolute h-12 w-[1px] bg-cyan-400/50" />
            <div className="w-6 h-6 rounded-full border border-cyan-400/60" />
            <div className="w-1 h-1 rounded-full bg-cyan-400 animate-ping" />
          </div>
        </div>

        {/* Top Left HUD Telemetry Info */}
        <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-300 bg-black/60 backdrop-blur-xs px-2.5 py-1.5 rounded border border-cyan-500/30 space-y-0.5 pointer-events-none">
          <div className="flex items-center gap-1.5 font-bold">
            <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
            <span>OPTICAL SENSOR: {isStreaming ? activeLabel : 'SIMULATED OPTICS'}</span>
          </div>
          <div className="text-slate-300">
            DEPTH: <b className="text-emerald-400">-{robot.depthMeters}m</b> · DRIFT LEVEL 3
          </div>
          <div className="text-slate-300">
            PTZ: PAN {robot.cameraPan > 0 ? `+${robot.cameraPan}` : robot.cameraPan}° · TILT {robot.cameraTilt > 0 ? `+${robot.cameraTilt}` : robot.cameraTilt}° · ZOOM {robot.zoomLevel.toFixed(1)}x
          </div>
          {videoDimensions && isStreaming && (
            <div className="text-cyan-400/90 text-[9px]">
              SOURCE: {videoDimensions.width}x{videoDimensions.height} @ 60 FPS
            </div>
          )}
        </div>

        {/* Top Right HUD Mode & Environmental Warning */}
        <div className="absolute top-2 right-2 text-[10px] font-mono text-right space-y-1 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-xs px-2 py-1 rounded border border-cyan-500/30 text-cyan-300">
            FPS: <b className="text-emerald-400">59.8</b> · LATENCY: <b className="text-emerald-400">{isStreaming ? '12ms' : '0ms'}</b>
          </div>
          {robot.spotlightOn && (
            <div className="bg-yellow-950/80 px-2 py-0.5 rounded border border-yellow-500/50 text-yellow-300 font-bold text-[9px]">
              FLOODLIGHT 4200lm ACTIVE
            </div>
          )}
        </div>

        {/* PTZ Pan/Tilt Directional Navpad Overlay (Bottom Right) */}
        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm p-1.5 rounded-lg border border-cyan-500/40 flex flex-col items-center gap-1 shadow-lg">
          <div className="text-[9px] font-mono text-cyan-300/80 font-bold uppercase tracking-wider">
            Gimbal PTZ
          </div>
          <div className="grid grid-cols-3 gap-1">
            <div />
            <button
              onClick={() => handlePanTilt(0, 5)}
              className="w-7 h-7 rounded bg-slate-900/90 hover:bg-cyan-900/60 text-slate-300 hover:text-cyan-200 border border-slate-700/80 flex items-center justify-center cursor-pointer transition-colors"
              title="Tilt Up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <div />
            <button
              onClick={() => handlePanTilt(-5, 0)}
              className="w-7 h-7 rounded bg-slate-900/90 hover:bg-cyan-900/60 text-slate-300 hover:text-cyan-200 border border-slate-700/80 flex items-center justify-center cursor-pointer transition-colors"
              title="Pan Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetPTZ}
              className="w-7 h-7 rounded bg-slate-900/90 hover:bg-slate-800 text-[9px] font-mono text-cyan-400 border border-slate-700/80 flex items-center justify-center cursor-pointer"
              title="Center PTZ Gimbal"
            >
              CTR
            </button>
            <button
              onClick={() => handlePanTilt(5, 0)}
              className="w-7 h-7 rounded bg-slate-900/90 hover:bg-cyan-900/60 text-slate-300 hover:text-cyan-200 border border-slate-700/80 flex items-center justify-center cursor-pointer transition-colors"
              title="Pan Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div />
            <button
              onClick={() => handlePanTilt(0, -5)}
              className="w-7 h-7 rounded bg-slate-900/90 hover:bg-cyan-900/60 text-slate-300 hover:text-cyan-200 border border-slate-700/80 flex items-center justify-center cursor-pointer transition-colors"
              title="Tilt Down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <div />
          </div>
        </div>

        {/* Optical Zoom Level Controls Overlay (Bottom Left) */}
        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1.5 rounded-lg border border-cyan-500/40 flex items-center gap-1.5 shadow-lg">
          <button
            onClick={() => handleZoom(-0.2)}
            disabled={robot.zoomLevel <= 1.0}
            className="p-1 rounded bg-slate-900/90 hover:bg-cyan-900/60 text-slate-300 disabled:opacity-40 border border-slate-700/80 cursor-pointer"
            title="Optical Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-bold text-cyan-300 min-w-[36px] text-center">
            {robot.zoomLevel.toFixed(1)}x
          </span>
          <button
            onClick={() => handleZoom(0.2)}
            disabled={robot.zoomLevel >= 3.5}
            className="p-1 rounded bg-slate-900/90 hover:bg-cyan-900/60 text-slate-300 disabled:opacity-40 border border-slate-700/80 cursor-pointer"
            title="Optical Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Helpful RealSense Quick-Helper Banner at the bottom */}
      {!isStreaming && (
        <div className="bg-[#0b1420] border-t border-[#182330] px-4 py-2 text-[11px] font-mono text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Seeing your RealSense feed on laptop? Click <b className="text-cyan-300">"Stream RealSense Window"</b> above to show it here instantly!
            </span>
          </div>
          <button
            onClick={async () => {
              await startDisplayStream();
            }}
            className="px-2.5 py-0.5 rounded bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold text-[10.5px] transition-colors cursor-pointer flex items-center gap-1"
          >
            <Monitor className="w-3 h-3" />
            <span>Start Stream</span>
          </button>
        </div>
      )}
    </div>
  );
};
