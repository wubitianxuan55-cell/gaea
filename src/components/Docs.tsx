import React from 'react';
import { motion } from 'motion/react';
import { Book, Code, Terminal, Shield, Cpu, Globe, Zap, Search } from 'lucide-react';
import { Card } from './ui/card';
import { Input } from './ui/input';

export function Docs({ t }: { t: any }) {
  return (
    <div className="max-w-6xl mx-auto space-y-16">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold tracking-tighter glow-text">{t.docs}</h1>
        <p className="text-xl text-white/60 max-w-2xl mx-auto">Master the LumiAI protocol and build advanced Agent architectures.</p>
        <div className="max-w-md mx-auto relative">
          <Input placeholder="Search documentation..." className="bg-white/5 border-white/10 rounded-2xl p-6 h-auto text-lg pl-12" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <DocCard 
          icon={<Book className="text-celestial-mars" />} 
          title="Getting Started" 
          desc="Learn the basics of Agent generation and local node setup." 
          links={['Installation', 'First Agent', 'Syncing Devices']}
        />
        <DocCard 
          icon={<Code className="text-celestial-saturn" />} 
          title="API Reference" 
          desc="Deep dive into the LumiAI local SDK and neural synthesis API." 
          links={['Authentication', 'Data Streams', 'Memory Core']}
        />
        <DocCard 
          icon={<Terminal className="text-celestial-glow" />} 
          title="Advanced Guides" 
          desc="Build complex multi-agent systems and custom knowledge graphs." 
          links={['Orchestration', 'Custom LLMs', 'Security Rules']}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        <Card className="glass p-8 rounded-[3rem] border-white/10 space-y-6">
          <h3 className="text-2xl font-bold tracking-tighter">Neural Synthesis Protocol</h3>
          <div className="space-y-4 text-white/60 leading-relaxed">
            <p>The LumiAI protocol uses distributed neural synthesis to build Agent intelligence. This process is entirely local, ensuring that your data never leaves your node.</p>
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 font-mono text-sm overflow-x-auto">
              <code>
                lumi generate --name "MyAgent" --data ./docs/knowledge.pdf --privacy high
              </code>
            </div>
            <p>By defining a high privacy level, the protocol will use advanced encryption and local-only processing for all neural weight calculations.</p>
          </div>
        </Card>

        <Card className="glass p-8 rounded-[3rem] border-white/10 space-y-6">
          <h3 className="text-2xl font-bold tracking-tighter">Security & Privacy</h3>
          <div className="space-y-4 text-white/60 leading-relaxed">
            <p>Privacy is the core of LumiAI. Our security architecture is built on three pillars:</p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3"><Zap size={16} className="text-celestial-saturn" /> Local-First Data Processing</li>
              <li className="flex items-center gap-3"><Shield size={16} className="text-celestial-mars" /> End-to-End Node Encryption</li>
              <li className="flex items-center gap-3"><Globe size={16} className="text-celestial-glow" /> Decentralized Identity (DID)</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DocCard({ icon, title, desc, links }: { icon: React.ReactNode; title: string; desc: string; links: string[] }) {
  return (
    <Card className="glass p-8 rounded-[3rem] border-white/10 space-y-6 group hover:border-celestial-saturn/30 transition-all">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold tracking-tighter">{title}</h3>
        <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
      </div>
      <ul className="space-y-2">
        {links.map((link, i) => (
          <li key={i} className="text-sm text-celestial-saturn hover:underline cursor-pointer flex items-center gap-2">
            <Zap size={12} />
            {link}
          </li>
        ))}
      </ul>
    </Card>
  );
}
