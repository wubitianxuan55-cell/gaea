import React from 'react';
import { motion } from 'motion/react';
import { Shield, Bell, Globe, Cpu, Lock, Eye, Database } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

export function Settings({ t }: { t: any }) {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tighter glow-text">{t.settings}</h1>
        <p className="text-white/40">Manage your local node and Agent protocols.</p>
      </div>

      <div className="grid gap-6">
        <SettingsSection title="Privacy & Security" icon={<Shield className="text-celestial-mars" />}>
          <SettingsItem label="Local Encryption" desc="Encrypt all Agent data stored on your local disk." active />
          <SettingsItem label="Anonymous Mode" desc="Hide your node ID from the collaborative network." />
          <SettingsItem label="Biometric Lock" desc="Require fingerprint or face ID for Agent generation." />
        </SettingsSection>

        <SettingsSection title="Node Configuration" icon={<Cpu className="text-celestial-saturn" />}>
          <SettingsItem label="Distributed Computing" desc="Allow your node to participate in neural synthesis." active />
          <SettingsItem label="Auto-Sync" desc="Automatically synchronize data with multimodal devices." active />
          <SettingsItem label="Storage Limit" desc="Maximum disk space allocated for Agent memory (Current: 50GB)." />
        </SettingsSection>

        <SettingsSection title="Interface" icon={<Globe className="text-celestial-glow" />}>
          <SettingsItem label="Holographic UI" desc="Enable advanced visual effects and particles." active />
          <SettingsItem label="Voice Feedback" desc="Agents will respond using synthesized voice." />
        </SettingsSection>
      </div>

      <div className="flex justify-end gap-4">
        <Button variant="outline" className="rounded-xl border-white/10">Reset Default</Button>
        <Button className="bg-celestial-saturn text-black rounded-xl px-8">Save Changes</Button>
      </div>
    </div>
  );
}

function SettingsSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="glass p-8 rounded-[2rem] border-white/10 space-y-6">
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="text-xl font-bold">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </Card>
  );
}

function SettingsItem({ label, desc, active = false }: { label: string; desc: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
      <div className="space-y-1">
        <div className="font-bold">{label}</div>
        <div className="text-xs text-white/40">{desc}</div>
      </div>
      <div className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${active ? 'bg-celestial-saturn' : 'bg-white/10'}`}>
        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-0'}`} />
      </div>
    </div>
  );
}
