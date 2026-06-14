/**
 * VoiceCenter — voice-first interaction center with LocalAgentSphere particle cloud
 * Preserves the original "cloud dot" visualization as the central element.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare } from 'lucide-react';
import { LocalAgentSphere } from './LocalAgentSphere';
import { socketService } from '../services/socketService';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Props {
  t: any;
  onSwitchToChat: () => void;
}

export function VoiceCenter({ t, onSwitchToChat }: Props) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mapState = (s: VoiceState): 'idle' | 'listening' | 'thinking' | 'speaking' => s;

  const updateLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    setAudioLevel(avg / 255);
    animRef.current = requestAnimationFrame(updateLevel);
  }, []);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    mediaStreamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    setResponse('');
    setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      updateLevel();

      // Emit voice session via socket
      const socket = socketService.getSocket();
      if (socket?.connected) {
        socket.emit('audio:start', { agentId: 'gaea' });

        const processor = ctx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(ctx.destination);
        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            int16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7FFF;
          }
          socket.emit('audio:chunk', int16.buffer);
        };

        socket.on('audio:transcript', (data: any) => {
          if (data.text) setTranscript(prev => prev + data.text);
          if (data.isFinal) {
            setState('thinking');
            socket.emit('audio:stop');
            cleanup();
          }
        });

        socket.on('audio:response', (data: any) => {
          setResponse(data.text || '');
          setState('speaking');
          setTimeout(() => setState('idle'), 4000);
        });

        socket.on('audio:error', (data: any) => {
          setError(data.message || 'Voice error');
          setState('idle');
          cleanup();
        });
      }

      setState('listening');
      elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err: any) {
      setError(err.name === 'NotAllowedError' ? 'Microphone access denied' : err.message);
      setState('idle');
    }
  }, [updateLevel, cleanup]);

  const stopListening = useCallback(() => {
    cleanup();
    const socket = socketService.getSocket();
    socket?.off('audio:transcript');
    socket?.off('audio:response');
    socket?.off('audio:error');
    setState('idle');
    setAudioLevel(0);
  }, [cleanup]);

  const handleStartCall = () => {
    if (state === 'idle') startListening();
  };

  const handleEndCall = () => {
    if (state === 'listening' || state === 'thinking') stopListening();
  };

  const handleInterrupt = () => {
    stopListening();
    setTranscript('');
    setResponse('');
  };

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20 z-10"
          >
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-300 hover:text-red-100">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ▸ Particle cloud sphere — the original "cloud dot" visualization */}
      <LocalAgentSphere
        t={t}
        callState={state}
        audioLevel={audioLevel}
        isMuted={isMuted}
        elapsedSeconds={elapsed}
        onStartCall={handleStartCall}
        onEndCall={handleEndCall}
        onInterrupt={handleInterrupt}
        onToggleMute={() => setIsMuted(m => !m)}
      />

      {/* Transcript display */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-xl text-center text-white/60 text-sm leading-relaxed px-4 -mt-6"
          >
            {transcript}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Response display */}
      <AnimatePresence>
        {response && state === 'speaking' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-xl text-center text-white/80 text-sm leading-relaxed bg-white/5 rounded-xl px-6 py-4 border border-white/5 mt-2"
          >
            {response}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switch to chat */}
      <button
        onClick={onSwitchToChat}
        className="flex items-center gap-2 text-xs text-white/20 hover:text-white/40 transition-colors font-mono uppercase tracking-wider mt-4 mb-2"
      >
        <MessageSquare size={14} />
        {t.switchToChat || '切换到文字对话'}
      </button>
    </div>
  );
}
