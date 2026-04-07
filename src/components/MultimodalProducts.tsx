import React from 'react';
import { motion } from 'motion/react';
import { Smartphone, Watch, Headphones, Tablet, Cpu, Zap, Shield, Globe, ShoppingCart } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

export function MultimodalProducts({ t }: { t: any }) {
  return (
    <div className="max-w-7xl mx-auto space-y-16">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold tracking-tighter glow-text">{t.multimodalProducts}</h1>
        <p className="text-xl text-white/60 max-w-2xl mx-auto">Hardware designed to bridge the gap between digital intelligence and physical reality.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <ProductCard 
          icon={<Cpu size={40} className="text-celestial-saturn" />}
          title="Lumi Core Node"
          price="$499"
          desc="The ultimate local processing unit. 128GB Unified Memory, 20-core Neural Engine."
          specs={['Local LLM Hosting', 'Encrypted Storage', 'Multi-Agent Sync']}
          t={t}
        />
        <ProductCard 
          icon={<Watch size={40} className="text-celestial-mars" />}
          title="Neural Link Watch"
          price="$299"
          desc="Real-time Agent synchronization on your wrist. Biometric feedback loop."
          specs={['Haptic Feedback', 'Voice Interface', 'Health Monitoring']}
          t={t}
        />
        <ProductCard 
          icon={<Headphones size={40} className="text-celestial-glow" />}
          title="Aural Essence Pro"
          price="$199"
          desc="High-fidelity voice synthesis and spatial audio for immersive Agent interaction."
          specs={['Active Noise Cancellation', 'Voice Cloning Support', '40h Battery']}
          t={t}
        />
      </div>

      <Card className="glass p-12 rounded-[4rem] border-white/10 overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-celestial-saturn/10 via-transparent to-celestial-mars/10 opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold tracking-tighter">The Ecosystem Advantage</h2>
              <p className="text-white/60 leading-relaxed">LumiAI hardware is built with a privacy-first philosophy. Unlike traditional smart devices, all data processing happens locally on your Core Node. Your voice, your biometric data, and your Agent's memory never leave your physical possession.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <Feature icon={<Shield size={20} />} title="Zero Cloud" desc="No data upload." />
              <Feature icon={<Zap size={20} />} title="Instant Sync" desc="Low latency." />
            </div>
            <Button className="bg-celestial-saturn text-black rounded-full px-10 py-6 font-bold text-lg hover:scale-105 transition-transform">Explore Technology</Button>
          </div>
          <div className="relative aspect-square flex items-center justify-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border border-white/5 border-dashed"
            />
            <div className="w-64 h-64 rounded-full bg-gradient-to-br from-white/10 to-black/40 border border-white/10 flex items-center justify-center shadow-[0_0_50px_rgba(255,204,0,0.1)]">
              <Cpu size={80} className="text-celestial-saturn animate-pulse" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ProductCard({ icon, title, price, desc, specs, t }: { icon: React.ReactNode; title: string; price: string; desc: string; specs: string[]; t: any }) {
  return (
    <Card className="glass p-8 rounded-[3rem] border-white/10 flex flex-col justify-between hover:border-celestial-saturn/30 transition-all group">
      <div className="space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
            <span className="text-celestial-saturn font-bold">{price}</span>
          </div>
          <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">{t.specifications}</p>
          <ul className="space-y-2">
            {specs.map((spec, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-white/60">
                <div className="w-1 h-1 rounded-full bg-celestial-saturn" />
                {spec}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Button className="w-full mt-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-celestial-saturn hover:text-black transition-all flex items-center gap-2 py-6">
        <ShoppingCart size={18} />
        {t.buyNow}
      </Button>
    </Card>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="p-2 rounded-lg bg-white/5 text-celestial-saturn">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="font-bold text-sm">{title}</h4>
        <p className="text-xs text-white/40">{desc}</p>
      </div>
    </div>
  );
}
