# Underground Mine Command Center — MQTT Topics Specification

This document provides the complete, authoritative MQTT topic taxonomy, payload schemas, broker details, and command specifications for the **Underground Mine Command Center** and its paired **ESP32 Subterranean Sensor Mesh Nodes (SentinelRover)**.

---

## 1. Quick Reference: Core Topics Table

| # | MQTT Topic | Direction | QoS | Retain | Description |
|---|---|---|---|---|---|
| **1** | `mine/node/telemetry` | ESP32 Node $\rightarrow$ Web Console | `0` / `1` | `false` | Periodic real-time sensor telemetry (Temp, Hum, MQ135 Gas, MPU6500 Vibration, LDR Light, PIR Motion) |
| **2** | `mine/node/status` | ESP32 Node $\rightarrow$ Web Console | `1` | `true` | Node online status and Last Will & Testament (LWT) offline notification |
| **3** | `mine/node/calibration/result` | ESP32 Node $\rightarrow$ Web Console | `1` | `true` | Post-calibration zero-offset baseline results and calculated MQ135 $R_0$ |
| **4** | `mine/node/cmd/calibrate` | Web Console $\rightarrow$ ESP32 Node | `1` | `false` | Downlink trigger command: starts the 10-second zero-offset sensor calibration routine |
| **5** | `mine/node/cmd/config` | Web Console $\rightarrow$ ESP32 Node | `1` | `false` | Downlink dynamic threshold configuration (`gasThreshold`, `vibThreshold`, `ldrDrop`) |
| **6** | `mine/rover/{rover_id}/telemetry` | Rover BOT-01 $\rightarrow$ Web Console | `0` / `1` | `false` | Rover navigation pose (X, Y, Depth), heading, speed, battery, motor torque |
| **7** | `mine/rover/{rover_id}/camera/status` | Rover BOT-01 $\rightarrow$ Web Console | `1` | `false` | **Single Primary Inspection Camera Feed** status, PTZ angles, zoom, auxiliary floodlight |
| **8** | `mine/rover/{rover_id}/camera/detections` | Edge AI $\rightarrow$ Web Console | `1` | `false` | Machine vision hazard bounding boxes (Rock fractures, roof sag, water ingress) |
| **9** | `mine/rover/{rover_id}/lidar/status` | 3D LiDAR $\rightarrow$ Web Console | `1` | `false` | 10 Hz 360° point cloud metrics, coverage %, and volumetric convergence sag |
| **10** | `mine/rover/{rover_id}/control/ptz` | Web Console $\rightarrow$ Rover BOT-01 | `1` | `false` | Downlink Gimbal Pan/Tilt, Optical Zoom, and High-Lumen Floodlight controls |
| **11** | `mine/rover/{rover_id}/control/estop` | Web Console $\rightarrow$ Rover BOT-01 | `2` | `false` | Emergency Stop (E-STOP) traction interlock to instantly halt rover locomotion |
| **12** | `mine/alerts/incident` | Mesh / Gateway $\rightarrow$ Web Console | `2` | `true` | Mission-critical life-safety atmospheric or structural alerts with protocols |
| **13** | `mine/alerts/acknowledge` | Web Console $\rightarrow$ Master Gateway | `1` | `false` | Operator acknowledgment confirmation for open incidents |
| **14** | `mine/alerts/resolve` | Web Console $\rightarrow$ Master Gateway | `1` | `false` | Operator incident clearance and resolution record |
| **15** | `mine/alerts/evacuation` | Web Console $\leftrightarrow$ Refuge Stations | `2` | `true` | Mine-wide Subterranean Muster Evacuation Strobe Siren trigger |
| **16** | `mine/gateway/master/heartbeat` | Master Gateway $\rightarrow$ Web Console | `0` | `false` | Substation ESP32-S3 gateway heartbeat, packet rate, and mesh health |

---

## 2. Broker Connection Configuration

The command center and nodes are preconfigured to connect via HiveMQ (or any standard MQTT 3.1.1 / 5.0 broker):

| Parameter | ESP32 Hardware Node | Surface Command Center (Web Browser) |
|---|---|---|
| **Protocol** | Standard TCP / IP | WebSockets with TLS (`wss://`) |
| **Host** | `broker.hivemq.com` | `broker.hivemq.com` |
| **Port** | `1883` | `8884` (WSS encrypted) or `8000` (WS) |
| **Path** | N/A | `/mqtt` |
| **Client ID** | `ESP32-NODE-SRF-01` *(must be $\le 23$ chars)* | `mine-deck-{uuid}` |
| **Authentication** | Optional / Anonymous | Optional / Anonymous |

