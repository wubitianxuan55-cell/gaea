import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Shield, 
  Bell, 
  Globe, 
  Cpu, 
  Lock, 
  Eye, 
  Database, 
  Radio, 
  Key, 
  BrainCircuit, 
  ChevronDown, 
  Rocket,
  Music,
  Disc,
  Headphones,
  MessagesSquare,
  Sparkle,
  Zap,
  Camera,
  Mic,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { toast } from 'sonner';

import { usePlatform } from '@/hooks/usePlatform';
import { DeviceSyncCenter } from './DeviceSyncCenter';
import { useApp } from '@/contexts/AppContext';

export function Settings({ t }: { t: any }) {
  const { platform, isElectron, isWeb } = usePlatform();
  const { aiConfig, updateAIConfig } = useApp();
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeSection, setActiveSection] = useState('neural');

  return (
    <div className="flex h-full min-h-[600px] bg-black/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
      {/* Sidebar */}
      <div className="w-64 bg-white/5 border-r border-white/5 p-8 flex flex-col gap-2">
        <h2 className="text-xl font-black uppercase tracking-tighter text-white mb-6">Settings</h2>
        <SidebarItem active={activeSection === 'neural'} onClick={() => setActiveSection('neural')} icon={<BrainCircuit size={18} />} label="Neural Engine" />
        <SidebarItem active={activeSection === 'api'} onClick={() => setActiveSection('api')} icon={<Key size={18} />} label="Neural API Matrix" />
        <SidebarItem active={activeSection === 'music'} onClick={() => setActiveSection('music')} icon={<Music size={18} />} label="Media Services" />
        <SidebarItem active={activeSection === 'sync'} onClick={() => setActiveSection('sync')} icon={<Radio size={18} />} label="Sync Hub" />
        <SidebarItem active={activeSection === 'security'} onClick={() => setActiveSection('security')} icon={<Shield size={18} />} label="Security" />
        <SidebarItem active={activeSection === 'hardware'} onClick={() => setActiveSection('hardware')} icon={<Camera size={18} />} label="Hardware Access" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
        {activeSection === 'neural' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection title="Agent Framework (Lumi Protocol)" icon={<BrainCircuit className="text-celestial-saturn" />}>
               <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/40 tracking-widest">
                          <span>Neural Engine</span>
                          <span className="text-green-500">Active</span>
                       </div>
                       <div className="text-xs font-bold text-white/80">Autonomous Cognitive Loop</div>
                       <p className="text-[10px] text-white/30">Allows agents to proactively execute tasks based on context awareness.</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/40 tracking-widest">
                          <span>Memory Mesh</span>
                          <span className="text-blue-500">Syncing</span>
                       </div>
                       <div className="text-xs font-bold text-white/80">Persistent Long-term Recall</div>
                       <p className="text-[10px] text-white/30">Enables cross-session memory shared across all identified node devices.</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-white/30 ml-2">Primary Reasoning Brain</label>
                      <div className="relative">
                        <select 
                          value={aiConfig.provider}
                          onChange={(e) => updateAIConfig({ provider: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold appearance-none cursor-pointer focus:border-celestial-saturn/50 outline-none"
                        >
                          <option value="gemini">Google Gemini (Native)</option>
                          <option value="openai">OpenAI (Advanced)</option>
                          <option value="deepseek">DeepSeek (Optimization)</option>
                          <option value="anthropic">Anthropic Claude</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" />
                      </div>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-white/30 ml-2">Neural Model (Version)</label>
                       <input 
                          type="text" 
                          value={aiConfig.model}
                          onChange={(e) => updateAIConfig({ model: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold focus:border-celestial-saturn/50 outline-none font-mono"
                       />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <div className="flex justify-between items-center px-2">
                       <label className="text-[10px] font-black uppercase text-white/30">Proprietary API Key (Encrypted)</label>
                       <button onClick={() => setShowApiKey(!showApiKey)} className="text-[9px] font-bold text-celestial-saturn uppercase tracking-widest">{showApiKey ? 'Hide' : 'Reveal'}</button>
                    </div>
                    <div className="relative">
                       <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                       <input 
                          type={showApiKey ? "text" : "password"}
                          value={aiConfig.apiKey}
                          onChange={(e) => updateAIConfig({ apiKey: e.target.value })}
                          placeholder="Optional: Enter key to bypass proxy rate limits"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm font-mono focus:border-celestial-saturn/50 outline-none"
                       />
                    </div>
                    <p className="text-[9px] text-white/20 px-2">Your key is stored locally and never leaves your secure mesh node.</p>
                 </div>
               </div>
            </SettingsSection>
          </div>
        )}

        {activeSection === 'api' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection title="Neural API Matrix" icon={<Key className="text-celestial-saturn" />}>
              <div className="grid grid-cols-1 gap-6">
                <ApiKeyField icon={<Sparkle size={18} className="text-purple-400" />} label="Anthropic / Claude 3.5 API" placeholder="sk-ant-..." />
                <ApiKeyField icon={<MessagesSquare size={18} className="text-green-400" />} label="OpenAI / GPT-4o API" placeholder="sk-..." />
                <ApiKeyField icon={<BrainCircuit size={18} className="text-blue-400" />} label="Google Gemini API" placeholder="Key detected in environment (Native Link)" disabled={true} />
                <ApiKeyField icon={<Cpu size={18} className="text-orange-400" />} label="DeepSeek / LLM API" placeholder="sk-..." />
              </div>
            </SettingsSection>
          </div>
        )}

        {activeSection === 'music' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection title="Media Integration" icon={<Music className="text-celestial-saturn" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ServiceCard icon={<Disc className="text-[#1DB954]" />} name="Spotify" status="Disconnected" />
                <ServiceCard icon={<Headphones className="text-[#FA243C]" />} name="Apple Music" status="Disconnected" />
                <ServiceCard icon={<Radio className="text-orange-400" />} name="Tidal HiFi" status="Disconnected" />
                <ServiceCard icon={<Zap className="text-yellow-400" />} name="SoundCloud" status="Connected (Lumi Mix)" />
              </div>
            </SettingsSection>
          </div>
        )}

        {activeSection === 'sync' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection title="Distributed Intelligence Hub" icon={<Radio className="text-celestial-saturn" />}>
               <DeviceSyncCenter t={t} />
            </SettingsSection>
          </div>
        )}

        {activeSection === 'security' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection title="Privacy & Security" icon={<Shield className="text-celestial-mars" />}>
              <SettingsItem label="Local Encryption" desc="Encrypt all Agent data stored on your local disk." active />
              <SettingsItem label="Anonymous Mode" desc="Hide your node ID from the collaborative network." />
              <SettingsItem label="Biometric Lock" desc="Require fingerprint or face ID for Agent generation." />
            </SettingsSection>
            
            {isElectron && (
              <SettingsSection title="Desktop Node Runtime" icon={<Database className="text-celestial-jupiter" />}>
                <div className="p-4 bg-celestial-jupiter/10 rounded-2xl border border-celestial-jupiter/20 space-y-2 mb-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/60">Platform:</span>
                    <span className="font-mono text-celestial-jupiter uppercase">{platform}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/60">Node Status:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-bold text-green-500 underline decoration-green-500/20 underline-offset-4">ACTIVE</span>
                    </div>
                  </div>
                </div>
                <SettingsItem label="Hardware Acceleration" desc="Use GPU for neural core inference." active />
                <SettingsItem label="System Tray Mode" desc="Keep Lumi running in the background." active />
              </SettingsSection>
            )}
          </div>
        )}
        {activeSection === 'hardware' && <HardwareSettings t={t} />}
      </div>
    </div>
  );
}

function HardwareSettings({ t }: { t: any }) {
  const [micStatus, setMicStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [camStatus, setCamStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isRequesting, setIsRequesting] = useState(false);

  const requestPermissions = async (type: 'mic' | 'camera') => {
    setIsRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: type === 'mic', 
        video: type === 'camera' 
      });
      // Immediately stop the stream after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      if (type === 'mic') setMicStatus('granted');
      if (type === 'camera') setCamStatus('granted');
      
      toast.success(`${type === 'mic' ? 'Microphone' : 'Camera'} access synchronized.`);
    } catch (err: any) {
      if (type === 'mic') setMicStatus('denied');
      if (type === 'camera') setCamStatus('denied');
      toast.error(`Sensor link failed: ${err.message}`);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SettingsSection title="Hardware Sensor Network" icon={<Camera className="text-celestial-saturn" />}>
        <p className="text-sm text-white/40 mb-8 max-w-xl">
          LumiAI requires access to your physical sensors for real-world contextual awareness and biometric verification. All data is processed locally on your node.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HardwareCapCard 
            icon={<Mic size={24} />} 
            label="Audio Receptors" 
            desc="Enable neural speech recognition and voice cloning."
            status={micStatus}
            onEnable={() => requestPermissions('mic')}
            disabled={isRequesting}
          />
          <HardwareCapCard 
            icon={<Camera size={24} />} 
            label="Visual Cortex" 
            desc="Enable multimodal vision and gesture control."
            status={camStatus}
            onEnable={() => requestPermissions('camera')}
            disabled={isRequesting}
          />
        </div>

        <div className="mt-12 p-6 glass-dark rounded-[2rem] border border-white/5 space-y-4">
           <div className="flex items-center gap-3">
              <Shield className="text-celestial-saturn" size={20} />
              <h4 className="text-sm font-bold uppercase tracking-tight text-white">Privacy Assurance</h4>
           </div>
           <p className="text-[11px] text-white/30 leading-relaxed italic">
             "Our protocol strictly enforces local-only processing. Your visual and auditory data streams are never transmitted outside your sovereign mesh node without direct user-signed override."
           </p>
        </div>
      </SettingsSection>
    </div>
  );
}

