import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Sparkles, Volume2, Box, User as UserIcon } from 'lucide-react';
import { Button } from './ui/button';

export function LocalAgentSphere({
  t,
  onMessage,
  sentiment = 'default',
  callState = 'idle',
  audioLevel = 0,
  highPerformance = false,
  isWallpaperMode = false,
  onStartCall,
  onEndCall
}: {
  t: any;
  onMessage?: (text: string) => void;
  sentiment?: 'default' | 'excited' | 'focused' | 'zen';
  callState?: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';
  audioLevel?: number;
  highPerformance?: boolean;
  isWallpaperMode?: boolean;
  onStartCall?: () => void;
  onEndCall?: () => void;
}) {
  const [interactionPulse, setInteractionPulse] = useState(0);
  const [spatialMode, setSpatialMode] = useState<'geometric' | 'humanoid'>('geometric');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const rotationRef = useRef({ x: 0, y: 0 });
  const particleCount = highPerformance ? 2200 : 800;

  const toggleListen = () => {
    if (callState === 'idle') {
      onStartCall?.();
    } else {
      onEndCall?.();
    }
  };

  const handleSphereClick = () => {
    setInteractionPulse(prev => prev + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const particles: Particle[] = [];
    const sphereRadius = 180;

    class Particle {
      x: number;
      y: number;
      z: number;
      baseX: number;
      baseY: number;
      baseZ: number;
      color: string;
      size: number;
      type: 'signal' | 'core' | 'void';

      constructor() {
        if (spatialMode === 'humanoid') {
          // Approximate a humanoid shape
          const rand = Math.random();
          if (rand < 0.2) { // Head
            const u = Math.random(); const v = Math.random();
            const theta = 2 * Math.PI * u; const phi = Math.acos(2 * v - 1);
            const r = Math.pow(Math.random(), 1/3) * 40;
            this.baseX = r * Math.sin(phi) * Math.cos(theta);
            this.baseY = r * Math.sin(phi) * Math.sin(theta) - 140;
            this.baseZ = r * Math.cos(phi);
          } else if (rand < 0.7) { // Torso
            this.baseX = (Math.random() - 0.5) * 80;
            this.baseY = (Math.random() - 0.5) * 120 - 40;
            this.baseZ = (Math.random() - 0.5) * 40;
          } else { // Limbs
            this.baseX = (Math.random() - 0.5) * 140;
            this.baseY = (Math.random() - 0.5) * 180 + 40;
            this.baseZ = (Math.random() - 0.5) * 20;
          }
        } else {
          const u = Math.random();
          const v = Math.random();
          const theta = 2 * Math.PI * u;
          const phi = Math.acos(2 * v - 1);
          const r = Math.pow(Math.random(), 1/3) * sphereRadius;

          this.baseX = r * Math.sin(phi) * Math.cos(theta);
          this.baseY = r * Math.sin(phi) * Math.sin(theta);
          this.baseZ = r * Math.cos(phi);
        }
        
        this.x = this.baseX;
        this.y = this.baseY;
        this.z = this.baseZ;

        const rand = Math.random();
        if (rand < 0.4) {
          this.type = 'signal';
          this.color = callState === 'listening' ? '#ffcc00' : callState === 'speaking' ? '#ffffff' : '#ff4d4d';
        } else if (rand < 0.8) {
          this.type = 'core';
          this.color = '#ffffff';
        } else {
          this.type = 'void';
          this.color = '#000000';
        }
        
        this.size = Math.random() * 1.5 + 0.5;
      }

      update(time: number, rotX: number, rotY: number, currentCallState: string, currentAudioLevel: number) {
        // Dynamic color based on state
        if (this.type === 'signal') {
          this.color = currentCallState === 'listening' ? '#ffcc00' : currentCallState === 'speaking' ? '#ffffff' : '#ff4d4d';
        }

        const audioWave = currentAudioLevel * 50;
        const wave = Math.sin(time * 0.002 + (this.baseX + this.baseY + this.baseZ) * 0.01) * (15 + audioWave);
        const rFactor = (sphereRadius + wave) / sphereRadius;
        
        let tx = this.baseX * rFactor;
        let ty = this.baseY * rFactor;
        let tz = this.baseZ * rFactor;

        // Rotation
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y1 = ty * cosX - tz * sinX;
        const z1 = ty * sinX + tz * cosX;
        ty = y1;
        tz = z1;

        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x2 = tx * cosY + tz * sinY;
        const z2 = -tx * sinY + tz * cosY;
        tx = x2;
        tz = z2;

        this.x = tx;
        this.y = ty;
        this.z = tz;
      }

      draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const perspective = 600 / (600 - this.z);
        const x = this.x * perspective + centerX;
        const y = this.y * perspective + centerY;
        const size = this.size * perspective;

        if (this.color === '#000000') {
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = this.color;
          ctx.globalAlpha = Math.max(0.1, perspective - 0.4);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const speedFactor = callState === 'thinking' ? 4 : sentiment === 'excited' ? 3 : sentiment === 'focused' ? 2 : sentiment === 'zen' ? 0.5 : 1;
      
      if (!mouseRef.current.isDown) {
        rotationRef.current.y += 0.005 * speedFactor;
        rotationRef.current.x += 0.002 * speedFactor;
      }

      particles.sort((a, b) => a.z - b.z);

      particles.forEach(p => {
        p.update(time, rotationRef.current.x, rotationRef.current.y, callState, audioLevel);
        p.draw(ctx, centerX, centerY);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrameId);
  }, [spatialMode]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    mouseRef.current.isDown = true;
    const pos = 'touches' in e ? e.touches[0] : e;
    mouseRef.current.x = pos.clientX;
    mouseRef.current.y = pos.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!mouseRef.current.isDown) return;
    const pos = 'touches' in e ? e.touches[0] : e;
    const dx = pos.clientX - mouseRef.current.x;
    const dy = pos.clientY - mouseRef.current.y;
    
    rotationRef.current.y += dx * 0.01;
    rotationRef.current.x -= dy * 0.01;
    
    mouseRef.current.x = pos.clientX;
    mouseRef.current.y = pos.clientY;
  };

  const handleMouseUp = () => {
    mouseRef.current.isDown = false;
  };

  return (
    <div className={`relative w-full flex flex-col items-center justify-center py-20 overflow-hidden transition-all duration-1000 ${isWallpaperMode ? 'opacity-40 scale-[0.8] blur-[1px]' : 'opacity-100 scale-100'}`}>
      {/* Background Glow */}
      <div className={`absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-transparent pointer-events-none transition-opacity ${isWallpaperMode ? 'opacity-0' : 'opacity-100'}`} />
      
      {/* The Sphere Container - Particle Star Aesthetic */}
      <div 
        className="relative w-80 h-80 md:w-[500px] md:h-[500px] flex items-center justify-center cursor-grab active:cursor-grabbing group"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onClick={handleSphereClick}
      >
        {/* Glow Layers */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div 
            className="absolute w-64 h-64 md:w-96 md:h-96 rounded-full bg-red-500 blur-[80px] opacity-10"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </div>

        <canvas 
          ref={canvasRef}
          width={600}
          height={600}
          className="w-full h-full relative z-10"
        />
        
        {/* Interaction Pulse Rings */}
        <AnimatePresence>
          {[...Array(2)].map((_, i) => (
            <motion.div
              key={`${interactionPulse}-${i}`}
              className="absolute inset-0 rounded-full border border-red-500/20 pointer-events-none"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1.5, delay: i * 0.3 }}
            />
          ))}
        </AnimatePresence>

        {/* Celestial Orbital Rings */}
        <motion.div
          className="absolute inset-[-40px] rounded-full border border-white/5 border-dashed pointer-events-none"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Controls */}
      <div className="mt-12 flex flex-col items-center gap-6 z-10">
          <div className="flex items-center gap-4 p-1 bg-white/5 rounded-2xl border border-white/10">
            <button
              onClick={() => setSpatialMode('geometric')}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${
                spatialMode === 'geometric' ? 'bg-celestial-saturn text-black' : 'text-white/40 hover:text-white'
              }`}
            >
              <Box size={14} />
              {t.geometric || 'Geometric'}
            </button>
            <button
              onClick={() => setSpatialMode('humanoid')}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${
                spatialMode === 'humanoid' ? 'bg-celestial-saturn text-black' : 'text-white/40 hover:text-white'
              }`}
            >
              <UserIcon size={14} />
              {t.humanoid || 'Humanoid'}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={toggleListen}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${
                callState !== 'idle'
                  ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-110'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {callState === 'listening' ? <Mic size={24} className="animate-pulse" /> :
               callState === 'thinking' ? <Sparkles size={24} className="animate-spin" /> :
               callState === 'speaking' ? <Volume2 size={24} className="animate-pulse" /> :
               <MicOff size={24} />}
            </Button>

            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-white/40">
                {callState === 'listening' ? (t.listening || 'Listening') :
                 callState === 'thinking' ? (t.thinking || 'Thinking') :
                 callState === 'speaking' ? (t.speaking || 'Speaking') :
                 callState === 'connecting' ? (t.connecting || 'Connecting') :
                 t.voiceInteract || 'Voice Interact'}
              </span>
              <span className="text-sm font-medium text-white/80">
                {callState !== 'idle' ? "AI voice pipeline active..." : "Click to start voice command"}
              </span>
            </div>
          </div>

          <AnimatePresence>
            {(callState !== 'idle') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex gap-1"
              >
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-red-500 rounded-full"
                    animate={{
                      height: callState === 'listening' ? [10, 30, 10] : [10, 15, 10],
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
      </div>
    </div>
  );
}