---

## 3. ESP32 SentinelRover Topics & Payloads

### 3.1 Sensor Telemetry Broadcast
- **Topic**: `mine/node/telemetry`
- **Direction**: ESP32 Node $\rightarrow$ Surface Command Center
- **Frequency**: Every 1000 ms (1 Hz)
- **QoS**: `0` or `1`

#### JSON Payload:
```json
{
  "nodeId": "NODE-SRF-01",
  "temp": 25.4,
  "humidity": 58.2,
  "gas": 42.1,
  "vibration": 1.2,
  "light": 2340,
  "motion": 0,
  "calibrated": true,
  "status": "normal"
}
```

#### Field Specifications:
- `nodeId` *(string)*: Unique identifier of the node (e.g., `NODE-SRF-01`).
- `temp` *(float)*: Ambient temperature in degrees Celsius from DHT22.
- `humidity` *(float)*: Relative humidity percentage (% RH) from DHT22.
- `gas` *(float)*: Atmospheric air quality / gas concentration in ppm from MQ135 sensor.
- `vibration` *(float)*: Dynamic vibration percentage deviation from calibrated 1G baseline via MPU6500 I2C accelerometer.
- `light` *(int)*: Raw ambient light ADC reading (0–4095) from LDR photoresistor.
- `motion` *(int)*: PIR motion detector state (`1` = motion detected, `0` = quiescent).
- `calibrated` *(boolean)*: Indicates if zero-offset calibration has completed.
- `status` *(string)*: Node safety condition: `"normal"`, `"warning"`, or `"critical"`.

---

### 3.2 Node Status & LWT (Last Will & Testament)
- **Topic**: `mine/node/status`
- **Direction**: ESP32 Node / Broker $\rightarrow$ Surface Command Center
- **QoS**: `1` (Retained)

#### When ESP32 Connects (Online):
```json
{
  "nodeId": "NODE-SRF-01",
  "status": "online",
  "ip": "192.168.1.105"
}
```

#### When ESP32 Disconnects Abruptly (LWT Message):
```json
{
  "nodeId": "NODE-SRF-01",
  "status": "offline"
}
```

---

### 3.3 Zero-Offset Calibration Result
- **Topic**: `mine/node/calibration/result`
- **Direction**: ESP32 Node $\rightarrow$ Surface Command Center
- **Trigger**: Published automatically upon completion of the 10-second calibration routine.
- **QoS**: `1` (Retained)

#### JSON Payload:
```json
{
  "nodeId": "NODE-SRF-01",
  "status": "calibrated",
  "baselineVibration": 0.4,
  "baselineTemp": 24.8,
  "baselineHumidity": 57.5,
  "baselineLdr": 2410,
  "R0": 29840
}
```

---

### 3.4 Remote Calibration Command Downlink
- **Topic**: `mine/node/cmd/calibrate`
- **Direction**: Surface Command Center $\rightarrow$ ESP32 Node
- **QoS**: `1`

#### Payload Options:
- Plain text string: `CALIBRATE`
- OR JSON object:
```json
{
  "command": "CALIBRATE"
}
```
*Note*: When received by the ESP32, onboard status LED (Pin 2) illuminates, baseline measurements are sampled for 10 seconds across all sensors, and baseline zero-offsets are stored.

---

### 3.5 Dynamic Threshold Configuration Downlink
- **Topic**: `mine/node/cmd/config`
- **Direction**: Surface Command Center $\rightarrow$ ESP32 Node
- **QoS**: `1`

#### JSON Payload:
```json
{
  "gasThreshold": 120.0,
  "vibThreshold": 25.0,
  "ldrDrop": 450
}
```

---

## 4. Robotic Inspection Rover Topics (`mine/rover/...`)

### 4.1 Rover Spatial Telemetry
- **Topic**: `mine/rover/bot01/telemetry`
- **Frequency**: 10 Hz (every 100 ms)
- **QoS**: `0`

```json
{
  "rover_id": "BOT-01",
  "name": "TITAN-X1 Tracked Rover",
  "status": "patrolling",
  "position": {
    "x": 380.0,
    "y": 160.0,
    "depth_m": 260
  },
  "motion": {
    "heading_deg": 42.0,
    "speed_mps": 0.85,
    "motor_torque_nm": 44.2
  },
  "battery_pct": 84.0,
  "current_waypoint": "WP-03 Crusher Approach"
}
```

