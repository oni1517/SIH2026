/**
 * Laptop & External USB Camera Management Service (Intel RealSense & USB Webcams)
 * Provides:
 *  - Automatic device detection (via devicechange event)
 *  - Intel RealSense camera identification & RGB sensor prioritization
 *  - Ultra-resilient WebRTC camera capture with multi-step fallback
 *  - Screen / Window Capture (getDisplayMedia) for mirroring Intel RealSense Viewer / Python / ROS
 *  - Local HTTP / MJPEG stream URL support (e.g. ROS web_video_server, Flask cv2)
 *  - Event subscriptions & connection status
 */

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  groupId: string;
  isRealSense: boolean;
  isDepthSensor: boolean;
  isRgbSensor: boolean;
}

export type StreamSourceMode = 'camera' | 'display' | 'url' | 'none';

export type CameraServiceEvent = 
  | { type: 'STATE_CHANGE' }
  | { type: 'DEVICE_DETECTED'; device: CameraDeviceInfo }
  | { type: 'DEVICE_REMOVED'; deviceId: string }
  | { type: 'STREAM_STARTED'; stream: MediaStream; sourceMode: StreamSourceMode; label: string }
  | { type: 'STREAM_STOPPED' }
  | { type: 'ERROR'; error: string; isDeviceInUse?: boolean };

type Listener = (event: CameraServiceEvent) => void;

