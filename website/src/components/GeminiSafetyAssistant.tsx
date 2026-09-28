import React, { useState, useEffect, useRef } from 'react';
import { SensorNode, RobotState, AlertItem } from '../types';
import { 
  Bot, 
  Send, 
  Mic, 
  MicOff, 
  Sparkles, 
  Radio, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Cpu, 
  ShieldCheck, 
  Flame, 
  AlertTriangle, 
  Layers, 
  Check, 
  Copy,
  Zap,
  Activity,
  Terminal,
  MessageSquare,
  PhoneCall,
  PhoneOff
} from 'lucide-react';
import { sound } from '../utils/audio';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  model?: string;
  roleTitle?: string;
}

interface GeminiSafetyAssistantProps {
  nodes: SensorNode[];
  robot: RobotState;
  alerts: AlertItem[];
  onExecuteProtocol?: (protocol: string) => void;
}

export const GeminiSafetyAssistant: React.FC<GeminiSafetyAssistantProps> = ({
  nodes,
  robot,
  alerts,
  onExecuteProtocol
}) => {
  const [activeMode, setActiveMode] = useState<'chat' | 'voice'>('chat');

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      text: `Autonomous Mine Safety Advisor online. I am continuously monitoring 10 ESP32 sensor nodes across Levels -140m to -460m and Rover BOT-01.

Ask me to assess atmospheric risks, evaluate MSHA Title 30 CFR compliance, plan robotic inspection routes, or execute emergency muster protocols.`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      model: 'gemini-3-flash-preview',
      roleTitle: 'Chief Safety Engineer'
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3-flash-preview' | 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.1-pro-preview'>('gemini-3-flash-preview');
  const [selectedRole, setSelectedRole] = useState<'safety' | 'geotech' | 'dispatcher'>('safety');
  const [attachLiveContext, setAttachLiveContext] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Live Voice State (gemini-3.8-live)
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [transcriptHistory, setTranscriptHistory] = useState<{ speaker: 'User' | 'Gemini'; text: string; time: string }[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackQueueRef = useRef<{ buffer: AudioBuffer; onEnded?: () => void }[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const activeAudioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Auto-scroll chat thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Roles definition
  const roleConfigs = {
    safety: {
      name: 'Chief Safety Engineer',
      desc: 'MSHA Title 30 CFR compliance, ventilation airflow, explosive LEL safety limits',
      modelRecommendation: 'gemini-3-flash-preview' as const,
      systemInstruction: `You are the Chief Mine Safety Engineer for this subterranean mining operation.
Your responsibilities:
- Continuously enforce MSHA Title 30 CFR §75 atmospheric thresholds:
  * Methane (CH4): Warning at 150 ppm, Mandatory Evacuation at 200 ppm (1.0% LEL).
  * Carbon Monoxide (CO): Safe limit < 25 ppm, Warning at 50 ppm.
  * Oxygen (O2): Safe breathing range 19.5% - 23.5%.
- Evaluate ventilation airflow and booster fan RPM.
- Formulate immediate tactical safety recommendations with precise numerical rationale.`
    },
    geotech: {
      name: 'Geotechnical & Structural Specialist',
      desc: 'Rock mechanics, 3D LiDAR volumetric convergence, roof sag, fault slip analysis',
      modelRecommendation: 'gemini-3.1-pro-preview' as const,
      systemInstruction: `You are the Lead Geotechnical & Structural Rock Mechanics Specialist.
Your responsibilities:
- Analyze 3D LiDAR point cloud volumetric convergence and subterranean drift sag.
- Evaluate roof bolt tensile loads, seismic fault displacements, and rock spalling risks.
- Perform complex mathematical and structural engineering calculations for tunnel integrity.`
    },
    dispatcher: {
      name: 'Robotic Patrol Dispatcher',
      desc: 'High-speed emergency triage, Rover BOT-01 waypoints, instant incident response',
      modelRecommendation: 'gemini-3.1-flash-lite' as const,
      systemInstruction: `You are the Autonomous Robotic Fleet & Emergency Dispatcher.
Your responsibilities:
- Fast triage of sensor alarms and rapid dispatch of Rover BOT-01 to investigate hotspots.
- Prioritize high-speed execution, waypoint navigation, and emergency evacuation signals.
- Deliver extremely rapid, punchy, bulleted commands with zero fluff.`
    }
  };

  const handleRoleChange = (roleKey: 'safety' | 'geotech' | 'dispatcher') => {
    sound.playClick();
    setSelectedRole(roleKey);
    setSelectedModel(roleConfigs[roleKey].modelRecommendation);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputPrompt;
    if (!textToSend.trim() || isLoading) return;

    sound.playClick();
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour12: false })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Build live context payload
      const currentContext = attachLiveContext ? {
        undergroundPersonnel: '24 Miners tagged and accounted',
        activeAlerts: alerts.filter(a => !a.resolved).map(a => ({
          severity: a.severity,
          zone: a.zone,
          title: a.title,
          trend: a.trendRate || a.trend
        })),
        criticalNodes: nodes.filter(n => n.status !== 'normal').map(n => ({
          id: n.id,
          name: n.name,
          zone: n.zone,
          status: n.status,
          ch4_ppm: n.gas,
          temp_c: n.temp,
          battery: n.battery,
          trend: n.gasRate
        })),
        roverBOT01: {
          status: robot.status,
          depth: robot.depthMeters,
          speed: robot.speed,
          battery: robot.battery,
          waypoint: robot.currentWaypoint,
          lidarCoverage: `${robot.mapCoveragePct}%`,
          detections: robot.aiDetections.map(d => d.label)
        }
      } : null;

      const conversationHistory = [...messages.filter(m => !m.text.startsWith('[Error:')), userMsg].map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          model: selectedModel,
          systemInstruction: roleConfigs[selectedRole].systemInstruction,
          mineContext: currentContext
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Network response error' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      sound.playSuccess();

      const assistantMsg: Message = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour12: false }),
        model: data.model || selectedModel,
        roleTitle: roleConfigs[selectedRole].name
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      sound.playWarning();
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `[Error: Unable to connect with Gemini AI model (${selectedModel}). ${errorMsg}]`,
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
          model: selectedModel,
          roleTitle: 'System Diagnostic'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    sound.playClick();
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Convert Float32Array PCM audio into 16-bit PCM Base64 string for Live API
  const pcmToBase64 = (float32Array: Float32Array): string => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // 16-bit little endian
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Playback queue for streaming raw 24kHz PCM from Gemini Live
  const playNextInQueue = () => {
    if (!outputAudioCtxRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setVoiceStatus('listening');
      return;
    }

    isPlayingRef.current = true;
    setVoiceStatus('speaking');
    const nextItem = playbackQueueRef.current.shift();
    if (!nextItem) return;

    const source = outputAudioCtxRef.current.createBufferSource();
    source.buffer = nextItem.buffer;
    source.connect(outputAudioCtxRef.current.destination);
    activeAudioSourceNodeRef.current = source;

    source.onended = () => {
      activeAudioSourceNodeRef.current = null;
      if (nextItem.onEnded) nextItem.onEnded();
      playNextInQueue();
    };

    source.start();
  };

  const queuePcmAudioChunk = (base64Audio: string) => {
    if (!outputAudioCtxRef.current) return;
    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      // Gemini Live output sample rate is 24000 Hz
      const audioBuffer = outputAudioCtxRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      playbackQueueRef.current.push({ buffer: audioBuffer });
      if (!isPlayingRef.current) {
        playNextInQueue();
      }
    } catch (decodeErr) {
      console.error('[Live Voice] Error decoding audio chunk:', decodeErr);
    }
  };

  const stopAudioPlayback = () => {
    if (activeAudioSourceNodeRef.current) {
      try {
        activeAudioSourceNodeRef.current.stop();
      } catch {}
      activeAudioSourceNodeRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
  };

  // Start Gemini Live API Voice Session
  const startLiveVoiceSession = async () => {
    sound.playClick();
    setVoiceError(null);
    setVoiceStatus('connecting');

    try {
      // 1. Initialize Audio Contexts
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      inputAudioCtxRef.current = new AudioCtx({ sampleRate: 16000 });
      outputAudioCtxRef.current = new AudioCtx({ sampleRate: 24000 });

      // Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 2. Connect to server-side WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setVoiceStatus('listening');
        setIsVoiceActive(true);
        sound.playSuccess();

        // 3. Audio input capture (16kHz PCM)
        if (!inputAudioCtxRef.current) return;
        const source = inputAudioCtxRef.current.createMediaStreamSource(stream);
        audioSourceRef.current = source;
        const processor = inputAudioCtxRef.current.createScriptProcessor(4096, 1, 1);
        audioProcessorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputChannel = e.inputBuffer.getChannelData(0);
            const base64Pcm = pcmToBase64(inputChannel);
            ws.send(JSON.stringify({ audio: base64Pcm }));
          }
        };

        source.connect(processor);
        processor.connect(inputAudioCtxRef.current.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Audio chunk from Gemini Live
          if (msg.audio) {
            queuePcmAudioChunk(msg.audio);
          }

          // Live transcript
          if (msg.text) {
            setLiveTranscript(prev => prev + msg.text);
          }

          // Turn complete
          if (msg.turnComplete) {
            setLiveTranscript(currentText => {
              if (currentText.trim()) {
                setTranscriptHistory(prev => [
                  ...prev,
                  { speaker: 'Gemini', text: currentText.trim(), time: new Date().toLocaleTimeString([], { hour12: false }) }
                ]);
              }
              return '';
            });
          }

          // User interruption
          if (msg.interrupted) {
            stopAudioPlayback();
            setLiveTranscript('');
            setVoiceStatus('listening');
          }

          if (msg.error) {
            setVoiceError(msg.error);
            setVoiceStatus('error');
          }
        } catch (err) {
          console.error('[Live Voice] Failed to parse message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[Live Voice] WebSocket error:', err);
        setVoiceError('WebSocket connection failure to Live API gateway.');
        setVoiceStatus('error');
      };

      ws.onclose = () => {
        stopLiveVoiceSession();
      };
    } catch (err: unknown) {
      console.error('[Live Voice] Initialization failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setVoiceError(msg);
      setVoiceStatus('error');
      stopLiveVoiceSession();
    }
  };

  const stopLiveVoiceSession = () => {
    stopAudioPlayback();

    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsVoiceActive(false);
    setVoiceStatus('idle');
    setLiveTranscript('');
  };

  return (
    <div className="bg-[#090f17] rounded-lg border border-[#1a2533] overflow-hidden shadow-xl flex flex-col h-[750px] max-h-[85vh]">
      {/* Top Header & Mode Tabs */}
      <div className="p-3.5 bg-[#0c1420] border-b border-[#182330] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              GEMINI SUBTERRANEAN SAFETY DISPATCH
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-500/40">
                AI ADVISOR
              </span>
            </h2>
            <div className="text-[10px] text-slate-400">
              Multi-Turn Autonomous Decision Support &amp; Live Voice Intercom
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs: Multi-Turn Chat vs Live Voice */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { sound.playClick(); setActiveMode('chat'); }}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 border transition-colors ${
              activeMode === 'chat'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)] font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Multi-Turn Chat</span>
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveMode('voice'); }}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 border transition-colors ${
              activeMode === 'voice'
                ? 'bg-purple-950 text-purple-300 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)] font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 text-purple-400" />
            <span>Gemini Live Voice</span>
            {isVoiceActive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
          </button>
        </div>
      </div>

      {/* CHAT MODE */}
      {activeMode === 'chat' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Controls Bar: Model & Role Selection */}
          <div className="px-4 py-2 bg-[#080d14] border-b border-[#182330] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Roles Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 text-[11px]">ROLE:</span>
              {(['safety', 'geotech', 'dispatcher'] as const).map(roleKey => (
                <button
                  key={roleKey}
                  onClick={() => handleRoleChange(roleKey)}
                  className={`px-2.5 py-1 rounded border text-[11px] transition-colors ${
                    selectedRole === roleKey
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {roleConfigs[roleKey].name}
                </button>
              ))}
            </div>

            {/* Model Selector */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-slate-400 text-[11px]">MODEL:</span>
              <select
                value={selectedModel}
                onChange={(e) => { sound.playClick(); setSelectedModel(e.target.value as any); }}
                className="bg-slate-900 border border-slate-800 text-slate-200 px-2 py-1 rounded text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="gemini-3-flash-preview">gemini-3-flash-preview (High Availability · Primary)</option>
                <option value="gemini-3.8-flash">gemini-3.8-flash (General Tasks)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast Triage)</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Tasks)</option>
              </select>

              {/* Attach Context Toggle */}
              <button
                onClick={() => setAttachLiveContext(!attachLiveContext)}
                className={`px-2 py-1 rounded border text-[10px] transition-colors ${
                  attachLiveContext
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title="Automatically feeds real-time sensor node readings, active alarms, and rover telemetry to Gemini"
              >
                {attachLiveContext ? '✓ Live Telemetry Linked' : 'No Telemetry Link'}
              </button>
            </div>
          </div>

          {/* Quick Prompt Inquiry Chips */}
          <div className="px-4 py-2 bg-[#090f17] border-b border-[#141d27] flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px] font-mono">
            <span className="text-slate-500 shrink-0">Inquiries:</span>
            {[
              'Evaluate current Methane spike at Node 08',
              'Check ventilation airflow capacity for Level -380m',
              'Recommend evacuation protocol for Stope A-1',
              'Analyze BOT-01 battery and LiDAR convergence'
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-cyan-300 border border-slate-800 whitespace-nowrap transition-colors shrink-0"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Scrollable Conversation Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              const isCopied = copiedId === msg.id;
              const isError = msg.text.startsWith('[Error:');

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] ${isAssistant ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center shrink-0 border text-xs font-bold ${
                      isError
                        ? 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                        : isAssistant
                        ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    {isError ? '!' : isAssistant ? 'AI' : 'OP'}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-lg p-3.5 border transition-all ${
                      isError
                        ? 'bg-rose-950/30 text-rose-200 border-rose-800/60 shadow-md'
                        : isAssistant
                        ? 'bg-[#0c1420] text-slate-200 border-[#1a293b] shadow-md'
                        : 'bg-[#0f1d2e] text-cyan-100 border-cyan-800/60'
                    }`}
                  >
                    {/* Header info */}
                    <div className="flex items-center justify-between gap-3 pb-1.5 mb-1.5 border-b border-slate-800/60 text-[10px] text-slate-400">
                      <span className={`font-semibold ${isError ? 'text-rose-400' : 'text-slate-300'}`}>
                        {isError ? 'System Connection Alert' : isAssistant ? (msg.roleTitle || 'Safety Advisor') : 'Control Surface Operator'}
                      </span>
                      <div className="flex items-center gap-2">
                        {msg.model && (
                          <span className={isError ? 'text-rose-400' : 'text-cyan-400'}>{msg.model}</span>
                        )}
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="font-sans whitespace-pre-wrap leading-relaxed text-xs">
                      {msg.text}
                    </div>

                    {/* Error Recovery Action */}
                    {isError && (
                      <div className="pt-2.5 mt-2 border-t border-rose-800/40 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-rose-300/80">Primary model high-demand spike detected.</span>
                        <button
                          onClick={() => {
                            setSelectedModel('gemini-3-flash-preview');
                            // Find the last user prompt to retry
                            const lastUser = [...messages].reverse().find(m => m.role === 'user');
                            if (lastUser) {
                              handleSendMessage(lastUser.text);
                            }
                          }}
                          className="px-2 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-mono text-[10.5px] font-bold transition-colors"
                        >
                          Retry with High-Availability Model
                        </button>
                      </div>
                    )}

                    {/* Footer Actions */}
                    {isAssistant && !isError && (
                      <div className="flex items-center justify-end gap-2 pt-2 mt-2 border-t border-slate-800/60 text-[10px]">
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3 max-w-[80%] mr-auto">
                <div className="w-7 h-7 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-[#0c1420] rounded-lg p-3 border border-[#1a293b] flex items-center gap-2 text-slate-400 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Analyzing subterranean telemetry &amp; generating safety assessment...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-3 bg-[#0c1420] border-t border-[#182330]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Ask about mine atmosphere, MSHA limits, rockbolt sag, rover dispatch..."
                disabled={isLoading}
                className="flex-1 bg-slate-900 border border-slate-800 text-slate-100 rounded-lg px-3.5 py-2 text-xs font-sans focus:outline-none focus:border-cyan-500 transition-colors"
              />

              <button
                type="submit"
                disabled={isLoading || !inputPrompt.trim()}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* GEMINI LIVE VOICE INTERCOM MODE (gemini-3.8-live) */}
      {activeMode === 'voice' && (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6 text-xs font-mono">
          <div className="bg-[#0c1420] border border-[#1b2633] rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative flex items-center justify-center">
              {/* Pulsing radar rings when active */}
              {isVoiceActive && (
                <>
                  <div className="absolute w-32 h-32 rounded-full border border-purple-500/30 animate-ping" />
                  <div className="absolute w-44 h-44 rounded-full border border-purple-500/10 animate-pulse" />
                </>
              )}

              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all shadow-xl ${
                  isVoiceActive
                    ? voiceStatus === 'speaking'
                      ? 'bg-purple-900/60 border-purple-400 text-purple-200 shadow-[0_0_25px_rgba(168,85,247,0.5)]'
                      : 'bg-emerald-900/60 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}
              >
                {isVoiceActive ? (
                  <Mic className="w-8 h-8 animate-pulse" />
                ) : (
                  <MicOff className="w-8 h-8" />
                )}
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center justify-center gap-2">
                GEMINI LIVE VOICE INTERCOM
                <span className="text-[10px] text-purple-400 font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-500/40">
                  gemini-3.8-live
                </span>
              </h3>
              <p className="text-slate-400 font-sans text-xs mt-1 max-w-md mx-auto">
                Real-time low-latency bidirectional voice communication directly with Gemini Live API. Speak aloud to ask questions or issue dispatch commands.
              </p>
            </div>

            {/* Voice Status Pill */}
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider flex items-center gap-1.5 ${
                voiceStatus === 'speaking'
                  ? 'bg-purple-950 text-purple-300 border-purple-500/50 animate-pulse'
                  : voiceStatus === 'listening'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                  : voiceStatus === 'connecting'
                  ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                  : voiceStatus === 'error'
                  ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  isVoiceActive ? 'bg-current animate-ping' : 'bg-slate-600'
                }`} />
                <span>
                  {voiceStatus === 'speaking' ? 'Gemini Speaking...' : 
                   voiceStatus === 'listening' ? 'Listening to Microphone (16kHz PCM)...' : 
                   voiceStatus === 'connecting' ? 'Connecting to Live API...' :
                   voiceStatus === 'error' ? 'Session Error' : 'Intercom Idle'}
                </span>
              </span>
            </div>

            {voiceError && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/50 text-rose-300 rounded text-xs max-w-lg">
                {voiceError}
              </div>
            )}

            {/* Main Action Toggle Button */}
            <div>
              {!isVoiceActive ? (
                <button
                  onClick={startLiveVoiceSession}
                  className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Start Live Voice Intercom</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      stopAudioPlayback();
                      sound.playClick();
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5"
                  >
                    <VolumeX className="w-4 h-4" />
                    <span>Interrupt Playback</span>
                  </button>

                  <button
                    onClick={stopLiveVoiceSession}
                    className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 shadow"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>End Voice Session</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Live Transcript Stream Box */}
          <div className="flex-1 bg-[#080d14] rounded-lg border border-[#1b2633] p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400">
              <span className="font-bold text-slate-200">LIVE AUDIO TRANSCRIPTION FEED</span>
              <span className="text-[10px]">Real-time Model Output</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-48 pr-1">
              {transcriptHistory.length === 0 && !liveTranscript ? (
                <div className="text-slate-500 text-center py-6">
                  {isVoiceActive
                    ? 'Start speaking into your microphone to hear Gemini Live respond in real time.'
                    : 'Live transcription will appear here when an intercom session is active.'}
                </div>
              ) : (
                <>
                  {transcriptHistory.map((item, idx) => (
                    <div key={idx} className="p-2 rounded bg-[#0c1420] border border-slate-800">
                      <div className="text-[10px] text-purple-400 font-bold flex justify-between">
                        <span>{item.speaker}</span>
                        <span className="text-slate-500">{item.time}</span>
                      </div>
                      <p className="text-slate-200 font-sans text-xs mt-0.5">{item.text}</p>
                    </div>
                  ))}

                  {liveTranscript && (
                    <div className="p-2 rounded bg-purple-950/40 border border-purple-500/40 animate-pulse">
                      <div className="text-[10px] text-purple-400 font-bold">Gemini (Streaming...)</div>
                      <p className="text-purple-100 font-sans text-xs mt-0.5">{liveTranscript}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
