/**
 * MQTT Real-Time Service
 * Connects to public HiveMQ WebSockets broker (wss://broker.hivemq.com:8884/mqtt)
 * or user-specified broker to communicate two-way with ESP32 SentinelRover nodes.
 */
import mqtt, { MqttClient } from 'mqtt';

export interface MqttStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  brokerUrl: string;
  lastMessageTime: string | null;
  packetCount: number;
}

export type MqttMessageCallback = (topic: string, payload: any) => void;

class MqttService {
  private client: MqttClient | null = null;
  private listeners: Set<MqttMessageCallback> = new Set();
  private statusListeners: Set<(status: MqttStatus) => void> = new Set();

  public status: MqttStatus = {
    connected: false,
    connecting: false,
    error: null,
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    lastMessageTime: null,
    packetCount: 0
  };

  constructor() {
    // Lazy connect on demand or auto-connect
  }

  public connect(brokerUrl: string = 'wss://broker.hivemq.com:8884/mqtt') {
    if (this.client) {
      try {
        this.client.end(true);
      } catch (e) {
        // ignore
      }
      this.client = null;
    }

    this.status.brokerUrl = brokerUrl;
    this.status.connecting = true;
    this.status.error = null;
    this.notifyStatus();

    try {
      // Create random client ID under 23 chars
      const clientId = `web-${Math.random().toString(36).substring(2, 10)}`;

      this.client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 6000,
        keepalive: 60
      });

      this.client.on('connect', () => {
        this.status.connected = true;
        this.status.connecting = false;
        this.status.error = null;
        this.notifyStatus();

        // Subscribe to SentinelRover and Mine Command topics
        this.client?.subscribe([
          'mine/node/telemetry',
          'mine/node/status',
          'mine/node/calibration/result',
          'mine/rover/+/telemetry',
          'mine/alerts/#'
        ], { qos: 1 });
      });

      this.client.on('message', (topic, message) => {
        this.status.packetCount++;
        this.status.lastMessageTime = new Date().toLocaleTimeString([], { hour12: false });
        this.notifyStatus();

        let parsed: any = message.toString();
        try {
          parsed = JSON.parse(parsed);
        } catch {
          // keep as string
        }

        this.listeners.forEach(cb => {
          try {
            cb(topic, parsed);
          } catch (e) {
            console.error('Error in MQTT message listener:', e);
          }
        });
      });

      this.client.on('error', (err) => {
        this.status.error = err.message || 'MQTT Connection Error';
        this.status.connecting = false;
        this.notifyStatus();
      });

      this.client.on('offline', () => {
        this.status.connected = false;
        this.status.connecting = false;
        this.notifyStatus();
      });

      this.client.on('close', () => {
        this.status.connected = false;
        this.status.connecting = false;
        this.notifyStatus();
      });
    } catch (err: any) {
      this.status.error = err?.message || 'Failed to initialize MQTT';
      this.status.connecting = false;
      this.notifyStatus();
    }
  }

  public disconnect() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.status.connected = false;
    this.status.connecting = false;
    this.notifyStatus();
  }

  public publish(topic: string, message: string | object, qos: 0 | 1 | 2 = 1) {
    if (!this.client || !this.status.connected) {
      return false;
    }
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.client.publish(topic, payload, { qos });
    return true;
  }

  public triggerCalibration() {
    return this.publish('mine/node/cmd/calibrate', 'CALIBRATE', 1);
  }

  public configureThresholds(thresholds: { gasThreshold?: number; vibThreshold?: number; ldrDrop?: number }) {
    return this.publish('mine/node/cmd/config', thresholds, 1);
  }

  public onMessage(cb: MqttMessageCallback) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public onStatusChange(cb: (status: MqttStatus) => void) {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  private notifyStatus() {
    this.statusListeners.forEach(cb => {
      try {
        cb({ ...this.status });
      } catch (e) {
        // ignore
      }
    });
  }
}

export const mqttService = new MqttService();