class LaptopCameraService {
  private stream: MediaStream | null = null;
  private currentDeviceId: string | null = null;
  private isStreaming: boolean = false;
  private sourceMode: StreamSourceMode = 'none';
  private streamUrl: string | null = null;
  private activeLabel: string = 'Simulated Optics';
  private availableDevices: CameraDeviceInfo[] = [];
  private knownDeviceIds: Set<string> = new Set();
  private listeners: Set<Listener> = new Set();
  private lastError: string | null = null;
  private isDeviceInUseError: boolean = false;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      this.init();
    }
  }

  private async init() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      await this.refreshDevices(false);

      // Listen for hardware plug/unplug events (RealSense USB, Webcams, capture cards)
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        await this.handleDeviceChange();
      });
    } catch (err) {
      console.warn('[CameraService] Device enumeration init warning:', err);
    }
  }

  /**
   * Evaluates if a device label belongs to an Intel RealSense camera
   */
  public isRealSenseDevice(label: string): boolean {
    const l = label.toLowerCase();
    return (
      l.includes('realsense') ||
      l.includes('d435') ||
      l.includes('d415') ||
      l.includes('d455') ||
      l.includes('d405') ||
      l.includes('t265') ||
      l.includes('sr300') ||
      (l.includes('intel') && (l.includes('depth') || l.includes('camera')))
    );
  }

  /**
   * Refreshes the list of available video devices.
   * Classifies RealSense sensors and prioritizes RGB modules.
   */
  public async refreshDevices(detectNew = true): Promise<CameraDeviceInfo[]> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices: CameraDeviceInfo[] = allDevices
        .filter(d => d.kind === 'videoinput')
        .map((d, index) => {
          const label = d.label || `Camera Device #${index + 1} (Connected to Laptop)`;
          const isRealSense = this.isRealSenseDevice(label);
          const isDepthSensor = label.toLowerCase().includes('depth') || label.toLowerCase().includes('ir') || label.toLowerCase().includes('infrared');
          const isRgbSensor = isRealSense ? (label.toLowerCase().includes('rgb') || label.toLowerCase().includes('color') || !isDepthSensor) : true;

          return {
            deviceId: d.deviceId,
            label,
            groupId: d.groupId,
            isRealSense,
            isDepthSensor,
            isRgbSensor
          };
        })
        // Sort so that RealSense RGB cameras come first, followed by other webcams, and depth/IR sensors last
        .sort((a, b) => {
          if (a.isRealSense && a.isRgbSensor && (!b.isRealSense || !b.isRgbSensor)) return -1;
          if (b.isRealSense && b.isRgbSensor && (!a.isRealSense || !a.isRgbSensor)) return 1;
          if (a.isDepthSensor && !b.isDepthSensor) return 1;
          if (!a.isDepthSensor && b.isDepthSensor) return -1;
          return 0;
        });

      // Check for newly connected devices (e.g. user plugged in RealSense camera)
      if (detectNew && this.knownDeviceIds.size > 0) {
        for (const dev of videoDevices) {
          if (!this.knownDeviceIds.has(dev.deviceId) && dev.deviceId) {
            this.emit({ type: 'DEVICE_DETECTED', device: dev });
          }
        }
      }

      this.knownDeviceIds = new Set(videoDevices.map(d => d.deviceId));
      this.availableDevices = videoDevices;
      this.emit({ type: 'STATE_CHANGE' });
      return videoDevices;
    } catch (err: any) {
      this.lastError = err.message || 'Failed to enumerate camera devices';
      this.emit({ type: 'ERROR', error: this.lastError! });
      return [];
    }
  }

  private async handleDeviceChange() {
    const prevKnown = new Set(this.knownDeviceIds);
    const updatedDevices = await this.refreshDevices(false);

    // Identify newly added devices
    for (const dev of updatedDevices) {
      if (!prevKnown.has(dev.deviceId)) {
        this.emit({ type: 'DEVICE_DETECTED', device: dev });
      }
    }

    // Check if the current streaming device was disconnected
    if (this.isStreaming && this.sourceMode === 'camera' && this.currentDeviceId) {
      const stillPresent = updatedDevices.some(d => d.deviceId === this.currentDeviceId);
      if (!stillPresent) {
        this.stopStream();
        this.emit({ 
          type: 'ERROR', 
          error: 'Connected camera was disconnected from your laptop. Reverted to standby.' 
        });
      }
    }
  }

  /**
   * Starts live streaming from the selected or default camera.
   * Employs multi-tier progressive fallback to handle RealSense quirks & driver constraints.
   */
  public async startStream(deviceId?: string): Promise<MediaStream | null> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.lastError = 'Browser does not support mediaDevices.getUserMedia';
      this.emit({ type: 'ERROR', error: this.lastError });
      return null;
    }

    // Stop existing stream if active
    if (this.stream) {
      this.stopStream();
    }

    this.lastError = null;
    this.isDeviceInUseError = false;

    // Pick target device: either passed deviceId, or prefer RealSense RGB device
    let targetId = deviceId;
    if (!targetId && this.availableDevices.length > 0) {
      const realSenseRgb = this.availableDevices.find(d => d.isRealSense && d.isRgbSensor);
      targetId = realSenseRgb ? realSenseRgb.deviceId : this.availableDevices[0].deviceId;
    }

    // Attempt 1: Targeted constraints with ideal resolution
    let newStream: MediaStream | null = null;
    try {
      const constraints: MediaStreamConstraints = {
        video: targetId 
          ? { deviceId: { ideal: targetId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };
      newStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err1: any) {
      console.warn('[CameraService] Attempt 1 (ideal 720p) failed, attempting fallback...', err1);
      
      // If error is NotReadableError (device in use by RealSense Viewer or other app)
      if (err1.name === 'NotReadableError' || err1.name === 'TrackStartError') {
        return this.handleDeviceInUseError(err1);
      }

      // Attempt 2: Exact device ID without resolution constraints
      if (targetId) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: targetId } },
            audio: false
          });
        } catch (err2: any) {
          console.warn('[CameraService] Attempt 2 (exact deviceId) failed:', err2);
          if (err2.name === 'NotReadableError' || err2.name === 'TrackStartError') {
            return this.handleDeviceInUseError(err2);
          }
        }
      }

      // Attempt 3: Pure video: true without constraints
      if (!newStream) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (err3: any) {
          console.error('[CameraService] All camera getUserMedia attempts failed:', err3);
          return this.handleDeviceInUseError(err3);
        }
      }
    }

    if (!newStream) {
      return null;
    }

    this.stream = newStream;
    this.isStreaming = true;
    this.sourceMode = 'camera';
    this.streamUrl = null;

    const videoTrack = newStream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      this.currentDeviceId = settings.deviceId || targetId || 'default';
      this.activeLabel = videoTrack.label || 'Connected Camera Feed';

      // Monitor track ending
      videoTrack.onended = () => {
        this.stopStream();
        this.emit({
          type: 'ERROR',
          error: 'Camera video track ended or was disconnected from laptop.'
        });
      };
    }

    // Refresh devices to get real labels after permission grant
    await this.refreshDevices(false);

    this.emit({ 
      type: 'STREAM_STARTED', 
      stream: newStream, 
      sourceMode: 'camera', 
      label: this.activeLabel 
    });
    this.emit({ type: 'STATE_CHANGE' });
    return newStream;
  }

  /**
   * Starts live streaming via Window or Screen Sharing (getDisplayMedia).
   * This is the silver bullet for RealSense cameras: when the user has
   * Intel RealSense Viewer, a Python script, or ROS window open on their laptop,
   * they can share that window directly with zero driver locks or permission conflicts!
   */
  public async startDisplayStream(): Promise<MediaStream | null> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      this.lastError = 'Browser does not support screen or window capture.';
      this.emit({ type: 'ERROR', error: this.lastError });
      return null;
    }

    // Stop existing stream if active
    if (this.stream) {
      this.stopStream();
    }

    this.lastError = null;
    this.isDeviceInUseError = false;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
          frameRate: { ideal: 60, max: 60 }
        },
        audio: false
      });

      this.stream = displayStream;
      this.isStreaming = true;
      this.sourceMode = 'display';
      this.streamUrl = null;
      this.currentDeviceId = 'display-share';
      this.activeLabel = 'RealSense App Window / Screen Feed';

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        if (videoTrack.label) {
          this.activeLabel = `Window: ${videoTrack.label}`;
        }
        videoTrack.onended = () => {
          this.stopStream();
          this.emit({
            type: 'STREAM_STOPPED'
          });
        };
      }

      this.emit({
        type: 'STREAM_STARTED',
        stream: displayStream,
        sourceMode: 'display',
        label: this.activeLabel
      });
      this.emit({ type: 'STATE_CHANGE' });
      return displayStream;
    } catch (err: any) {
      this.isStreaming = false;
      this.stream = null;
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        this.lastError = err.message || 'Window sharing failed';
        this.emit({ type: 'ERROR', error: this.lastError! });
      }
      return null;
    }
  }

  /**
   * Starts streaming from a local HTTP/MJPEG URL (e.g. ROS web_video_server or Flask OpenCV)
   */
  public startUrlStream(url: string) {
    if (this.stream) {
      this.stopStream();
    }
    this.isStreaming = true;
    this.sourceMode = 'url';
    this.streamUrl = url;
    this.currentDeviceId = 'url-stream';
    this.activeLabel = `Local Stream: ${url}`;
    this.emit({ type: 'STATE_CHANGE' });
  }

  private handleDeviceInUseError(err: any): null {
    this.isStreaming = false;
    this.stream = null;
    this.isDeviceInUseError = true;

    const isLocked = err.name === 'NotReadableError' || err.name === 'TrackStartError';
    const errorMsg = isLocked
      ? 'RealSense camera is in use by another app (e.g. Intel RealSense Viewer or Python script). Close that app, or click "Stream RealSense Window" below to mirror it directly!'
      : err.name === 'NotAllowedError'
      ? 'Camera permission denied. Please allow camera access in your browser.'
      : err.message || 'Unable to access camera.';

    this.lastError = errorMsg;
    this.emit({ type: 'ERROR', error: errorMsg, isDeviceInUse: isLocked });
    return null;
  }

  /**
   * Stops the active camera stream.
   */
  public stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      this.stream = null;
    }
    this.isStreaming = false;
    this.sourceMode = 'none';
    this.streamUrl = null;
    this.emit({ type: 'STREAM_STOPPED' });
    this.emit({ type: 'STATE_CHANGE' });
  }

  /**
   * Toggles streaming state.
   */
  public async toggleStream(deviceId?: string): Promise<boolean> {
    if (this.isStreaming) {
      this.stopStream();
      return false;
    } else {
      const res = await this.startStream(deviceId || this.currentDeviceId || undefined);
      return res !== null;
    }
  }

  /**
   * Trigger manual device detection simulation for testing.
   */
  public simulateCameraConnected(label = 'Intel(R) RealSense(TM) Depth Camera D435 RGB') {
    const isRealSense = this.isRealSenseDevice(label);
    const mockDevice: CameraDeviceInfo = {
      deviceId: 'simulated-camera-' + Date.now(),
      label: label,
      groupId: 'simulated-group',
      isRealSense,
      isDepthSensor: false,
      isRgbSensor: true
    };
    this.availableDevices.unshift(mockDevice);
    this.knownDeviceIds.add(mockDevice.deviceId);
    this.emit({ type: 'DEVICE_DETECTED', device: mockDevice });
    this.emit({ type: 'STATE_CHANGE' });
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public getIsStreaming(): boolean {
    return this.isStreaming;
  }

  public getSourceMode(): StreamSourceMode {
    return this.sourceMode;
  }

  public getStreamUrl(): string | null {
    return this.streamUrl;
  }

  public getActiveLabel(): string {
    return this.activeLabel;
  }

  public getCurrentDeviceId(): string | null {
    return this.currentDeviceId;
  }

  public getAvailableDevices(): CameraDeviceInfo[] {
    return this.availableDevices;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getIsDeviceInUseError(): boolean {
    return this.isDeviceInUseError;
  }

  public hasRealSense(): boolean {
    return this.availableDevices.some(d => d.isRealSense);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: CameraServiceEvent) {
    this.listeners.forEach(fn => {
      try {
        fn(event);
      } catch (e) {
        console.error('[CameraService] Listener error:', e);
      }
    });
  }
}

export const laptopCameraService = new LaptopCameraService();
