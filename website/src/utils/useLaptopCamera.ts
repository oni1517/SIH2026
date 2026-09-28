import { useState, useEffect, useCallback } from 'react';
import { 
  laptopCameraService, 
  CameraDeviceInfo,
  StreamSourceMode
} from './laptopCameraService';
import { sound } from './audio';

export interface UseLaptopCameraResult {
  isStreaming: boolean;
  stream: MediaStream | null;
  sourceMode: StreamSourceMode;
  streamUrl: string | null;
  activeLabel: string;
  devices: CameraDeviceInfo[];
  selectedDeviceId: string | null;
  error: string | null;
  isDeviceInUseError: boolean;
  hasRealSense: boolean;
  detectedPromptDevice: CameraDeviceInfo | null;
  startStream: (deviceId?: string) => Promise<boolean>;
  startDisplayStream: () => Promise<boolean>;
  startUrlStream: (url: string) => void;
  stopStream: () => void;
  toggleStream: (deviceId?: string) => Promise<boolean>;
  refreshDevices: () => Promise<void>;
  dismissDetectedPrompt: () => void;
  simulateConnect: (label?: string) => void;
  clearError: () => void;
}

export function useLaptopCamera(): UseLaptopCameraResult {
  const [isStreaming, setIsStreaming] = useState<boolean>(laptopCameraService.getIsStreaming());
  const [stream, setStream] = useState<MediaStream | null>(laptopCameraService.getStream());
  const [sourceMode, setSourceMode] = useState<StreamSourceMode>(laptopCameraService.getSourceMode());
  const [streamUrl, setStreamUrl] = useState<string | null>(laptopCameraService.getStreamUrl());
  const [activeLabel, setActiveLabel] = useState<string>(laptopCameraService.getActiveLabel());
  const [devices, setDevices] = useState<CameraDeviceInfo[]>(laptopCameraService.getAvailableDevices());
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(laptopCameraService.getCurrentDeviceId());
  const [error, setError] = useState<string | null>(laptopCameraService.getLastError());
  const [isDeviceInUseError, setIsDeviceInUseError] = useState<boolean>(laptopCameraService.getIsDeviceInUseError());
  const [hasRealSense, setHasRealSense] = useState<boolean>(laptopCameraService.hasRealSense());
  const [detectedPromptDevice, setDetectedPromptDevice] = useState<CameraDeviceInfo | null>(null);

  const syncState = useCallback(() => {
    setIsStreaming(laptopCameraService.getIsStreaming());
    setStream(laptopCameraService.getStream());
    setSourceMode(laptopCameraService.getSourceMode());
    setStreamUrl(laptopCameraService.getStreamUrl());
    setActiveLabel(laptopCameraService.getActiveLabel());
    setDevices(laptopCameraService.getAvailableDevices());
    setSelectedDeviceId(laptopCameraService.getCurrentDeviceId());
    setError(laptopCameraService.getLastError());
    setIsDeviceInUseError(laptopCameraService.getIsDeviceInUseError());
    setHasRealSense(laptopCameraService.hasRealSense());
  }, []);

  useEffect(() => {
    // Initial sync
    syncState();

    const unsubscribe = laptopCameraService.subscribe((event) => {
      switch (event.type) {
        case 'STATE_CHANGE':
        case 'STREAM_STARTED':
        case 'STREAM_STOPPED':
          syncState();
          break;

        case 'DEVICE_DETECTED':
          setDetectedPromptDevice(event.device);
          sound.playWarning(); // Chime for newly plugged hardware
          syncState();
          break;

        case 'ERROR':
          setError(event.error);
          setIsDeviceInUseError(!!event.isDeviceInUse);
          break;
      }
    });

    // Check devices on mount
    laptopCameraService.refreshDevices(false).then((devs) => {
      setDevices(devs);
      setHasRealSense(devs.some(d => d.isRealSense));
    });

    return () => {
      unsubscribe();
    };
  }, [syncState]);

  const startStream = useCallback(async (deviceId?: string) => {
    sound.playClick();
    const targetId = deviceId || selectedDeviceId || undefined;
    const mediaStream = await laptopCameraService.startStream(targetId);
    if (mediaStream) {
      sound.playSuccess();
      setDetectedPromptDevice(null);
      syncState();
      return true;
    }
    syncState();
    return false;
  }, [selectedDeviceId, syncState]);

  const startDisplayStream = useCallback(async () => {
    sound.playClick();
    const mediaStream = await laptopCameraService.startDisplayStream();
    if (mediaStream) {
      sound.playSuccess();
      setDetectedPromptDevice(null);
      syncState();
      return true;
    }
    syncState();
    return false;
  }, [syncState]);

  const startUrlStream = useCallback((url: string) => {
    sound.playSuccess();
    laptopCameraService.startUrlStream(url);
    setDetectedPromptDevice(null);
    syncState();
  }, [syncState]);

  const stopStream = useCallback(() => {
    sound.playClick();
    laptopCameraService.stopStream();
    syncState();
  }, [syncState]);

  const toggleStream = useCallback(async (deviceId?: string) => {
    if (isStreaming) {
      stopStream();
      return false;
    } else {
      return await startStream(deviceId);
    }
  }, [isStreaming, startStream, stopStream]);

  const refreshDevices = useCallback(async () => {
    const devs = await laptopCameraService.refreshDevices(true);
    setDevices(devs);
    setHasRealSense(devs.some(d => d.isRealSense));
  }, []);

  const dismissDetectedPrompt = useCallback(() => {
    setDetectedPromptDevice(null);
  }, []);

  const simulateConnect = useCallback((label?: string) => {
    laptopCameraService.simulateCameraConnected(label || 'Intel(R) RealSense(TM) Depth Camera D435 RGB');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setIsDeviceInUseError(false);
  }, []);

  return {
    isStreaming,
    stream,
    sourceMode,
    streamUrl,
    activeLabel,
    devices,
    selectedDeviceId,
    error,
    isDeviceInUseError,
    hasRealSense,
    detectedPromptDevice,
    startStream,
    startDisplayStream,
    startUrlStream,
    stopStream,
    toggleStream,
    refreshDevices,
    dismissDetectedPrompt,
    simulateConnect,
    clearError
  };
}
