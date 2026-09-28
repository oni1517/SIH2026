import { SensorNode, RobotState, AlertItem, EventLogItem, HistoryPoint } from './types';

export const INITIAL_NODES: SensorNode[] = [
  {
    id: '01',
    name: 'SN-01A',
    zone: 'Zone 1 · Entry Shaft',
    tunnel: 'Tunnel A (North Drift)',
    depthMeters: 140,
    status: 'normal',
    temp: 24.8,
    hum: 54,
    gas: 95,
    co: 4,
    o2: 20.8,
    battery: 92,
    rssi: -54,
    lastSeenSec: 1,
    x: 120,
    y: 140,
    ipAddress: '10.14.2.101',
    firmware: 'v3.4.1-esp32',
    gasTrend: 'stable',
    gasRate: '+0.1 ppm/min',
    tempTrend: 'stable'
  },
  {
    id: '02',
    name: 'SN-02A',
    zone: 'Zone 2 · Stope A-1',
    tunnel: 'Tunnel A (North Drift)',
    depthMeters: 185,
    status: 'normal',
    temp: 26.2,
    hum: 58,
    gas: 115,
    co: 6,
    o2: 20.6,
    battery: 88,
    rssi: -62,
    lastSeenSec: 2,
    x: 230,
    y: 95,
    ipAddress: '10.14.2.102',
    firmware: 'v3.4.1-esp32',
    gasTrend: 'stable',
    gasRate: '-0.3 ppm/min',
    tempTrend: 'stable'
  },
  {
    id: '03',
    name: 'SN-03B',
    zone: 'Zone 4 · Primary Crusher',
    tunnel: 'Tunnel B (Central Stope)',
    depthMeters: 260,
    status: 'normal',
    temp: 29.4,
    hum: 64,
    gas: 140,
    co: 9,
    o2: 20.4,
    battery: 84,
    rssi: -65,
    lastSeenSec: 1,
    x: 380,
    y: 160,
    ipAddress: '10.14.2.103',
    firmware: 'v3.4.1-esp32',
    gasTrend: 'rising',
    gasRate: '+1.8 ppm/min',
    tempTrend: 'stable'
  },
  {
    id: '04',
    name: 'SN-04B',
    zone: 'Zone 5 · Ore Pass Chute',
    tunnel: 'Tunnel B (Central Stope)',
    depthMeters: 310,
    status: 'normal',
    temp: 28.1,
    hum: 61,
    gas: 108,
    co: 7,
    o2: 20.5,
    battery: 79,
    rssi: -69,
    lastSeenSec: 3,
    x: 520,
    y: 110,
    ipAddress: '10.14.2.104',
    firmware: 'v3.4.1-esp32',
    gasTrend: 'stable',
    gasRate: '±0.0 ppm/min',
    tempTrend: 'stable'
  },
  {
    id: '05',
    name: 'SN-05C',
    zone: 'Zone 2 · Sub-Battery Station',
    tunnel: 'Tunnel C (Lower Incline)',
    depthMeters: 380,
    status: 'normal',
    temp: 31.0,
    hum: 67,
    gas: 132,
    co: 8,
    o2: 20.2,
    battery: 95,
    rssi: -58,
    lastSeenSec: 1,
    x: 180,
    y: 270,
    ipAddress: '10.14.2.105',
    firmware: 'v3.4.1-esp32',
    gasTrend: 'stable',
    gasRate: '-0.2 ppm/min',
    tempTrend: 'stable'
  },
  {
    id: '06',
    name: 'SN-06C',
    zone: 'Zone 3 · Sump & Pump Bay',
    tunnel: 'Tunnel C (Lower Incline)',
    depthMeters: 420,
    status: 'normal',
    temp: 25.9,
    hum: 78,
    gas: 88,
    co: 5,
    o2: 20.7,
    battery: 73,
    rssi: -71,
    lastSeenSec: 2,
    x: 320,
    y: 310,
    ipAddress: '10.14.2.106',
    firmware: 'v3.4.1-esp32',
    gasTrend: 'falling',
    gasRate: '-1.4 ppm/min',
    tempTrend: 'stable'
  },
  {
    id: '07',
    name: 'SN-07D',
    zone: 'Zone 1 · Exploratory Heading',
    tunnel: 'Tunnel D (South Crosscut)',
    depthMeters: 340,
    status: 'normal',
    temp: 30.5,
    hum: 62,
    gas: 122,
    co: 6,
    o2: 20.5,
    battery: 91,
    rssi: -59,
    lastSeenSec: 1,
    x: 480,
    y: 290,
    ipAddress: '10.14.2.107',
    firmware: 'v3.4.1-esp32',
    gasTrend: 'rising',
    gasRate: '+0.9 ppm/min',
    tempTrend: 'stable'
  },
  {
    id: '08',
    name: 'SN-08D',
    zone: 'Zone 2 · Old Works Seam',
    tunnel: 'Tunnel D (South Crosscut)',
    depthMeters: 390,
    status: 'warning',
    temp: 34.2,
    hum: 72,
    gas: 178, // Approaching warning limit (178 ppm)
    co: 14,
    o2: 19.8,
    battery: 41, // Battery warning
    rssi: -78,
    lastSeenSec: 1,
    x: 640,
    y: 240,
    ipAddress: '10.14.2.108',
    firmware: 'v3.4.1-esp32',
    gasTrend: 'rising',
    gasRate: '+6.4 ppm/min',
    tempTrend: 'rising'
  },
  {
    id: '09',
    name: 'SN-09E',
    zone: 'Zone 1 · Main Vent Raise',
    tunnel: 'Tunnel E (Exhaust Shaft)',
    depthMeters: 220,
    status: 'normal',
    temp: 27.6,
    hum: 56,
    gas: 104,
    co: 5,
    o2: 20.7,
    battery: 87,
    rssi: -61,
    lastSeenSec: 2,
    x: 720,
    y: 130,
    ipAddress: '10.14.2.109',
    firmware: 'v3.4.1-esp32',
    gasTrend: 'stable',
    gasRate: '-0.1 ppm/min',
    tempTrend: 'stable'
  },
  {
    id: '10',
    name: 'SN-10E',
    zone: 'Zone 2 · Sealed Bulkhead #4',
    tunnel: 'Tunnel E (Exhaust Shaft)',
    depthMeters: 460,
    status: 'offline',
    temp: 0,
    hum: 0,
    gas: 0,
    co: 0,
    o2: 0,
    battery: 0,
    rssi: -99,
    lastSeenSec: 1420,
    x: 750,
    y: 320,
    ipAddress: '10.14.2.110',
    firmware: 'v3.3.9-esp32',
    gasTrend: 'stable',
    gasRate: 'N/A (Offline)',
    tempTrend: 'stable'
  }
];

