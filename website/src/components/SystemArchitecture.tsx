import React, { useState } from 'react';
import { Radio, Cpu, Network, Server, Monitor, Activity, ShieldCheck, Zap, Copy, Check, FileText } from 'lucide-react';
import { sound } from '../utils/audio';

interface SystemArchitectureProps {
  packetRate: number;
  onlineNodeCount: number;
  totalNodeCount: number;
}

export const SystemArchitecture: React.FC<SystemArchitectureProps> = ({
  packetRate,
  onlineNodeCount,
  totalNodeCount
}) => {
  const [selectedBlock, setSelectedBlock] = useState<string>('master');
  const [copiedTopic, setCopiedTopic] = useState<string | null>(null);
  const [topicCategory, setTopicCategory] = useState<'all' | 'telemetry' | 'rover' | 'alerts' | 'control'>('all');

  const handleDownloadTopics = () => {
    sound.playClick();
    const mdContent = `# Underground Mine Command Center — MQTT Topics\n\nBroker: broker.hivemq.com\nTCP Port: 1883\nWebSocket: wss://broker.hivemq.com:8884/mqtt\n\nTopics:\n` +
      mqttTopicsList.map(t => `- [${t.category.toUpperCase()}] ${t.topic}\n  Direction: ${t.direction} (QoS ${t.qos})\n  Description: ${t.desc}`).join('\n\n');
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MQTT_TOPICS.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFirmware = () => {
    sound.playClick();
    const a = document.createElement('a');
    a.href = '/firmware/sentinel_rover_esp32.ino';
    a.download = 'sentinel_rover_esp32.ino';
    a.click();
  };

  const handleCopyTopic = (topic: string) => {
    sound.playClick();
    navigator.clipboard.writeText(topic).catch(() => {});
    setCopiedTopic(topic);
    setTimeout(() => setCopiedTopic(null), 1800);
  };

  const mqttTopicsList = [
    {
      topic: 'mine/node/telemetry',
      category: 'telemetry',
      direction: 'PUBLISH (ESP32 SentinelRover)',
      qos: '0/1',
      desc: 'Periodic sensor telemetry: Temp (DHT22), Humidity, MQ135 Gas ppm, MPU6500 Vibration %, LDR Light ADC, PIR Motion flag.'
    },
    {
      topic: 'mine/node/status',
      category: 'telemetry',
      direction: 'PUBLISH / LWT (Retained)',
      qos: '1',
      desc: 'Node connection status ("online" / "offline") and local IP address.'
    },
    {
      topic: 'mine/node/calibration/result',
      category: 'telemetry',
      direction: 'PUBLISH (ESP32 Retained)',
      qos: '1',
      desc: 'Results of 10s zero-offset baseline calibration: baseline vibration, baseline temp/humidity, ambient light baseline, MQ135 R0.'
    },
    {
      topic: 'mine/node/cmd/calibrate',
      category: 'control',
      direction: 'SUBSCRIBE (Surface Downlink)',
      qos: '1',
      desc: 'Remote execution command ("CALIBRATE") to initiate the 10-second zero-offset baseline calibration.'
    },
    {
      topic: 'mine/node/cmd/config',
      category: 'control',
      direction: 'SUBSCRIBE (Surface Downlink)',
      qos: '1',
      desc: 'Dynamic threshold configuration JSON (gasThreshold, vibThreshold, ldrDrop).'
    },
    {
      topic: 'mine/rover/{rover_id}/telemetry',
      category: 'rover',
      direction: 'PUBLISH (BOT-01 Rover)',
      qos: '0/1',
      desc: 'Continuous spatial telemetry: X/Y coordinates, Depth, Speed, Heading, Battery, Torque.'
    },
    {
      topic: 'mine/rover/{rover_id}/camera/status',
      category: 'rover',
      direction: 'PUBLISH (Camera Stream)',
      qos: '1',
      desc: 'Single primary inspection camera feed status, floodlight state, PTZ angles, zoom factor, latency.'
    },
    {
      topic: 'mine/rover/{rover_id}/camera/detections',
      category: 'rover',
      direction: 'PUBLISH (Edge AI)',
      qos: '1',
      desc: 'Computer vision hazard bounding boxes (Rock bolts, loose slabs, water inflow).'
    },
    {
      topic: 'mine/rover/{rover_id}/lidar/status',
      category: 'rover',
      direction: 'PUBLISH (3D LiDAR)',
      qos: '1',
      desc: '10Hz 360° point cloud metrics, coverage %, and volumetric convergence sag.'
    },
    {
      topic: 'mine/rover/{rover_id}/control/ptz',
      category: 'control',
      direction: 'SUBSCRIBE (Gimbal Downlink)',
      qos: '1',
      desc: 'Pan, tilt, zoom coordinates and auxiliary spotlight toggle commands.'
    },
    {
      topic: 'mine/rover/{rover_id}/control/estop',
      category: 'control',
      direction: 'SUBSCRIBE (E-STOP)',
      qos: '2',
      desc: 'High-priority Emergency Stop interlock to halt robotic traction immediately.'
    },
    {
      topic: 'mine/alerts/incident',
      category: 'alerts',
      direction: 'PUBLISH (Broadcast)',
      qos: '2',
      desc: 'Life-safety atmospheric and structural hazard alerts with severity & protocol.'
    },
    {
      topic: 'mine/alerts/acknowledge',
      category: 'alerts',
      direction: 'PUBLISH (Surface Operator)',
      qos: '1',
      desc: 'Operator acknowledgment confirmation for active incidents.'
    },
    {
      topic: 'mine/alerts/evacuation',
      category: 'alerts',
      direction: 'PUBLISH / BROADCAST',
      qos: '2',
      desc: 'Mine-wide emergency muster strobe siren activation signal.'
    },
    {
      topic: 'mine/gateway/master/heartbeat',
      category: 'telemetry',
      direction: 'PUBLISH (Gateway 1Hz)',
      qos: '0',
      desc: 'ESP32-S3 Substation Gateway packet rate, online nodes tally, and backhaul link.'
    }
  ];

  const filteredTopics = mqttTopicsList.filter(t => {
    if (topicCategory === 'all') return true;
    return t.category === topicCategory;
  });

  const blocks = {
    nodes: {
      title: 'SUBTERRANEAN SENSOR MESH (ESP32 SENTINELROVER)',
      desc: 'Distributed ESP32 microcontrollers deployed in subterranean drifts. Equipped with MPU6500 vibration, DHT22 temp/humidity, MQ135 gas, LDR photoresistor, and PIR motion sensors. Communicates two-way via WiFi + MQTT with zero-offset calibration support.',
      specs: [
        ['Hardware', 'ESP32 Node (e.g. NODE-SRF-01)'],
        ['Sensors', 'MPU6500, DHT22, MQ135, LDR, PIR'],
        ['Broker', 'broker.hivemq.com:1883'],
        ['Telemetry Rate', '1-second periodic beacon']
      ]
    },
    robot: {
      title: 'AUTONOMOUS INSPECTION ROVER (BOT-01)',
      desc: 'Tracked subterranean mobile inspection platform with 10Hz 360° LiDAR, Single Primary Inspection Camera Feed with motorized PTZ gimbal and high-lumen cavern floodlights, and Wi-Fi 6 mesh bridge to relay underground blindspots.',
      specs: [
        ['Onboard Compute', 'NVIDIA Jetson Orin Nano + ESP32 Motor Controller'],
        ['Telemetry Link', '5.8 GHz Wireless Mesh + 868 MHz Backup'],
        ['Sensors', '360° LiDAR, Laptop / USB Inspection Camera Live Feed, Gas & Motion'],
        ['Navigation', 'Autonomous SLAM + Pre-planned Waypoint Patrol']
      ]
    },
    master: {
      title: 'SUBSTATION MASTER AGGREGATOR NODE',
      desc: 'High-availability central ESP32-S3 gateway positioned at Substation Level 2. Aggregates multi-hop RF packets from all tunnel drifts, validates checksums, packages JSON telemetry, and dispatches to surface fiber optic backhaul.',
      specs: [
        ['Hardware', 'Espressif ESP32-S3 (Dual-Core 240MHz)'],
        ['Backhaul Uplink', 'Gigabit Industrial Ethernet / Fiber Leaky Feeder'],
        ['Buffer Memory', '8MB PSRAM Store-and-Forward Cache'],
        ['Throughput', `${packetRate} packets/sec nominal`]
      ]
    },
    mqtt: {
      title: 'ENTERPRISE MQTT BROKER CLUSTER',
      desc: 'Industrial message broker operating over secure WebSockets with TLS encryption (Port 8884/8883) and standard TCP (Port 1883). Handles pub/sub topic hierarchies for mine sensor streaming, rover command teleoperation, and alarm event dispatch.',
      specs: [
        ['Protocol', 'MQTT v3.1.1/v5.0 (WSS / TCP)'],
        ['Topic Scheme', 'mine/node/* & mine/rover/*'],
        ['Default Broker', 'broker.hivemq.com (Port 1883 / 8884)'],
        ['Quality of Service', 'QoS 0, 1, and 2 supported']
      ]
    },
    console: {
      title: 'SURFACE COMMAND CENTER (THIS INTERFACE)',
      desc: 'Mission Control web application rendering real-time topological mine maps, 3D LiDAR point clouds, single primary inspection camera feed, and automated safety evacuation triggers.',
      specs: [
        ['Architecture', 'High-performance React SPA + Canvas Engines'],
        ['Update Latency', '< 30ms client-side render budget'],
        ['State Sync', 'Zero-latency WebSocket event loop'],
        ['Compliance', 'MSHA Title 30 CFR Safety Monitoring']
      ]
    }
  };

  const current = blocks[selectedBlock as keyof typeof blocks] || blocks.master;

  return (
    <div className="bg-[#090f17] rounded-lg border border-[#1a2533] p-4 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#182330]">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-slate-100">
            SYSTEM TELEMETRY PIPELINE &amp; DATAFLOW ARCHITECTURE
          </h2>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span>Active Pipeline: <b className="text-emerald-400">{packetRate} pkt/s</b></span>
          <span>Loss Rate: <b className="text-slate-200">0.01%</b></span>
          <span>RTT: <b className="text-cyan-300">18 ms</b></span>
        </div>
      </div>

      {/* SVG Interactive Architecture Flow Diagram */}
      <div className="bg-[#05080c] rounded-lg border border-[#182330] p-4 overflow-x-auto">
        <svg viewBox="0 0 960 200" className="w-full min-w-[700px] h-auto select-none font-mono">
          <defs>
            <filter id="archGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>

            {/* Motion paths for animated packets */}
            <path id="pathMeshToMaster" d="M 180 90 L 260 90" />
            <path id="pathRobotToMaster" d="M 180 155 L 220 155 L 220 90 L 260 90" />
            <path id="pathMasterToMqtt" d="M 440 90 L 520 90" />
            <path id="pathMqttToConsole" d="M 700 90 L 780 90" />
          </defs>

          {/* Connection Lines */}
          <line x1="180" y1="90" x2="260" y2="90" stroke="#1e293b" strokeWidth="2.5" />
          <path d="M 180 155 L 220 155 L 220 90 L 260 90" fill="none" stroke="#1e293b" strokeWidth="2.5" />
          <line x1="440" y1="90" x2="520" y2="90" stroke="#1e293b" strokeWidth="2.5" />
          <line x1="700" y1="90" x2="780" y2="90" stroke="#1e293b" strokeWidth="2.5" />

          {/* Animated Traveling Data Packets */}
          <circle r="3.5" fill="#06b6d4">
            <animateMotion dur="1.4s" repeatCount="indefinite"><mpath href="#pathMeshToMaster" /></animateMotion>
          </circle>
          <circle r="3.5" fill="#06b6d4">
            <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#pathRobotToMaster" /></animateMotion>
          </circle>
          <circle r="3.5" fill="#38bdf8">
            <animateMotion dur="1.2s" repeatCount="indefinite"><mpath href="#pathMasterToMqtt" /></animateMotion>
          </circle>
          <circle r="3.5" fill="#38bdf8">
            <animateMotion dur="1.0s" repeatCount="indefinite"><mpath href="#pathMqttToConsole" /></animateMotion>
          </circle>

          {/* Block 1: Sensor Nodes */}
          <g
            className="cursor-pointer"
            onClick={() => { sound.playClick(); setSelectedBlock('nodes'); }}
          >
            <rect
              x="20" y="45" width="160" height="90" rx="6"
              fill={selectedBlock === 'nodes' ? '#0f2438' : '#0c1420'}
              stroke={selectedBlock === 'nodes' ? '#06b6d4' : '#1e2d3d'}
              strokeWidth={selectedBlock === 'nodes' ? 2 : 1.2}
              filter={selectedBlock === 'nodes' ? 'url(#archGlow)' : undefined}
            />
            <text x="100" y="80" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
              SENSOR NODES
            </text>
            <text x="100" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">
              10x ESP32 Mesh
            </text>
            <text x="100" y="118" fill="#10b981" fontSize="9.5" fontWeight="bold" textAnchor="middle">
              {onlineNodeCount}/{totalNodeCount} CONNECTED
            </text>
          </g>

          {/* Block 1B: Autonomous Rover */}
          <g
            className="cursor-pointer"
            onClick={() => { sound.playClick(); setSelectedBlock('robot'); }}
          >
            <rect
              x="20" y="145" width="160" height="45" rx="5"
              fill={selectedBlock === 'robot' ? '#0f2438' : '#0c1420'}
              stroke={selectedBlock === 'robot' ? '#06b6d4' : '#1e2d3d'}
              strokeWidth={selectedBlock === 'robot' ? 2 : 1.2}
            />
            <text x="100" y="168" fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle">
              ROVER BOT-01
            </text>
            <text x="100" y="181" fill="#38bdf8" fontSize="8" textAnchor="middle">
              LiDAR / Cam / Telemetry
            </text>
          </g>

          {/* Block 2: Master Node */}
          <g
            className="cursor-pointer"
            onClick={() => { sound.playClick(); setSelectedBlock('master'); }}
          >
            <rect
              x="260" y="45" width="180" height="90" rx="6"
              fill={selectedBlock === 'master' ? '#0f2438' : '#0c1420'}
              stroke={selectedBlock === 'master' ? '#06b6d4' : '#1e2d3d'}
              strokeWidth={selectedBlock === 'master' ? 2 : 1.2}
              filter={selectedBlock === 'master' ? 'url(#archGlow)' : undefined}
            />
            <text x="350" y="80" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
              MASTER GATEWAY
            </text>
            <text x="350" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">
              ESP32-S3 Substation
            </text>
            <text x="350" y="118" fill="#06b6d4" fontSize="9.5" fontWeight="bold" textAnchor="middle">
              {packetRate} pkt/s STREAM
            </text>
          </g>

          {/* Block 3: MQTT Broker */}
          <g
            className="cursor-pointer"
            onClick={() => { sound.playClick(); setSelectedBlock('mqtt'); }}
          >
            <rect
              x="520" y="45" width="180" height="90" rx="6"
              fill={selectedBlock === 'mqtt' ? '#0f2438' : '#0c1420'}
              stroke={selectedBlock === 'mqtt' ? '#06b6d4' : '#1e2d3d'}
              strokeWidth={selectedBlock === 'mqtt' ? 2 : 1.2}
              filter={selectedBlock === 'mqtt' ? 'url(#archGlow)' : undefined}
            />
            <text x="610" y="80" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
              MQTT BROKER
            </text>
            <text x="610" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">
              WSS :8883 Encrypted
            </text>
            <text x="610" y="118" fill="#10b981" fontSize="9.5" fontWeight="bold" textAnchor="middle">
              BROKER SYNCHRONIZED
            </text>
          </g>

          {/* Block 4: Surface Command Center */}
          <g
            className="cursor-pointer"
            onClick={() => { sound.playClick(); setSelectedBlock('console'); }}
          >
            <rect
              x="780" y="45" width="160" height="90" rx="6"
              fill={selectedBlock === 'console' ? '#0f2438' : '#0c1420'}
              stroke={selectedBlock === 'console' ? '#06b6d4' : '#06b6d4'}
              strokeWidth={2}
              filter="url(#archGlow)"
            />
            <text x="860" y="80" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
              COMMAND CENTER
            </text>
            <text x="860" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">
              Web Mission Deck
            </text>
            <text x="860" y="118" fill="#38bdf8" fontSize="9.5" fontWeight="bold" textAnchor="middle">
              ● YOU ARE HERE
            </text>
          </g>
        </svg>
      </div>

      {/* Selected Component Detailed Inspector Card */}
      <div className="bg-[#0b121b] rounded-lg p-4 border border-[#1b2633] text-xs font-mono">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded bg-cyan-400" />
            <h3 className="font-bold text-slate-100">{current.title}</h3>
          </div>
          <span className="text-[10px] text-slate-400">Click any block in diagram to inspect</span>
        </div>

        <p className="text-slate-300 font-sans leading-relaxed mb-3">
          {current.desc}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
          {current.specs.map(([label, val], idx) => (
            <div key={idx} className="bg-[#080d14] p-2 rounded border border-slate-800/60">
              <div className="text-[9px] text-slate-400 mb-0.5">{label}</div>
              <div className="text-slate-200 font-semibold truncate" title={val}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Complete MQTT Topics Registry Directory */}
      <div className="bg-[#0b121b] rounded-lg p-4 border border-[#1b2633] space-y-3 text-xs font-mono">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-slate-100">
              MQTT TOPICS SPECIFICATION DIRECTORY
            </h3>
            <span className="text-[10px] text-slate-400">
              (Documented in <code className="text-cyan-300">/MQTT_TOPICS.md</code>)
            </span>
          </div>

          {/* Action buttons & Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadTopics}
              className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-[11px] flex items-center gap-1.5 transition-colors"
              title="Download MQTT Topics documentation file"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download MQTT_TOPICS.md</span>
            </button>

            <button
              onClick={handleDownloadFirmware}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] flex items-center gap-1.5 transition-colors"
              title="Download ESP32 SentinelRover Arduino Firmware"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>ESP32 Firmware (.ino)</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded">
              {(['all', 'telemetry', 'rover', 'alerts', 'control'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => { sound.playClick(); setTopicCategory(cat); }}
                  className={`px-2 py-0.5 rounded uppercase text-[10px] transition-colors ${
                    topicCategory === cat
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Topics Table List */}
        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
          {filteredTopics.map((item, idx) => {
            const isCopied = copiedTopic === item.topic;
            return (
              <div
                key={idx}
                className="bg-[#080d14] border border-[#16212d] hover:border-slate-700 rounded p-2.5 flex flex-wrap items-center justify-between gap-3 transition-colors"
              >
                <div className="space-y-1 min-w-[280px] flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-cyan-300 font-bold text-xs bg-black/40 px-1.5 py-0.5 rounded border border-cyan-900/60">
                      {item.topic}
                    </code>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      QoS {item.qos}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {item.direction}
                    </span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-400 leading-normal">
                    {item.desc}
                  </p>
                </div>

                <button
                  onClick={() => handleCopyTopic(item.topic)}
                  className={`px-2.5 py-1 rounded text-[11px] border transition-colors flex items-center gap-1 shrink-0 ${
                    isCopied
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:text-slate-100'
                  }`}
                  title="Copy Topic string"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
