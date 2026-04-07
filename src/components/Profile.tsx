import React from 'react';
import { motion } from 'motion/react';
import { User, Mail, Globe, Shield, Cpu, Rocket, Sparkles, Ghost } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { auth } from '@/lib/firebase';

export function Profile({ t }: { t: any }) {
  const user = auth.currentUser;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-celestial-saturn/20 shadow-[0_0_50px_rgba(255,204,0,0.1)]">
          {user?.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/40">
              <User size={64} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
        
        <div className="text-center md:text-left space-y-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tighter glow-text">{user?.displayName || 'Agent Explorer'}</h1>
            <p className="text-white/40 font-mono text-sm">Node ID: 0x7A2B...F9E1</p>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
            <Badge icon={<Shield size={12} />} label="Verified Node" color="text-green-500 bg-green-500/10" />
            <Badge icon={<Cpu size={12} />} label="Level 12 Architect" color="text-celestial-saturn bg-celestial-saturn/10" />
            <Badge icon={<Rocket size={12} />} label="Early Explorer" color="text-celestial-mars bg-celestial-mars/10" />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="glass p-8 rounded-[3rem] border-white/10 space-y-6">
          <h3 className="text-xl font-bold tracking-tighter">Active Agents</h3>
          <div className="space-y-4">
            <AgentItem name="Research Assistant" type="Core" status="Online" />
            <AgentItem name="Creative Pulse" type="Module" status="Standby" />
            <AgentItem name="Logic Engine" type="Core" status="Offline" />
          </div>
          <Button className="w-full rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10">Manage Agents</Button>
        </Card>

        <Card className="glass p-8 rounded-[3rem] border-white/10 space-y-6">
          <h3 className="text-xl font-bold tracking-tighter">Node Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatBox label="Total Data" value="1.2 TB" />
            <StatBox label="Uptime" value="99.9%" />
            <StatBox label="Sync Rate" value="45 MB/s" />
            <StatBox label="Interactions" value="1,240" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Badge({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${color}`}>
      {icon}
      {label}
    </div>
  );
}

function AgentItem({ name, type, status }: { name: string; type: string; status: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-celestial-saturn">
          <Ghost size={20} />
        </div>
        <div className="space-y-0.5">
          <div className="font-bold text-sm">{name}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-widest">{type}</div>
        </div>
      </div>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${status === 'Online' ? 'text-green-500' : status === 'Standby' ? 'text-celestial-saturn' : 'text-white/20'}`}>
        {status}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center space-y-1">
      <div className="text-xs text-white/40 uppercase tracking-widest font-bold">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
