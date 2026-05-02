import { useState, useRef, useCallback, useEffect } from 'react';

export type CallState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

interface UseVoiceCallOptions {
  socket: any;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponse?: (text: string) => void;
}

export function useVoiceCall({ socket, onTranscript, onResponse }: UseVoiceCallOptions) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number>(0);
  const pendingAudio = useRef<ArrayBuffer[]>([]);
  const isPlaying = useRef(false);
  const playbackSource = useRef<AudioBufferSourceNode | null>(null);
  const audioQueueContext = useRef<AudioContext | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (!analyser.current) return;
    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    setAudioLevel(rms);
    animationFrame.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  // Play audio buffer queue
  const playNextInQueue = useCallback(() => {
    if (isPlaying.current || pendingAudio.current.length === 0) return;

    const buffer = pendingAudio.current.shift()!;
    isPlaying.current = true;

    if (!audioQueueContext.current) {
      audioQueueContext.current = new AudioContext();
    }

    audioQueueContext.current.decodeAudioData(buffer.slice(0), (decoded) => {
      if (playbackSource.current) {
        try { playbackSource.current.stop(); } catch {}
      }

      const source = audioQueueContext.current!.createBufferSource();
      source.buffer = decoded;
      source.connect(audioQueueContext.current!.destination);
      playbackSource.current = source;

      source.onended = () => {
        isPlaying.current = false;
        playbackSource.current = null;
        if (pendingAudio.current.length > 0) {
          playNextInQueue();
        }
      };

      source.start(0);
    }, () => {
      isPlaying.current = false;
      if (pendingAudio.current.length > 0) playNextInQueue();
    });
  }, []);

  const stopPlayback = useCallback(() => {
    if (playbackSource.current) {
      try { playbackSource.current.stop(); } catch {}
      playbackSource.current = null;
    }
    pendingAudio.current = [];
    isPlaying.current = false;
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('audio:status', (data: { status: string }) => {
      const map: Record<string, CallState> = {
        listening: 'listening',
        thinking: 'thinking',
        speaking: 'speaking',
        idle: 'idle',
      };
      setCallState(map[data.status] || 'idle');
    });

    socket.on('audio:response', (data: ArrayBuffer) => {
      pendingAudio.current.push(data);
      playNextInQueue();
    });

    socket.on('audio:transcript', (data: { text: string; isFinal: boolean }) => {
      onTranscript?.(data.text, data.isFinal);
    });

    socket.on('agent:response', (data: { text: string }) => {
      onResponse?.(data.text);
    });

    socket.on('audio:error', (data: { message: string }) => {
      setError(data.message);
      setCallState('idle');
    });

    socket.on('audio:interrupt-ack', () => {
      stopPlayback();
      setCallState('listening');
    });

    return () => {
      socket.off('audio:status');
      socket.off('audio:response');
      socket.off('audio:transcript');
      socket.off('agent:response');
      socket.off('audio:error');
      socket.off('audio:interrupt-ack');
    };
  }, [socket, onTranscript, onResponse, playNextInQueue, stopPlayback]);

  const startCall = useCallback(async (voiceId?: string, personalityId: string = 'lumi') => {
    try {
      setError(null);
      setCallState('connecting');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Set up audio level monitoring
      audioContext.current = new AudioContext();
      const source = audioContext.current.createMediaStreamSource(stream);
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      source.connect(analyser.current);
      updateAudioLevel();

      // Set up MediaRecorder for sending chunks
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      mediaRecorder.current = new MediaRecorder(stream, { mimeType });

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0 && socket?.connected) {
          e.data.arrayBuffer().then((buf) => {
            socket.emit('audio:chunk', new Uint8Array(buf));
          });
        }
      };

      mediaRecorder.current.start(100); // 100ms chunks

      socket.emit('audio:start', { voiceId, personalityId });
    } catch (err: any) {
      setError(err.message || 'Failed to start voice call');
      setCallState('idle');
    }
  }, [socket, updateAudioLevel]);

  const interrupt = useCallback(() => {
    if (callState === 'speaking' || callState === 'thinking') {
      socket?.emit('audio:interrupt');
      stopPlayback();
    }
  }, [socket, callState, stopPlayback]);

  const endCall = useCallback(() => {
    socket?.emit('audio:stop');
    stopPlayback();

    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (audioContext.current) {
      audioContext.current.close();
      audioContext.current = null;
    }

    if (audioQueueContext.current) {
      audioQueueContext.current.close();
      audioQueueContext.current = null;
    }

    cancelAnimationFrame(animationFrame.current);
    setCallState('idle');
    setAudioLevel(0);
    pendingAudio.current = [];
  }, [socket, stopPlayback]);

  // Detect interruption: if user speaks while AI is speaking
  useEffect(() => {
    const threshold = 0.15;
    if (audioLevel > threshold && (callState === 'speaking' || callState === 'thinking')) {
      interrupt();
    }
  }, [audioLevel, callState, interrupt]);

  return {
    callState,
    audioLevel,
    error,
    startCall,
    endCall,
    interrupt,
    clearError: () => setError(null),
  };
}