function HardwareCapCard({ icon, label, desc, status, onEnable, disabled }: { 
  icon: React.ReactNode, 
  label: string, 
  desc: string, 
  status: 'prompt' | 'granted' | 'denied',
  onEnable: () => void,
  disabled: boolean
}) {
  return (
    <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 flex flex-col justify-between gap-6 group hover:border-white/10 transition-all">
      <div className="space-y-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
          status === 'granted' ? 'bg-celestial-saturn text-black' : 'bg-white/5 text-white/40'
        }`}>
          {icon}
        </div>
        <div>
          <h4 className="text-lg font-bold text-white">{label}</h4>
          <p className="text-xs text-white/40 leading-relaxed mt-1">{desc}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           {status === 'granted' ? (
             <div className="flex items-center gap-1.5 text-celestial-saturn text-[10px] font-black uppercase tracking-widest">
               <CheckCircle size={12} />
               Linked
             </div>
           ) : status === 'denied' ? (
             <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-black uppercase tracking-widest">
               <AlertCircle size={12} />
               Blocked
             </div>
           ) : (
             <div className="text-[10px] font-black uppercase tracking-widest text-white/20">Awaiting Access</div>
           )}
        </div>
        
        {status !== 'granted' && (
          <Button 
            onClick={onEnable}
            disabled={disabled}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest px-4 h-9 rounded-xl"
          >
            {status === 'denied' ? 'Retry Link' : 'Authorize'}
          </Button>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${active ? 'bg-white/10 text-white shadow-xl translate-x-2' : 'text-white/40 hover:bg-white/5 hover:text-white/70'}`}
    >
      <div className={`${active ? 'text-celestial-saturn' : 'text-current'} transition-colors`}>{icon}</div>
      <span className="text-xs font-black uppercase tracking-tight">{label}</span>
    </button>
  );
}