export const ROBOT_WAYPOINTS = [
  { name: 'WP-01 Portal Base', x: 120, y: 140, depth: 140 },
  { name: 'WP-02 Drift Junction', x: 230, y: 95, depth: 185 },
  { name: 'WP-03 Crusher Approach', x: 380, y: 160, depth: 260 },
  { name: 'WP-04 Ore Pass Gallery', x: 520, y: 110, depth: 310 },
  { name: 'WP-05 Vent Bypass', x: 720, y: 130, depth: 220 },
  { name: 'WP-06 Bulkhead Outer', x: 640, y: 240, depth: 390 },
  { name: 'WP-07 South Drill Pocket', x: 480, y: 290, depth: 340 },
  { name: 'WP-08 Deep Sump Drift', x: 320, y: 310, depth: 420 },
  { name: 'WP-09 Incline Battery Bay', x: 180, y: 270, depth: 380 },
  { name: 'WP-10 Portal Return Loop', x: 120, y: 140, depth: 140 }
];

export const INITIAL_ROBOT: RobotState = {
  id: 'BOT-01',
  name: 'TITAN-X1 Tracked Rover',
  status: 'patrolling',
  x: ROBOT_WAYPOINTS[0].x,
  y: ROBOT_WAYPOINTS[0].y,
  depthMeters: 140,
  heading: 42,
  speed: 0.85,
  battery: 84,
  signalStrength: 94,
  distanceTraveledMeters: 1420,
  runtimeSeconds: 3840,
  currentWaypoint: 'WP-02 Drift Junction',
  lidarPointsCaptured: 154820,
  mapCoveragePct: 76.4,
  temperature: 32.4,
  motorTorqueNm: 44.2,
  cameraTilt: -6,
  cameraPan: 12,
  zoomLevel: 1.0,
  spotlightOn: true,
  cameraMode: 'optical',
  aiDetections: [
    {
      label: 'Rock Face Stability OK',
      confidence: 0.94,
      severity: 'safe',
      box: [25, 20, 50, 45]
    },
    {
      label: 'Vent Duct Hanging Cable',
      confidence: 0.88,
      severity: 'caution',
      box: [65, 12, 24, 30]
    }
  ]
};