---

### 4.2 Single Primary Inspection Camera Feed
- **Topic**: `mine/rover/bot01/camera/status`
- **QoS**: `1`

The website uses a **single primary camera feed** (BOT-01 Front Inspection Camera) providing high-resolution optical video, PTZ gimbal telemetry, and auxiliary floodlight control:

```json
{
  "rover_id": "BOT-01",
  "camera_id": "CAM-01-PRIMARY",
  "stream": {
    "resolution": "1280x720",
    "fps": 24,
    "latency_ms": 38
  },
  "gimbal": {
    "pan_deg": 12.0,
    "tilt_deg": -6.0,
    "zoom": 1.5,
    "spotlight_on": true
  }
}
```

#### Downlink PTZ Control (`mine/rover/bot01/control/ptz`):
```json
{
  "pan_deg": 15.0,
  "tilt_deg": -10.0,
  "zoom": 2.0,
  "spotlight_on": true
}
```

#### Emergency Stop Interlock (`mine/rover/bot01/control/estop`):
```json
{
  "command": "ESTOP_ENGAGE",
  "reason": "OPERATOR_OVERRIDE",
  "timestamp": "2026-09-28T14:30:00Z"
}
```

---

### 4.3 3D LiDAR & Convergence Sag
- **Topic**: `mine/rover/bot01/lidar/status`
- **QoS**: `1`

```json
{
  "rover_id": "BOT-01",
  "scan_rate_hz": 10.0,
  "points_captured": 154820,
  "map_coverage_pct": 76.4,
  "convergence_analysis": {
    "roof_sag_mm": 12.0,
    "nominal_limit_mm": 25.0,
    "structural_status": "NORMAL"
  }
}
```

---

## 5. Life-Safety Alerts & Evacuation Topics (`mine/alerts/...`)

### 5.1 Incident Dispatch Broadcast
- **Topic**: `mine/alerts/incident`
- **QoS**: `2` (Exactly Once)
- **Retained**: `true`

```json
{
  "alert_id": "alt-849102",
  "severity": "critical",
  "timestamp": "14:28:11",
  "node_id": "08",
  "zone": "Tunnel D · Zone 2",
  "title": "Methane Cavity Surge - 228 ppm CH₄",
  "description": "CH₄ concentration exceeded statutory critical threshold (200 ppm / 1.0% LEL).",
  "trend": "rising",
  "trend_rate": "+28 ppm/min (Rapid Surge)",
  "protocol_action": "Activate Level 2 emergency sirens, boost exhaust fan #3, isolate electrical substation.",
  "acknowledged": false,
  "resolved": false
}
```

---

### 5.2 Subterranean Emergency Muster Evacuation Strobe
- **Topic**: `mine/alerts/evacuation`
- **QoS**: `2`
- **Retained**: `true`

```json
{
  "evacuation_active": true,
  "scope": "ALL_LEVELS",
  "strobe_siren_trigger": true,
  "refuge_bay_pressurize": true,
  "authorized_by": "MINE_SAFETY_DIRECTOR",
  "timestamp": "2026-09-28T14:30:00Z"
}
```

---

## 6. How to Test and Publish via CLI or MQTT Explorer

### 6.1 Using Mosquitto CLI

#### Listen to live telemetry from the ESP32:
```bash
mosquitto_sub -h broker.hivemq.com -p 1883 -t "mine/node/#" -v
```

#### Trigger remote sensor calibration:
```bash
mosquitto_pub -h broker.hivemq.com -p 1883 -t "mine/node/cmd/calibrate" -m "CALIBRATE"
```

#### Push custom sensor thresholds:
```bash
mosquitto_pub -h broker.hivemq.com -p 1883 -t "mine/node/cmd/config" -m '{"gasThreshold":150,"vibThreshold":20,"ldrDrop":400}'
```

#### Simulate telemetry packet from a test node:
```bash
mosquitto_pub -h broker.hivemq.com -p 1883 -t "mine/node/telemetry" -m '{"nodeId":"NODE-SRF-01","temp":26.2,"humidity":55.0,"gas":85.0,"vibration":2.1,"light":2100,"motion":1,"calibrated":true,"status":"normal"}'
```

---

## 7. Firmware Location

The complete Arduino/ESP32 C++ source code matching these topics is saved in:
- `/firmware/sentinel_rover_esp32.ino`
