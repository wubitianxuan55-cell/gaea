import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, Code, Database, Sparkles, Rocket, Shield, Cpu, Heart, Users, User, Briefcase, Mic, X, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';

export function AgentGenerator({ t }: { t: any }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [agentName, setAgentName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('friend');
  const [isCloning, setIsCloning] = useState(false);
  const [generatedAgents, setGeneratedAgents] = useState<any[]>([]);
  const generationTimeoutRef = React.useRef<any>(null);

  const handleUpload = () => {
    const mockFiles = ['knowledge_base.pdf', 'personal_data.json', 'code_samples.ts'];
    setFiles(prev => [...new Set([...prev, ...mockFiles])]);
  };

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f !== fileName));
  };

  const handleGenerate = () => {
    if (!agentName || files.length === 0) return;
    setIsGenerating(true);
    generationTimeoutRef.current = setTimeout(() => {
      setIsGenerating(false);
      const newAgent = {
        id: Date.now(),
        name: agentName,
        category: selectedCategory,
        timestamp: new Date().toLocaleDateString(),
        type: 'Custom'
      };
      setGeneratedAgents(prev => [newAgent, ...prev]);
      setAgentName('');
      setFiles([]);
    }, 3000);
  };

  const cancelGeneration = () => {
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
      setIsGenerating(false);
    }
  };

  const deleteAgent = (id: number) => {
    setGeneratedAgents(prev => prev.filter(a => a.id !== id));
  };

  const startVoiceCloning = () => {
    setIsCloning(true);
    setTimeout(() => setIsCloning(false), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-16">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold tracking-tighter glow-text">{t.generateTitle}</h1>
        <p className="text-xl text-white/60 max-w-2xl mx-auto">{t.generateDesc}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Left Section: Upload & Guidance */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="glass p-8 rounded-[3rem] border-white/10 space-y-8">
            <div className="space-y-4">
              <label className="text-sm font-bold uppercase tracking-widest text-white/40">1. Identity & Data</label>
              <Input 
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Enter Agent Name (e.g., Research Assistant)"
                className="bg-white/5 border-white/10 rounded-2xl p-6 h-auto text-lg"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-sm font-bold uppercase tracking-widest text-white/40">{t.uploadFiles}</label>
                <div 
                  onClick={handleUpload}
                  className="border-2 border-dashed border-white/10 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 hover:border-celestial-saturn/30 hover:bg-white/5 transition-all cursor-pointer group h-full"
                >
                  <div className="w-12 h-12 rounded-full bg-celestial-saturn/10 flex items-center justify-center text-celestial-saturn group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm">{t.dropFiles}</p>
                    <p className="text-[10px] text-white/40">PDF, JSON, TXT (Max 50MB)</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold uppercase tracking-widest text-white/40">{t.voiceCloning}</label>
                <div className="border border-white/10 rounded-[2rem] p-8 space-y-4 bg-white/5 h-full flex flex-col justify-between">
                  <p className="text-xs text-white/40 leading-relaxed">{t.cloningDesc}</p>
                  <Button 
                    onClick={startVoiceCloning}
                    disabled={isCloning}
                    className="w-full py-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-2"
                  >
                    {isCloning ? (
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }}>
                        <Mic size={18} className="text-red-500" />
                      </motion.div>
                    ) : (
                      <Mic size={18} />
                    )}
                    {isCloning ? 'Cloning Essence...' : 'Start Voice Sample'}
                  </Button>
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-widest text-white/40">Uploaded Data</label>
                <div className="grid grid-cols-1 gap-2">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group/file">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-celestial-saturn" />
                        <span className="text-sm text-white/60">{file}</span>
                      </div>
                      <button 
                        onClick={() => removeFile(file)}
                        className="p-1 hover:bg-white/10 rounded-lg text-white/20 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={isGenerating ? cancelGeneration : handleGenerate}
              disabled={(!isGenerating && (!agentName || files.length === 0))}
              className={`w-full py-8 rounded-[2rem] font-bold text-xl hover:scale-105 transition-transform flex items-center gap-3 ${
                isGenerating ? 'bg-white/5 text-white/60 border border-white/10' : 'bg-celestial-saturn text-black'
              }`}
            >
              {isGenerating ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Sparkles size={24} />
                </motion.div>
              ) : (
                <Rocket size={24} />
              )}
              {isGenerating ? 'Cancel Synthesis' : t.createAgent}
            </Button>
          </Card>
        </div>

        {/* Right Section: A Wisp of Divine Consciousness (Selection) */}
        <div className="space-y-8">
          <Card className="glass p-8 rounded-[3rem] border-white/10 space-y-8">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tighter flex items-center gap-2">
                <Sparkles className="text-celestial-saturn" size={24} />
                {t.immortalityTitle}
              </h3>
              <p className="text-sm text-white/40 leading-relaxed">Select a template to configure the neural essence.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CategoryButton 
                active={selectedCategory === 'colleague'} 
                onClick={() => setSelectedCategory('colleague')}
                icon={<Briefcase size={18} />}
                label={t.categoryColleague}
              />
              <CategoryButton 
                active={selectedCategory === 'family'} 
                onClick={() => setSelectedCategory('family')}
                icon={<Users size={18} />}
                label={t.categoryFamily}
              />
              <CategoryButton 
                active={selectedCategory === 'friend'} 
                onClick={() => setSelectedCategory('friend')}
                icon={<User size={18} />}
                label={t.categoryFriend}
              />
              <CategoryButton 
                active={selectedCategory === 'lover'} 
                onClick={() => setSelectedCategory('lover')}
                icon={<Heart size={18} />}
                label={t.categoryLover}
              />
            </div>
          </Card>

          <div className="glass p-8 rounded-[3rem] border-white/10 space-y-6">
            <h3 className="text-xl font-bold tracking-tighter">Protocol</h3>
            <div className="space-y-4">
              <ProtocolItem icon={<Shield size={16} className="text-celestial-mars" />} title="Privacy" desc="Local processing only." />
              <ProtocolItem icon={<Cpu size={16} className="text-celestial-saturn" />} title="Neural" desc="High-fidelity synthesis." />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Generated Agents */}
      <section className="space-y-8 pt-16 border-t border-white/5">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <h2 className="text-4xl font-bold tracking-tighter glow-text">Generated Agents</h2>
            <p className="text-white/40">Select an agent to activate or modify its core.</p>
          </div>
          <div className="text-sm font-bold uppercase tracking-widest text-white/20">Total: {generatedAgents.length}</div>
        </div>

        {generatedAgents.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {generatedAgents.map((agent) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass p-6 rounded-[2rem] border-white/10 hover:border-celestial-saturn/30 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-celestial-saturn/10 flex items-center justify-center text-celestial-saturn group-hover:scale-110 transition-transform">
                    <Cpu size={24} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/20">{agent.timestamp}</div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAgent(agent.id);
                      }}
                      className="p-2 hover:bg-red-500/10 rounded-xl text-white/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-bold tracking-tight">{agent.name}</h4>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-bold">{agent.category}</p>
                </div>
                <div className="mt-6 flex gap-2">
                  <Button size="sm" className="flex-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest">Configure</Button>
                  <Button size="sm" className="flex-1 rounded-xl bg-celestial-saturn text-black text-[10px] font-bold uppercase tracking-widest">Activate</Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass p-20 rounded-[3rem] border-white/10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center text-white/20">
              <Database size={32} />
            </div>
            <p className="text-white/40 font-bold uppercase tracking-widest">No Agents Generated Yet</p>
          </div>
        )}
      </section>
    </div>
  );
}

function SkillBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/60">
      <div className="w-1 h-1 rounded-full bg-celestial-saturn" />
      {label}
    </div>
  );
}

function CategoryButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${
        active 
          ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
          : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function ProtocolItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="font-bold">{title}</h4>
        <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