export const INITIAL_ALERTS: AlertItem[] = [
  {
    id: 'alt-01',
    timestamp: '14:28:11',
    nodeId: '08',
    zone: 'Tunnel D · Zone 2',
    title: 'Elevated Methane Trace Detected',
    description: 'CH₄ gas reading climbed to 178 ppm (Statutory warning threshold is 150 ppm). Vent fan auxiliary activated.',
    severity: 'warning',
    acknowledged: false,
    resolved: false,
    protocolAction: 'Increase Auxiliary Booster Fan #2 to 85% RPM and dispatch BOT-01 for close-up sniff inspection.',
    trend: 'rising',
    trendRate: '+14 ppm/min (Accelerating)'
  },
  {
    id: 'alt-02',
    timestamp: '14:15:04',
    nodeId: '08',
    zone: 'Tunnel D · Zone 2',
    title: 'Battery Cell Low State of Charge',
    description: 'Node internal LiFePO4 battery dropped to 41%. Solar trickle charge unavailable underground.',
    severity: 'warning',
    acknowledged: true,
    resolved: false,
    protocolAction: 'Schedule battery pack swap during Shift Charlie maintenance pass.',
    trend: 'falling',
    trendRate: '-1.8%/hr (Discharging)'
  },
  {
    id: 'alt-03',
    timestamp: '13:50:22',
    nodeId: '10',
    zone: 'Tunnel E · Zone 2',
    title: 'Telemetry Heartbeat Timeout',
    description: 'Node 10 unreachable on 868MHz LoRa mesh for > 20 minutes. Rock attenuation or repeater power outage suspected.',
    severity: 'critical',
    acknowledged: true,
    resolved: false,
    protocolAction: 'Verify Repeater #4 at Bulkhead. Use Rover BOT-01 Wi-Fi mesh bridge.',
    trend: 'spike',
    trendRate: 'Link Dropped (Zero Signal)'
  }
];

export const INITIAL_EVENTS: EventLogItem[] = [
  {
    id: 'ev-01',
    timestamp: '14:32:04',
    source: 'ROBOT',
    message: 'Waypoint WP-02 reached. Heading toward WP-03 Crusher Approach at 0.85 m/s.',
    type: 'info'
  },
  {
    id: 'ev-02',
    timestamp: '14:30:19',
    source: 'LIDAR',
    message: 'Volumetric convergence scan completed for Stope A-1: No seismic roof sag detected.',
    type: 'success'
  },
  {
    id: 'ev-03',
    timestamp: '14:28:11',
    source: 'SENSOR_MESH',
    message: 'Node SN-08D flagged gas threshold crossing: 178 ppm CH4.',
    type: 'warn'
  },
  {
    id: 'ev-04',
    timestamp: '14:20:00',
    source: 'MASTER',
    message: 'Shift Alpha routine telemetry cycle synchronized: 9/10 nodes active on MQTT bus.',
    type: 'info'
  },
  {
    id: 'ev-05',
    timestamp: '14:05:42',
    source: 'ROBOT',
    message: 'Automated FLIR thermal check of conveyor belt rollers: Nominal operating temp 38°C.',
    type: 'info'
  }
];

export function generateSeedHistory(baseTemp: number, baseGas: number, baseHum: number): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  const now = Date.now();
  for (let i = 24; i >= 0; i--) {
    const timeStr = new Date(now - i * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const noiseT = (Math.sin(i * 0.4) * 0.8 + (Math.random() - 0.5) * 0.4);
    const noiseG = (Math.cos(i * 0.5) * 6 + (Math.random() - 0.5) * 4);
    const noiseH = (Math.sin(i * 0.3) * 1.5 + (Math.random() - 0.5) * 0.8);
    points.push({
      time: timeStr,
      temp: +(baseTemp + noiseT).toFixed(1),
      gas: Math.max(20, Math.round(baseGas + noiseG)),
      hum: Math.min(100, Math.max(10, Math.round(baseHum + noiseH))),
      battery: Math.max(10, Math.round(85 - (24 - i) * 0.1)),
      co: Math.max(1, Math.round(5 + (Math.random() - 0.5) * 2))
    });
  }
  return points;
}
