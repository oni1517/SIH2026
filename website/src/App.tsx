/**
 * Underground Mine Command Center
 * Autonomous Safety & Robotic Inspection Platform
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  SensorNode, 
  RobotState, 
  AlertItem, 
  EventLogItem, 
  HistoryPoint, 
  ActiveTab 
} from './types';
import { 
  INITIAL_NODES, 
  INITIAL_ROBOT, 
  ROBOT_WAYPOINTS, 
  INITIAL_ALERTS, 
  INITIAL_EVENTS, 
  generateSeedHistory 
} from './mockData';
import { sound } from './utils/audio';
import { mqttService, MqttStatus } from './utils/mqttService';

// Components
import { TopNav } from './components/TopNav';
import { TacticalStatusBar } from './components/TacticalStatusBar';
import { MineMap } from './components/MineMap';
import { RobotCameraFeed } from './components/RobotCameraFeed';
import { LidarReconstruction } from './components/LidarReconstruction';
import { SensorNodeGrid } from './components/SensorNodeGrid';
import { NodeDetailModal } from './components/NodeDetailModal';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { AlertsManager } from './components/AlertsManager';
import { SystemArchitecture } from './components/SystemArchitecture';
import { EventLogPanel } from './components/EventLogPanel';
import { SimulationControlsModal } from './components/SimulationControlsModal';
import { GeminiSafetyAssistant } from './components/GeminiSafetyAssistant';
import { CameraConnectionModal } from './components/CameraConnectionModal';
import { useLaptopCamera } from './utils/useLaptopCamera';

import { 
  ShieldAlert, 
  Flame, 
  Bot, 
  Layers, 
  Radar, 
  Cpu, 
  Radio, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Maximize2,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [nodes, setNodes] = useState<SensorNode[]>(INITIAL_NODES);
  const [robot, setRobot] = useState<RobotState>(INITIAL_ROBOT);
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [events, setEvents] = useState<EventLogItem[]>(INITIAL_EVENTS);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedNode, setSelectedNode] = useState<SensorNode | null>(null);
  const [pulseNodeId, setPulseNodeId] = useState<string | null>(null);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [packetRate, setPacketRate] = useState<number>(26);
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>(mqttService.status);

  // Real-time MQTT Live Integration (HiveMQ WebSockets <-> ESP32 SentinelRover)
  useEffect(() => {
    mqttService.connect();
    const unsubStatus = mqttService.onStatusChange(st => setMqttStatus(st));
    const unsubMsg = mqttService.onMessage((topic, payload) => {
      if (topic === 'mine/node/telemetry' && typeof payload === 'object' && payload !== null) {
        const { nodeId, temp, humidity, gas, vibration, light, motion, calibrated, status } = payload;
        const idToMatch = nodeId || 'NODE-SRF-01';
        setNodes(prev => prev.map(n => {
          if (n.id === idToMatch || n.name === idToMatch || (idToMatch === 'NODE-SRF-01' && n.id === '01')) {
            return {
              ...n,
              temp: typeof temp === 'number' ? temp : n.temp,
              hum: typeof humidity === 'number' ? humidity : n.hum,
              gas: typeof gas === 'number' ? gas : n.gas,
              vibration: typeof vibration === 'number' ? vibration : n.vibration,
              light: typeof light === 'number' ? light : n.light,
              pirMotion: motion === 1 || motion === true,
              calibrated: calibrated ?? n.calibrated,
              status: status || (gas > 400 ? 'critical' : gas > 150 ? 'warning' : 'normal'),
              lastSeenSec: 0
            };
          }
          return n;
        }));
        setPulseNodeId(idToMatch === 'NODE-SRF-01' ? '01' : idToMatch);
      } else if (topic === 'mine/node/status' && typeof payload === 'object' && payload !== null) {
        const { nodeId, status } = payload;
        setNodes(prev => prev.map(n => {
          if (n.id === nodeId || n.name === nodeId || (nodeId === 'NODE-SRF-01' && n.id === '01')) {
            return { ...n, status: status === 'online' ? 'normal' : 'offline' };
          }
          return n;
        }));
        addEvent('MQTT', `Node [${nodeId}] reported status: ${status?.toUpperCase()}`, status === 'online' ? 'success' : 'warn');
      } else if (topic === 'mine/node/calibration/result') {
        addEvent('MQTT', `Zero-offset calibration baseline confirmed by Node ${payload?.nodeId || 'ESP32'} (R0: ${payload?.R0 || 'calibrated'} Ω)`, 'success');
        sound.playSuccess();
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, []);

  // Histories database for all 10 nodes
  const [histories, setHistories] = useState<Record<string, HistoryPoint[]>>(() => {
    const map: Record<string, HistoryPoint[]> = {};
    INITIAL_NODES.forEach(n => {
      map[n.id] = generateSeedHistory(n.temp, n.gas, n.hum);
    });
    return map;
  });

  // Rover waypoint tracking indices
  const waypointIdxRef = useRef(0);
  const waypointProgRef = useRef(0);

  const addEvent = (source: EventLogItem['source'], message: string, type: EventLogItem['type'] = 'info') => {
    const newEv: EventLogItem = {
      id: `ev-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      source,
      message,
      type
    };
    setEvents(prev => [newEv, ...prev].slice(0, 80));
  };

  // Global Laptop Camera integration and hardware connect detection
  const {
    isStreaming: isCameraStreaming,
    sourceMode: cameraSourceMode,
    activeLabel: cameraActiveLabel,
    devices: cameraDevices,
    detectedPromptDevice,
    isDeviceInUseError: isCameraInUseError,
    startStream: startCameraStream,
    startDisplayStream: startCameraDisplayStream,
    startUrlStream: startCameraUrlStream,
    stopStream: stopCameraStream,
    refreshDevices: refreshCameraDevices,
    dismissDetectedPrompt,
    simulateConnect: simulateCameraConnect
  } = useLaptopCamera();
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Trigger popup when a new camera is plugged into the laptop
  useEffect(() => {
    if (detectedPromptDevice) {
      setIsCameraModalOpen(true);
      addEvent('ROBOT', `Video capture device plugged into laptop: ${detectedPromptDevice.label}`, 'warn');
    }
  }, [detectedPromptDevice]);

  const handleStartCameraStream = async (deviceId?: string) => {
    const success = await startCameraStream(deviceId);
    if (success) {
      setIsCameraModalOpen(false);
      dismissDetectedPrompt();
      if (activeTab !== 'overview' && activeTab !== 'robot') {
        setActiveTab('overview');
      }
      addEvent('ROBOT', 'Laptop camera feed engaged on BOT-01 primary inspection display', 'success');
      return true;
    }
    return false;
  };

  const handleStartDisplayStream = async () => {
    const success = await startCameraDisplayStream();
    if (success) {
      setIsCameraModalOpen(false);
      dismissDetectedPrompt();
      if (activeTab !== 'overview' && activeTab !== 'robot') {
        setActiveTab('overview');
      }
      addEvent('ROBOT', 'RealSense app window streaming engaged on BOT-01 inspection display', 'success');
      return true;
    }
    return false;
  };

  const handleStartUrlStream = (url: string) => {
    startCameraUrlStream(url);
    setIsCameraModalOpen(false);
    dismissDetectedPrompt();
    if (activeTab !== 'overview' && activeTab !== 'robot') {
      setActiveTab('overview');
    }
    addEvent('ROBOT', `Local video stream engaged: ${url}`, 'success');
  };

  const addAlert = (
    severity: AlertItem['severity'],
    title: string,
    description: string,
    zone: string,
    nodeId?: string,
    protocolAction?: string,
    trend: AlertItem['trend'] = 'stable',
    trendRate?: string
  ) => {
    if (severity === 'critical') {
      sound.playCritical();
    } else if (severity === 'warning') {
      sound.playWarning();
    }

    const newAlt: AlertItem = {
      id: `alt-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      severity,
      title,
      description,
      zone,
      nodeId,
      acknowledged: false,
      resolved: false,
      protocolAction,
      trend,
      trendRate
    };
    setAlerts(prev => [newAlt, ...prev]);
  };

  // Real-time Telemetry Simulation Loop
  useEffect(() => {
    if (isPaused) return;

    const intervalMs = Math.max(400, 2000 / simSpeed);

    const timer = setInterval(() => {
      // 1. Move Rover along waypoints
      setRobot(prev => {
        if (prev.status === 'standby' || prev.status === 'e-stop') return prev;

        waypointProgRef.current += 0.04 * simSpeed;
        const pts = ROBOT_WAYPOINTS;
        let curIdx = waypointIdxRef.current;
        let nextIdx = (curIdx + 1) % pts.length;

        if (waypointProgRef.current >= 1) {
          waypointProgRef.current = 0;
          waypointIdxRef.current = nextIdx;
          curIdx = nextIdx;
          nextIdx = (nextIdx + 1) % pts.length;
        }

        const p1 = pts[curIdx];
        const p2 = pts[nextIdx];
        const prog = waypointProgRef.current;

        const curX = p1.x + (p2.x - p1.x) * prog;
        const curY = p1.y + (p2.y - p1.y) * prog;
        const curDepth = Math.round(p1.depth + (p2.depth - p1.depth) * prog);

        // Heading angle in degrees
        const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI + 90;

        const pointsIncrement = Math.floor((300 + Math.random() * 200) * simSpeed);

        return {
          ...prev,
          x: +curX.toFixed(1),
          y: +curY.toFixed(1),
          depthMeters: curDepth,
          heading: (angle + 360) % 360,
          currentWaypoint: p2.name,
          distanceTraveledMeters: prev.distanceTraveledMeters + Math.round(1.5 * simSpeed),
          runtimeSeconds: prev.runtimeSeconds + 2,
          battery: Math.max(12, +(prev.battery - 0.01 * simSpeed).toFixed(1)),
          signalStrength: Math.max(45, Math.min(99, Math.round(97 - (curDepth / 460) * 16 + (Math.random() - 0.5) * 3))),
          lidarPointsCaptured: prev.lidarPointsCaptured + pointsIncrement,
          mapCoveragePct: Math.min(100, +(prev.mapCoveragePct + 0.04 * simSpeed).toFixed(1))
        };
      });

      // 2. Telemetry Jitter for Sensor Nodes & Trend Velocity Computation
      setNodes(prev => {
        return prev.map(n => {
          if (n.status === 'offline') {
            return { ...n, lastSeenSec: n.lastSeenSec + 2 };
          }

          const noiseT = (Math.random() - 0.5) * 0.3;
          const noiseG = (Math.random() - 0.5) * 2;
          const noiseH = (Math.random() - 0.5) * 0.6;

          const updatedTemp = +(n.temp + noiseT).toFixed(1);
          const updatedGas = Math.max(20, Math.round(n.gas + noiseG));
          const updatedHum = Math.min(100, Math.max(20, Math.round(n.hum + noiseH)));
          const updatedBatt = Math.max(5, +(n.battery - 0.005).toFixed(1));

          // Compute trend velocity
          const gasDelta = updatedGas - n.gas;
          let gasTrend: 'rising' | 'falling' | 'stable' = n.gasTrend || 'stable';
          let gasRate = n.gasRate || '±0.0';

          if (gasDelta > 0.8) {
            gasTrend = 'rising';
            gasRate = `+${(gasDelta * 1.8).toFixed(1)} ppm/m`;
          } else if (gasDelta < -0.8) {
            gasTrend = 'falling';
            gasRate = `-${(Math.abs(gasDelta) * 1.8).toFixed(1)} ppm/m`;
          }

          return {
            ...n,
            temp: updatedTemp,
            gas: updatedGas,
            hum: updatedHum,
            battery: updatedBatt,
            lastSeenSec: 1,
            gasTrend,
            gasRate
          };
        });
      });

      // 3. Update time series histories
      const nowStr = new Date().toLocaleTimeString([], { hour12: false });
      setHistories(prev => {
        const next = { ...prev };
        nodes.forEach(n => {
          if (n.status === 'offline') return;
          const currentList = next[n.id] ? [...next[n.id]] : [];
          currentList.push({
            time: nowStr,
            temp: n.temp,
            gas: n.gas,
            hum: n.hum,
            battery: n.battery,
            co: n.co
          });
          if (currentList.length > 30) currentList.shift();
          next[n.id] = currentList;
        });
        return next;
      });

      // 4. Jitter packet rate
      setPacketRate(22 + Math.floor(Math.random() * 8));

    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPaused, simSpeed, nodes]);

  // Scenario Injection Handlers
  const handleInjectGasLeak = () => {
    setNodes(prev => prev.map(n => {
      if (n.id === '08') {
        return { ...n, gas: 228, status: 'critical', temp: 36.8 };
      }
      return n;
    }));
    setPulseNodeId('08');
    addAlert(
      'critical',
      'Methane Cavity Rupture - 228 ppm CH₄',
      'Explosive limit warning: CH₄ concentration in Tunnel D · Zone 2 surpassed 200 ppm (1.0% LEL). Immediate evacuation required.',
      'Tunnel D · Zone 2',
      '08',
      'Activate Level 2 emergency sirens, boost main exhaust fan #3 to 100%, and isolate subterranean electrical substation #4.',
      'rising',
      '+28 ppm/min (Rapid Surge)'
    );
    addEvent('SENSOR_MESH', 'Node 08 triggered CRITICAL gas ceiling violation (228 ppm > 200 ppm threshold)', 'error');
  };

  const handleInjectRoverFault = () => {
    setRobot(prev => ({
      ...prev,
      battery: 18,
      status: 'standby',
      speed: 0,
      aiDetections: [
        {
          label: 'Unclassified Rockfall Debris Obstruction',
          confidence: 0.96,
          severity: 'danger',
          box: [20, 30, 60, 45]
        }
      ]
    }));
    addAlert(
      'warning',
      'Rover Track Obstacle & Low Battery (18%)',
      'BOT-01 halted patrol autonomously after LIDAR detected rockfall obstruction across haulage drift at WP-03.',
      'Tunnel B · Primary Crusher',
      undefined,
      'Dispatch maintenance crew with scaling bar or command rover to reverse return to Portal charging bay.',
      'falling',
      'Speed 0.0 m/s (Halt)'
    );
    addEvent('ROBOT', 'BOT-01 autonomous halt: Rockfall debris detected on track with 96% AI confidence', 'warn');
  };

  const handleInjectCommDrop = () => {
    setNodes(prev => prev.map(n => {
      if (n.id === '09' || n.id === '10') {
        return { ...n, status: 'offline', lastSeenSec: 999 };
      }
      return n;
    }));
    addAlert(
      'critical',
      'LoRa Subterranean Mesh Repeater Offline',
      'Nodes 09 & 10 in Tunnel E uncontactable for > 15 minutes. Potential fiber severance or rockfall on repeater conduit.',
      'Tunnel E · Exhaust Shaft',
      '09',
      'Re-route telemetry via BOT-01 mobile Wi-Fi bridge.',
      'spike',
      'Loss 100% (Dropout)'
    );
    addEvent('MASTER', 'Repeater link lost for Tunnel E drifts. 2 nodes dropped from MQTT mesh.', 'error');
  };

  const handleResetBaseline = () => {
    setNodes(INITIAL_NODES);
    setRobot(INITIAL_ROBOT);
    setAlerts(INITIAL_ALERTS);
    setIsEmergencyActive(false);
    setPulseNodeId(null);
    addEvent('OPERATOR', 'Subterranean telemetry and robotic patrol reset to nominal factory baseline.', 'success');
  };

  const handleToggleEmergency = () => {
    const next = !isEmergencyActive;
    setIsEmergencyActive(next);
    if (next) {
      sound.playCritical();
      addAlert(
        'critical',
        'FULL UNDERGROUND MUSTER EVACUATION SIGNAL',
        'Command center operator initiated mine-wide evacuation protocol. Underground strobe sirens activated at all refuge bays.',
        'ALL MINE LEVELS (-140m to -460m)',
        undefined,
        'Direct all 24 personnel to Refuge Station Alpha or Portal Main Drift.',
        'spike',
        'Evac Priority #1'
      );
      addEvent('OPERATOR', 'MANUAL EMERGENCY MUSTER EVACUATION DISPATCHED', 'error');
    } else {
      sound.playSuccess();
      addEvent('OPERATOR', 'Emergency muster call cleared. Returning to normal shift ops.', 'info');
    }
  };

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    addEvent('OPERATOR', `Incident ${id.slice(0, 8)} acknowledged by surface operator.`, 'info');
  };

  const handleResolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, resolved: true } : a));
    addEvent('OPERATOR', `Incident ${id.slice(0, 8)} marked resolved. Atmospheric safe conditions confirmed.`, 'success');
  };

  const handleExecuteProtocol = (alert: AlertItem) => {
    sound.playSuccess();
    addAlert(
      'info',
      `Protocol Dispatched: ${alert.title}`,
      `Automatic command forwarded to Ventilation Substation & Rover Fleet: ${alert.protocolAction}`,
      alert.zone,
      alert.nodeId
    );
    addEvent('OPERATOR', `Executed safety protocol: ${alert.protocolAction}`, 'success');
  };

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-[#06090d] text-[#e2e8f0] flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. Universal Top Navigation Bar */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unacknowledgedAlertsCount={unacknowledgedCount}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onOpenSimulation={() => setIsSimModalOpen(true)}
        isEmergencyActive={isEmergencyActive}
        onToggleEmergency={handleToggleEmergency}
        onResetData={handleResetBaseline}
      />

      {/* 2. Tactical Telemetry Status Ribbon */}
      <TacticalStatusBar
        nodes={nodes}
        robot={robot}
        packetRate={packetRate}
        isEmergencyActive={isEmergencyActive}
        mqttStatus={mqttStatus}
        laptopCamStreaming={isCameraStreaming}
        onOpenCamModal={() => setIsCameraModalOpen(true)}
      />

      {/* Emergency Global Banner when Evacuation is Active */}
      {isEmergencyActive && (
        <div className="bg-rose-950/90 border-b border-rose-500 px-4 py-2 text-center text-xs font-mono font-bold text-rose-200 flex items-center justify-center gap-2 animate-pulse">
          <Flame className="w-4 h-4 text-rose-400" />
          <span>UNDERGROUND EVACUATION STROBE ACTIVE · ALL PERSONNEL REPORT TO REFUGE BAYS</span>
        </div>
      )}

      {/* 3. Main Workspace Deck */}
      <main className="flex-1 p-4 lg:p-6 max-w-[1720px] w-full mx-auto space-y-5">
        {/* VIEW: DASHBOARD OVERVIEW (Integrated Command View) */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Quick KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Atmospheric Safety */}
              <div className="bg-[#090f17] border border-[#1b2633] rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-slate-400">ATMOSPHERE STATUS</div>
                  <div className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                    {nodes.some(n => n.status === 'critical') ? (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> CRITICAL
                      </span>
                    ) : nodes.some(n => n.status === 'warning') ? (
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> CAUTION
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> NOMINAL
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Max CH₄: <b className="text-amber-400">{Math.max(...nodes.map(n => n.gas))} ppm</b>
                  </div>
                </div>
                <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                  <Flame className="w-5 h-5" />
                </div>
              </div>

              {/* Card 2: Rover Status */}
              <div className="bg-[#090f17] border border-[#1b2633] rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-slate-400">ROVER PATROL (BOT-01)</div>
                  <div className="text-lg font-mono font-bold text-cyan-300 mt-0.5">
                    {robot.status.toUpperCase()}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Depth: <b className="text-slate-200">-{robot.depthMeters}m</b> · Bat: <b className="text-emerald-400">{robot.battery}%</b>
                  </div>
                </div>
                <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                  <Bot className="w-5 h-5" />
                </div>
              </div>

              {/* Card 3: 3D LiDAR Reconstruction */}
              <div className="bg-[#090f17] border border-[#1b2633] rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-slate-400">LIDAR MAP COVERAGE</div>
                  <div className="text-lg font-mono font-bold text-slate-100 mt-0.5">
                    {robot.mapCoveragePct}%
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Points: <b className="text-cyan-300 tabular-nums">{robot.lidarPointsCaptured.toLocaleString()}</b>
                  </div>
                </div>
                <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                  <Radar className="w-5 h-5" />
                </div>
              </div>

              {/* Card 4: Sensor Mesh Connectivity */}
              <div className="bg-[#090f17] border border-[#1b2633] rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-slate-400">ESP32 SENSOR MESH</div>
                  <div className="text-lg font-mono font-bold text-slate-100 mt-0.5">
                    {nodes.filter(n => n.status !== 'offline').length} / {nodes.length} ONLINE
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    MQTT Bus: <b className="text-slate-200">{packetRate} pkt/s</b>
                  </div>
                </div>
                <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                  <Cpu className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Main Operational Split: Mine Map (Left/Center) + Rover Camera & Alerts (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Subterranean Mine Topological Map */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                <MineMap
                  nodes={nodes}
                  robot={robot}
                  onSelectNode={(n) => setSelectedNode(n)}
                  isEmergencyActive={isEmergencyActive}
                />

                {/* Subterranean Sensor Nodes Strip */}
                <div className="bg-[#090f17] rounded-lg border border-[#1a2533] p-4">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#182330]">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-xs font-mono font-bold tracking-wider text-slate-100">
                        SENSOR NODES TELEMETRY MATRIX (10 ESP32 SENSORS)
                      </h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('nodes')}
                      className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                    >
                      <span>Expanded View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <SensorNodeGrid
                    nodes={nodes}
                    onSelectNode={(n) => setSelectedNode(n)}
                    pulseNodeId={pulseNodeId}
                  />
                </div>
              </div>

              {/* Right Column: Rover Live Gimbal Feed & Urgent Alerts Queue */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                {/* Live Rover Camera Feed (Single Camera Feed) */}
                <RobotCameraFeed
                  robot={robot}
                  onUpdateRobot={setRobot}
                  onLogEvent={addEvent}
                />

                {/* Gemini AI Advisor & Voice Intercom Quick Launcher Card */}
                <div className="bg-[#0b121c] border border-purple-500/40 rounded-lg p-3 flex items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-purple-950/80 border border-purple-500/50 flex items-center justify-center text-purple-300 shrink-0">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-slate-100 flex items-center gap-1.5">
                        GEMINI SAFETY ADVISOR &amp; VOICE
                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                          LIVE API
                        </span>
                      </div>
                      <div className="text-[10.5px] font-sans text-slate-400">
                        Multi-turn reasoning &amp; real-time voice intercom
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('ai-assistant')}
                    className="px-2.5 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
                  >
                    <span>Launch</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Urgent Incident Feed */}
                <div className="bg-[#090f17] rounded-lg border border-[#1a2533] p-4">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#182330]">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <h3 className="text-xs font-mono font-bold tracking-wider text-slate-100">
                        INCIDENT &amp; HAZARD QUEUE
                      </h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('alerts')}
                      className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                    >
                      <span>All Incidents</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <AlertsManager
                    alerts={alerts}
                    maxDisplay={3}
                    onAcknowledgeAlert={handleAcknowledgeAlert}
                    onResolveAlert={handleResolveAlert}
                    onExecuteProtocol={handleExecuteProtocol}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: MINE MAP EXPANDED */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <MineMap
              nodes={nodes}
              robot={robot}
              onSelectNode={(n) => setSelectedNode(n)}
              isEmergencyActive={isEmergencyActive}
            />
          </div>
        )}

        {/* VIEW: SENSOR NODES */}
        {activeTab === 'nodes' && (
          <div className="space-y-4">
            <SensorNodeGrid
              nodes={nodes}
              onSelectNode={(n) => setSelectedNode(n)}
              pulseNodeId={pulseNodeId}
            />
          </div>
        )}

        {/* VIEW: ROBOT DECK */}
        {activeTab === 'robot' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7">
              <RobotCameraFeed
                robot={robot}
                onUpdateRobot={setRobot}
                onLogEvent={addEvent}
              />
            </div>
            <div className="lg:col-span-5">
              <LidarReconstruction
                robot={robot}
                onLogEvent={addEvent}
              />
            </div>
          </div>
        )}

        {/* VIEW: 3D LIDAR */}
        {activeTab === 'lidar' && (
          <div className="space-y-4">
            <LidarReconstruction
              robot={robot}
              onLogEvent={addEvent}
            />
          </div>
        )}

        {/* VIEW: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <AnalyticsPanel
              nodes={nodes}
              histories={histories}
            />
          </div>
        )}

        {/* VIEW: ALERTS */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <AlertsManager
              alerts={alerts}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onResolveAlert={handleResolveAlert}
              onExecuteProtocol={handleExecuteProtocol}
            />
          </div>
        )}

        {/* VIEW: GEMINI AI ADVISOR & LIVE VOICE */}
        {activeTab === 'ai-assistant' && (
          <div className="space-y-4">
            <GeminiSafetyAssistant
              nodes={nodes}
              robot={robot}
              alerts={alerts}
              onExecuteProtocol={(p) => addEvent('OPERATOR', `AI Safety Protocol: ${p}`, 'info')}
            />
          </div>
        )}

        {/* VIEW: ARCHITECTURE */}
        {activeTab === 'architecture' && (
          <div className="space-y-4">
            <SystemArchitecture
              packetRate={packetRate}
              onlineNodeCount={nodes.filter(n => n.status !== 'offline').length}
              totalNodeCount={nodes.length}
            />
          </div>
        )}

        {/* VIEW: EVENT LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <EventLogPanel
              events={events}
              onClearLogs={() => setEvents([])}
            />
          </div>
        )}
      </main>

      {/* Sensor Node Drill-down Inspector Modal */}
      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          history={histories[selectedNode.id] || []}
          onClose={() => setSelectedNode(null)}
          onLogEvent={addEvent}
        />
      )}

      {/* Scenario Injection & Simulation Controls Dialog */}
      <SimulationControlsModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        onInjectGasLeak={handleInjectGasLeak}
        onInjectRoverFault={handleInjectRoverFault}
        onInjectCommDrop={handleInjectCommDrop}
        onInjectRockfall={() => {
          sound.playWarning();
          addEvent('LIDAR', 'Seismic micro-tremor: Volumetric convergence flagged +2.4cm roof sag in Stope A-1', 'warn');
          addAlert(
            'warning',
            'Volumetric Convergence Sag Detected',
            'LiDAR 3D mesh comparison detected 2.4cm rock displacement in Stope A-1.',
            'Tunnel A · Zone 2',
            '02',
            undefined,
            'rising',
            '+2.4 mm/hr (Sagging)'
          );
        }}
        onResetBaseline={handleResetBaseline}
        simSpeed={simSpeed}
        setSimSpeed={setSimSpeed}
        isPaused={isPaused}
        setIsPaused={setIsPaused}
      />

      {/* Global Camera Connection Pop-up Modal when camera plugged into laptop */}
      <CameraConnectionModal
        isOpen={isCameraModalOpen}
        detectedDevice={detectedPromptDevice}
        devices={cameraDevices}
        isStreaming={isCameraStreaming}
        sourceMode={cameraSourceMode}
        activeLabel={cameraActiveLabel}
        isDeviceInUseError={isCameraInUseError}
        onStartStream={handleStartCameraStream}
        onStartDisplayStream={handleStartDisplayStream}
        onStartUrlStream={handleStartUrlStream}
        onStopStream={() => {
          stopCameraStream();
          addEvent('ROBOT', 'Camera stream disconnected by operator', 'info');
        }}
        onClose={() => {
          setIsCameraModalOpen(false);
          dismissDetectedPrompt();
        }}
        onRefreshDevices={refreshCameraDevices}
        onSimulateConnect={simulateCameraConnect}
      />
    </div>
  );
}