function ApiKeyField({ icon, label, placeholder, disabled = false }: { icon: React.ReactNode, label: string, placeholder: string, disabled?: boolean }) {
  return (
    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/50">{label}</label>
      </div>
      <div className="relative">
        <input 
          disabled={disabled}
          type="password" 
          placeholder={placeholder}
          className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono text-sm outline-none focus:border-celestial-saturn/50 transition-colors disabled:opacity-50" 
        />
        <Button className="absolute right-2 top-2 h-10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-lg">Update</Button>
      </div>
    </div>
  );
}

function ServiceCard({ icon, name, status }: { icon: React.ReactNode, name: string, status: string }) {
  return (
    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="p-4 bg-black/40 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
        <div>
          <h4 className="font-black uppercase tracking-tight text-white">{name}</h4>
          <p className={`text-[9px] font-black uppercase tracking-widest ${status.includes('Connected') ? 'text-green-500' : 'text-white/20'}`}>{status}</p>
        </div>
      </div>
      <ChevronDown size={16} className="text-white/20 -rotate-90" />
    </div>
  );
}

function SettingsSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="text-xl font-bold uppercase tracking-tighter text-white/90">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function SettingsItem({ label, desc, active = false }: { label: string; desc: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
      <div className="space-y-1">
        <div className="font-bold text-sm text-white/90">{label}</div>
        <div className="text-[10px] text-white/40 uppercase tracking-widest">{desc}</div>
      </div>
      <div className={`w-10 h-5 rounded-full p-1 transition-colors cursor-pointer ${active ? 'bg-celestial-saturn' : 'bg-white/10'}`}>
        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </div>
  );
}
