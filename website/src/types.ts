export type NodeStatus = 'normal' | 'warning' | 'critical' | 'offline';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type CameraMode = 'optical' | 'thermal' | 'night-vision';
export type ActiveTab = 'overview' | 'map' | 'nodes' | 'robot' | 'lidar' | 'analytics' | 'alerts' | 'architecture' | 'logs' | 'ai-assistant';

export interface SensorNode {
  id: string;
  name: string;
  zone: string;
  tunnel: string;
  depthMeters: number;
  status: NodeStatus;
  temp: number; // Celsius
  hum: number;  // % RH
  gas: number;  // CH4 Methane in ppm
  co: number;   // Carbon Monoxide ppm
  o2: number;   // Oxygen %
  battery: number; // %
  rssi: number; // dBm
  lastSeenSec: number;
  x: number; // map coordinate
  y: number;
  ipAddress: string;
  firmware: string;
  gasTrend?: 'rising' | 'falling' | 'stable';
  gasRate?: string;
  tempTrend?: 'rising' | 'falling' | 'stable';
  vibration?: number; // MPU6500 %
  light?: number; // LDR ADC (0-4095)
  pirMotion?: boolean; // PIR
  calibrated?: boolean;
}

export interface RobotState {
  id: string;
  name: string;
  status: 'patrolling' | 'standby' | 'returning' | 'hazard-hold' | 'e-stop';
  x: number;
  y: number;
  depthMeters: number;
  heading: number;
  speed: number;
  battery: number;
  signalStrength?: number;
  distanceTraveledMeters: number;
  runtimeSeconds: number;
  currentWaypoint: string;
  lidarPointsCaptured: number;
  mapCoveragePct: number;
  temperature: number;
  motorTorqueNm: number;
  cameraTilt: number;
  cameraPan: number;
  zoomLevel: number;
  spotlightOn: boolean;
  cameraMode: CameraMode;
  aiDetections: {
    label: string;
    confidence: number;
    severity: 'safe' | 'caution' | 'danger';
    box: [number, number, number, number]; // x, y, w, h in %
  }[];
}

export interface AlertItem {
  id: string;
  timestamp: string;
  nodeId?: string;
  zone: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  acknowledged: boolean;
  resolved: boolean;
  protocolAction?: string;
  trend?: 'rising' | 'falling' | 'stable' | 'spike';
  trendRate?: string;
}

export interface EventLogItem {
  id: string;
  timestamp: string;
  source: 'MASTER' | 'ROBOT' | 'SENSOR_MESH' | 'MQTT' | 'OPERATOR' | 'LIDAR';
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
}

export interface HistoryPoint {
  time: string;
  temp: number;
  gas: number;
  hum: number;
  battery: number;
  co: number;
}
