import React from 'react';
import { motion } from 'motion/react';
import { Zap, Shield, Cpu, Globe, Users, Database } from 'lucide-react';

export function LandingSections({ t }: { t: any }) {
  return (
    <div className="space-y-32 py-20">
      {/* How it Works */}
      <section className="space-y-16">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold tracking-tighter glow-text">{t.howItWorks}</h2>
          <div className="w-24 h-1 bg-celestial-saturn mx-auto rounded-full" />
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <StepCard 
            number="01" 
            title={t.step1} 
            desc={t.step1Desc} 
            icon={<Database className="text-celestial-mars" />} 
          />
          <StepCard 
            number="02" 
            title={t.step2} 
            desc={t.step2Desc} 
            icon={<Cpu className="text-celestial-saturn" />} 
          />
          <StepCard 
            number="03" 
            title={t.step3} 
            desc={t.step3Desc} 
            icon={<Globe className="text-celestial-glow" />} 
          />
        </div>
      </section>

      {/* Features */}
      <section className="grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <h2 className="text-5xl font-bold tracking-tighter leading-tight">
            {t.featuresTitle}
          </h2>
          <div className="space-y-6">
            <FeatureItem 
              icon={<Shield size={24} />} 
              title={t.feature1} 
              desc={t.feature1Desc} 
            />
            <FeatureItem 
              icon={<Cpu size={24} />} 
              title={t.feature2} 
              desc={t.feature2Desc} 
            />
            <FeatureItem 
              icon={<Zap size={24} />} 
              title={t.feature3} 
              desc={t.feature3Desc} 
            />
          </div>
        </div>
        <div className="relative aspect-square glass rounded-[3rem] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-celestial-mars/20 to-celestial-saturn/20 animate-pulse" />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="w-64 h-64 border-2 border-dashed border-white/10 rounded-full flex items-center justify-center"
          >
            <div className="w-48 h-48 border border-white/20 rounded-full flex items-center justify-center">
               <Cpu size={64} className="text-celestial-saturn opacity-50" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="glass p-12 rounded-[3rem] border-white/10">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-12 text-center">
          <StatItem label={t.activeLumis} value="12.4k" />
          <StatItem label={t.dataSynced} value="850TB" />
          <StatItem label={t.spiritsBorn} value="3.2k" />
        </div>
      </section>
    </div>
  );
}

function StepCard({ number, title, desc, icon }: { number: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="glass p-8 rounded-3xl space-y-6 group hover:border-celestial-saturn/30 transition-all">
      <div className="flex justify-between items-start">
        <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className="text-4xl font-black text-white/5 tracking-tighter">{number}</span>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="w-12 h-12 rounded-2xl bg-celestial-saturn/10 flex items-center justify-center text-celestial-saturn shrink-0">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm text-white/40">{desc}</p>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-4xl font-bold tracking-tighter text-celestial-saturn">{value}</div>
      <div className="text-xs uppercase tracking-widest text-white/40">{label}</div>
    </div>
  );
}
