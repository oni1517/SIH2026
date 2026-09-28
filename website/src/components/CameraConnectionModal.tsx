import React, { useState } from 'react';
import { 
  Camera, 
  Video, 
  CheckCircle2, 
  X, 
  Sparkles, 
  Laptop, 
  ArrowRight, 
  Sliders, 
  RefreshCw,
  AlertCircle,
  Monitor,
  Globe,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Radio
} from 'lucide-react';
import { CameraDeviceInfo, StreamSourceMode } from '../utils/laptopCameraService';
import { sound } from '../utils/audio';

interface CameraConnectionModalProps {
  isOpen: boolean;
  detectedDevice: CameraDeviceInfo | null;
  devices: CameraDeviceInfo[];
  isStreaming: boolean;
  sourceMode?: StreamSourceMode;
  activeLabel?: string;
  isDeviceInUseError?: boolean;
  onStartStream: (deviceId?: string) => Promise<boolean>;
  onStartDisplayStream: () => Promise<boolean>;
  onStartUrlStream: (url: string) => void;
  onStopStream: () => void;
  onClose: () => void;
  onRefreshDevices: () => Promise<void>;
  onSimulateConnect?: (label?: string) => void;
}

type TabType = 'window' | 'direct' | 'url';

export const CameraConnectionModal: React.FC<CameraConnectionModalProps> = ({
  isOpen,
  detectedDevice,
  devices,
  isStreaming,
  sourceMode = 'none',
  activeLabel = '',
  isDeviceInUseError = false,
  onStartStream,
  onStartDisplayStream,
  onStartUrlStream,
  onStopStream,
  onClose,
  onRefreshDevices,
  onSimulateConnect
}) => {
  // If user opened modal or device is in use, 'window' is often the most reliable method for RealSense Viewer users
  const [activeTab, setActiveTab] = useState<TabType>(
    isDeviceInUseError ? 'window' : detectedDevice ? 'direct' : 'window'
  );
  
  // Select first RGB device or detected device
  const defaultDev = detectedDevice?.deviceId || (
    devices.find(d => d.isRealSense && d.isRgbSensor)?.deviceId || 
    devices[0]?.deviceId || 
    ''
  );
  const [selectedId, setSelectedId] = useState<string>(defaultDev);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [customUrl, setCustomUrl] = useState<string>('http://localhost:8080/stream?topic=/camera/color/image_raw');

  if (!isOpen) return null;

  const handleStartDirect = async () => {
    setIsConnecting(true);
    sound.playClick();
    const success = await onStartStream(selectedId || undefined);
    setIsConnecting(false);
    if (success) {
      onClose();
    }
  };

  const handleStartWindowShare = async () => {
    setIsConnecting(true);
    sound.playClick();
    const success = await onStartDisplayStream();
    setIsConnecting(false);
    if (success) {
      onClose();
    }
  };

  const handleStartUrl = () => {
    if (!customUrl.trim()) return;
    sound.playClick();
    onStartUrlStream(customUrl.trim());
    onClose();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    sound.playClick();
    await onRefreshDevices();
    setIsRefreshing(false);
  };

  const hasRealSenseDevice = devices.some(d => d.isRealSense);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-[#0b1320] border-2 border-cyan-500/60 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.3)] overflow-hidden font-mono flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-cyan-950/90 via-[#0e1c2e] to-[#0d1522] border-b border-cyan-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
                  RealSense &amp; Laptop Camera Link
                </h3>
              </div>
              <p className="text-[11px] text-cyan-300/80">
                Show your laptop's RealSense live camera feed on SentinelRover
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Device Locked Warning (when RealSense Viewer is running) */}
        {isDeviceInUseError && (
          <div className="px-5 py-3 bg-amber-950/90 border-b border-amber-500/60 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">RealSense Camera is Locked by Another App</div>
              <div className="text-[11px] text-amber-200/90 leading-relaxed">
                If Intel RealSense Viewer or a Python script is running on your laptop, Windows locks the USB device. 
                Use <b>"Stream RealSense Window"</b> below to capture the live feed straight from your screen without closing your viewer!
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="grid grid-cols-3 border-b border-[#1c2c40] bg-[#070c14] text-xs shrink-0">
          <button
            onClick={() => { sound.playClick(); setActiveTab('window'); }}
            className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold transition-all border-b-2 ${
              activeTab === 'window'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/40 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Monitor className="w-4 h-4 text-cyan-400" />
            <span className="text-center">Stream Window</span>
            <span className="text-[9px] px-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 hidden sm:inline">
              Fastest
            </span>
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('direct'); }}
            className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold transition-all border-b-2 ${
              activeTab === 'direct'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/40 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="text-center">Direct USB Cam</span>
            {hasRealSenseDevice && (
              <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 hidden sm:inline">
                RealSense
              </span>
            )}
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('url'); }}
            className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold transition-all border-b-2 ${
              activeTab === 'url'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/40 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-center">Stream URL / ROS</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* TAB 1: STREAM REALSENSE WINDOW (Recommended) */}
          {activeTab === 'window' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-gradient-to-br from-cyan-950/60 to-[#0a1726] rounded-lg border border-cyan-500/40 space-y-2">
                <div className="flex items-center gap-2 text-cyan-200 font-bold">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span>Stream RealSense Viewer / App Window</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Recommended
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  If you are already viewing your RealSense camera feed on your laptop (inside <b>Intel RealSense Viewer</b>, 
                  <b> ROS RViz / rqt_image_view</b>, a <b>Python script</b>, or <b>Windows Camera</b>), click below to share that window. 
                  It streams the exact video in high-definition (up to 60 FPS) directly to the Rover Camera Feed!
                </p>
              </div>

              <div className="p-4 bg-[#070d16] rounded-lg border border-slate-800 space-y-3">
                <div className="text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    How it works:
                  </div>
                  <ol className="list-decimal list-inside pl-1 space-y-1 text-slate-400 text-[10.5px]">
                    <li>Click <b className="text-cyan-300">"Select RealSense Window"</b> below</li>
                    <li>In the browser popup, choose <b className="text-slate-200">"Window"</b></li>
                    <li>Select your <b className="text-cyan-300">Intel RealSense Viewer</b> or camera app</li>
                    <li>The live feed appears instantly inside the Rover HUD!</li>
                  </ol>
                </div>

                <button
                  onClick={handleStartWindowShare}
                  disabled={isConnecting}
                  className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Monitor className="w-4 h-4" />
                  <span>{isConnecting ? 'Opening Window Selector...' : 'Select RealSense Window to Stream'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT USB CAMERA ACCESS */}
          {activeTab === 'direct' && (
            <div className="space-y-4">
              <div className="p-3 bg-cyan-950/40 rounded-lg border border-cyan-500/30 flex items-start gap-2.5">
                <Laptop className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Direct hardware access lets the browser pull frames directly from your RealSense RGB USB sensor.
                  <span className="block text-slate-400 mt-1 text-[10px]">
                    ⚠️ Note: Close the Intel RealSense Viewer app before connecting directly, as USB cameras cannot be accessed by two programs simultaneously.
                  </span>
                </p>
              </div>

              {/* Device Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <label className="font-semibold flex items-center gap-1.5 text-cyan-300">
                    <Video className="w-3.5 h-3.5" />
                    SELECT CAMERA INPUT DEVICE:
                  </label>

                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
                    title="Scan for connected RealSense and USB cameras"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>Re-scan Devices</span>
                  </button>
                </div>

                {devices.length > 0 ? (
                  <div className="space-y-1.5">
                    {devices.map((dev, idx) => {
                      const isSelected = (selectedId === dev.deviceId) || (!selectedId && idx === 0);
                      return (
                        <div
                          key={dev.deviceId || idx}
                          onClick={() => {
                            sound.playClick();
                            setSelectedId(dev.deviceId);
                          }}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)] text-cyan-200'
                              : 'bg-[#070d16] border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                            <div className="truncate">
                              <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                                <span>{dev.label || `Camera #${idx + 1}`}</span>
                                {dev.isRealSense && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/80 text-cyan-300 border border-cyan-500/40">
                                    {dev.isRgbSensor ? 'RealSense RGB' : 'RealSense Depth/IR'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-slate-400 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>No camera devices enumerated yet. Click "Start Direct Camera Stream" to grant permission.</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleStartDirect}
                disabled={isConnecting}
                className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>{isConnecting ? 'Connecting to Camera...' : 'Start Direct Camera Stream'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 3: LOCAL STREAM URL / ROS BRIDGE */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div className="p-3 bg-cyan-950/40 rounded-lg border border-cyan-500/30 flex items-start gap-2.5">
                <Globe className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  If you run a local streaming server (e.g. ROS <b>web_video_server</b>, Python OpenCV Flask, or RTSP-to-HTTP), 
                  enter the video URL to embed the stream.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5 text-cyan-300">
                  <Radio className="w-3.5 h-3.5" />
                  LOCAL HTTP / MJPEG STREAM URL:
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="http://localhost:8080/stream?topic=/camera/color/image_raw"
                  className="w-full bg-[#070c14] border border-[#1f2d40] focus:border-cyan-500 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono outline-none shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold">Quick Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'http://localhost:8080/stream?topic=/camera/color/image_raw',
                    'http://localhost:5000/video_feed',
                    'http://127.0.0.1:8080/video'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCustomUrl(preset)}
                      className="text-[10px] px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStartUrl}
                className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>Connect to Stream URL</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Capabilities Grid */}
          <div className="grid grid-cols-2 gap-2 text-[10.5px] pt-1">
            <div className="p-2 rounded bg-[#09111c] border border-slate-800/80 text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Full PTZ Gimbal Pan &amp; Tilt</span>
            </div>
            <div className="p-2 rounded bg-[#09111c] border border-slate-800/80 text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Digital Spotlight Grade Filter</span>
            </div>
            <div className="p-2 rounded bg-[#09111c] border border-slate-800/80 text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Real-Time Edge Telemetry HUD</span>
            </div>
            <div className="p-2 rounded bg-[#09111c] border border-slate-800/80 text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>PNG Evidence Snapshot Tool</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#080d16] border-t border-[#182330] flex items-center justify-between shrink-0">
          {isStreaming ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="truncate max-w-[200px]">Active: {activeLabel || 'Live Feed'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {onSimulateConnect && (
                <button
                  type="button"
                  onClick={() => {
                    onSimulateConnect('Intel(R) RealSense(TM) Depth Camera D435 RGB');
                  }}
                  className="text-[10px] text-slate-400 hover:text-amber-300 underline"
                  title="Simulate RealSense Plug Event"
                >
                  Test RealSense Plug-in
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            {isStreaming && (
              <button
                onClick={() => {
                  sound.playClick();
                  onStopStream();
                }}
                className="px-3 py-1.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-xs transition-colors cursor-pointer"
              >
                Disconnect Stream
              </button>
            )}

            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
