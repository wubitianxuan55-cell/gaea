import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Sparkles, Zap, Shield, Cpu, Globe, Users, Database, ShoppingBag, Ghost, ShieldCheck, ShoppingCart } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const SPIRITS = [
  { id: 1, name: 'Research Core', price: '2.5 ETH', desc: 'Advanced data analysis and literature review capabilities.' },
  { id: 2, name: 'Creative Pulse', price: '1.8 ETH', desc: 'Generative art and storytelling module for creative tasks.' },
  { id: 3, name: 'Logic Engine', price: '3.2 ETH', desc: 'High-precision mathematical and logical reasoning core.' },
];

const SKILLS = [
  { id: 1, name: 'Multi-Language', price: '0.5 ETH', desc: 'Instant translation across 50+ languages.' },
  { id: 2, name: 'Code Synthesis', price: '1.2 ETH', desc: 'Advanced programming and debugging assistant.' },
  { id: 3, name: 'Market Analysis', price: '0.8 ETH', desc: 'Real-time financial and market data processing.' },
];

export function LumiEcosystem({ t }: { t: any }) {
  const [hasDevice, setHasDevice] = useState(false);
  const [isIncubating, setIsIncubating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleIncubate = () => {
    if (!hasDevice) return;
    setIsIncubating(true);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsIncubating(false);
          return 100;
        }
        return prev + 1;
      });
    }, 50);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-24">
      {/* Incubation Section */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-5xl font-bold tracking-tighter glow-text">{t.incubationModule}</h2>
          <p className="text-white/60 max-w-2xl mx-auto">{t.incubationDesc}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative aspect-square glass rounded-[4rem] flex items-center justify-center overflow-hidden border-white/10 group">
            <div className={`absolute inset-0 bg-gradient-to-br from-red-500/10 via-celestial-saturn/10 to-celestial-glow/10 ${isIncubating ? 'animate-pulse' : ''}`} />
            
            {/* Floating Data Nodes */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-celestial-saturn/20 rounded-full border border-celestial-saturn/40"
                  initial={{ x: Math.random() * 100 + "%", y: Math.random() * 100 + "%" }}
                  animate={{
                    y: [0, -40, 0],
                    opacity: [0.2, 0.5, 0.2],
                  }}
                  transition={{
                    duration: 5 + Math.random() * 5,
                    repeat: Infinity,
                    delay: Math.random() * 5,
                  }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {progress === 100 ? (
                <motion.div
                  key="hatched"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative z-10 text-center space-y-6"
                >
                  <div className="w-48 h-48 rounded-full bg-celestial-saturn/20 flex items-center justify-center text-celestial-saturn mx-auto shadow-[0_0_50px_rgba(255,165,0,0.2)]">
                    <Rocket size={80} className="animate-bounce" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-bold">{t.hatched}</h3>
                    <Button className="bg-celestial-saturn text-black rounded-full px-8 hover:scale-105 transition-transform">{t.enterSpace}</Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="egg"
                  className="relative z-10 flex flex-col items-center gap-8"
                >
                  {/* Towering Egg Visual - Enhanced Crystalline/Energy Aesthetic */}
                  <div className="relative w-72 h-[450px] group-hover:scale-105 transition-transform duration-1000">
                    {/* Outer Celestial Glow */}
                    <div className="absolute inset-0 bg-celestial-saturn/10 blur-[100px] rounded-full animate-pulse" />
                    <div className="absolute inset-[-20px] bg-red-500/5 blur-[60px] rounded-full" />
                    
                    {/* The Egg Body - Crystalline Shell */}
                    <div className="relative w-full h-full bg-gradient-to-b from-white/20 via-white/5 to-black/60 border border-white/20 rounded-[100%_100%_100%_100%_/_140%_140%_60%_60%] flex items-center justify-center overflow-hidden shadow-[inset_0_0_60px_rgba(255,255,255,0.1)] backdrop-blur-sm">
                      {/* Crystalline Texture Overlay */}
                      <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                      
                      {/* Energy Cracks - SVG Paths */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 100 150">
                        <motion.path 
                          d="M50 20 L45 40 L55 60 L40 80 L60 110" 
                          fill="none" 
                          stroke="rgba(255,204,0,0.6)" 
                          strokeWidth="0.5"
                          animate={isIncubating ? { opacity: [0.2, 1, 0.2], pathLength: [0, 1, 0] } : { opacity: 0.1 }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <motion.path 
                          d="M30 50 L40 70 L35 90 L45 120" 
                          fill="none" 
                          stroke="rgba(255,77,77,0.4)" 
                          strokeWidth="0.5"
                          animate={isIncubating ? { opacity: [0.1, 0.8, 0.1], pathLength: [0, 1, 0] } : { opacity: 0.1 }}
                          transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                        />
                      </svg>

                      {/* Internal Energy Core - Pulsing Star-like essence */}
                      <motion.div 
                        animate={isIncubating ? { 
                          scale: [1, 1.4, 1],
                          opacity: [0.4, 0.8, 0.4],
                          rotate: [0, 180, 360]
                        } : {
                          scale: 1,
                          opacity: 0.3
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="relative z-10"
                      >
                        <div className="absolute inset-0 bg-celestial-saturn blur-2xl opacity-40" />
                        <Sparkles size={120} className="text-celestial-saturn relative z-10" />
                      </motion.div>

                      {/* Liquid/Energy Pool at bottom */}
                      <motion.div 
                        className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-celestial-saturn/20 via-red-500/5 to-transparent"
                        animate={isIncubating ? { height: ['40%', '60%', '40%'] } : { height: '40%' }}
                        transition={{ duration: 5, repeat: Infinity }}
                      />
                    </div>

                    {/* Structural Accents - Floating Rings */}
                    <motion.div 
                      className="absolute inset-x-[-40px] top-1/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div 
                      className="absolute inset-x-[-20px] bottom-1/4 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent"
                      animate={{ rotate: [-360, 0] }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Incubation Progress Overlay */}
                    {isIncubating && (
                      <div className="absolute -bottom-12 left-0 w-full px-4 space-y-3">
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-celestial-saturn/60">
                          <span>Incubating Essence</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-celestial-mars via-celestial-saturn to-celestial-glow shadow-[0_0_10px_rgba(255,165,0,0.5)]" 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-8">
            <Card className="glass p-8 rounded-[3rem] border-white/10 space-y-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${hasDevice ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  {hasDevice ? <ShieldCheck size={24} /> : <Shield size={24} />}
                </div>
                <div>
                  <h4 className="font-bold">Multimodal Device Status</h4>
                  <p className="text-sm text-white/40">{hasDevice ? 'Connected & Verified' : 'No Device Detected'}</p>
                </div>
              </div>

              {!hasDevice ? (
                <Button 
                  onClick={() => setHasDevice(true)}
                  className="w-full py-8 rounded-[2rem] bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 transition-all flex items-center gap-3"
                >
                  <ShoppingCart size={24} />
                  {t.buyDevice}
                </Button>
              ) : (
                <Button 
                  onClick={handleIncubate}
                  disabled={isIncubating || progress === 100}
                  className="w-full py-8 rounded-[2rem] bg-celestial-saturn text-black font-bold text-lg hover:scale-105 transition-transform flex items-center gap-3"
                >
                  <Rocket size={24} />
                  {t.initIncubation}
                </Button>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <EcosystemStat icon={<Cpu size={16} />} label={t.memory} value="128GB" />
              <EcosystemStat icon={<Globe size={16} />} label={t.sensing} value="Active" />
            </div>
          </div>
        </div>
      </section>

      {/* Marketplace Section */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-5xl font-bold tracking-tighter glow-text">{t.marketplace}</h2>
          <p className="text-white/60 max-w-2xl mx-auto">{t.marketDesc}</p>
        </div>

        <Tabs defaultValue="spirits" className="w-full">
          <div className="flex justify-center mb-12">
            <TabsList className="bg-white/5 border border-white/10 p-1.5 rounded-full h-auto">
              <TabsTrigger value="spirits" className="rounded-full px-10 py-3 data-[state=active]:bg-celestial-saturn data-[state=active]:text-black transition-all">
                {t.spirits}
              </TabsTrigger>
              <TabsTrigger value="skills" className="rounded-full px-10 py-3 data-[state=active]:bg-celestial-saturn data-[state=active]:text-black transition-all">
                {t.skills}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="spirits">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {SPIRITS.map(item => (
                <StoreCard key={item.id} item={item} icon={<Ghost size={24} />} t={t} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="skills">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {SKILLS.map(item => (
                <StoreCard key={item.id} item={item} icon={<Zap size={24} />} t={t} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function EcosystemStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass p-4 rounded-2xl border-white/5 flex items-center gap-4">
      <div className="text-celestial-saturn">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{label}</div>
        <div className="text-sm font-bold">{value}</div>
      </div>
    </div>
  );
}

function StoreCard({ item, icon, t }: { item: any; icon: React.ReactNode; t: any }) {
  return (
    <Card className="glass p-8 rounded-[3rem] border-white/10 space-y-6 group hover:border-celestial-saturn/30 transition-all flex flex-col h-full">
      <div className="flex justify-between items-start">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-celestial-saturn group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="text-sm font-bold text-celestial-saturn bg-celestial-saturn/10 px-3 py-1 rounded-full">
          {item.price}
        </div>
      </div>
      <div className="space-y-2 flex-1">
        <h3 className="text-xl font-bold tracking-tight">{item.name}</h3>
        <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
      </div>
      <Button className="w-full rounded-2xl bg-white/5 border border-white/10 hover:bg-celestial-saturn hover:text-black transition-all">
        {t.acquire}
      </Button>
    </Card>
  );
}
