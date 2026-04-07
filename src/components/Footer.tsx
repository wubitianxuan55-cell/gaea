import React from 'react';
import { Rocket, Github, Twitter, Mail } from 'lucide-react';

export function Footer({ t }: { t: any }) {
  return (
    <footer className="mt-32 border-t border-white/5 bg-black/20 backdrop-blur-xl py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full mars-gradient flex items-center justify-center">
                <Rocket className="text-white" size={16} />
              </div>
              <span className="text-xl font-bold tracking-tighter glow-text">LumiAI</span>
            </div>
            <p className="text-white/40 max-w-sm text-sm leading-relaxed">
              {t.missionDesc}
            </p>
            <div className="flex items-center gap-4">
              <SocialIcon icon={<Twitter size={18} />} />
              <SocialIcon icon={<Github size={18} />} />
              <SocialIcon icon={<Mail size={18} />} />
            </div>
          </div>
          
          <div className="space-y-6">
            <h4 className="font-bold text-sm uppercase tracking-widest text-white/60">{t.marketplace}</h4>
            <ul className="space-y-3 text-sm text-white/40">
              <li className="hover:text-celestial-saturn cursor-pointer transition-colors">{t.spirits}</li>
              <li className="hover:text-celestial-saturn cursor-pointer transition-colors">{t.skills}</li>
              <li className="hover:text-celestial-saturn cursor-pointer transition-colors">Local SDK</li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-bold text-sm uppercase tracking-widest text-white/60">Protocol</h4>
            <ul className="space-y-3 text-sm text-white/40">
              <li className="hover:text-celestial-saturn cursor-pointer transition-colors">Privacy Policy</li>
              <li className="hover:text-celestial-saturn cursor-pointer transition-colors">Terms of Service</li>
              <li className="hover:text-celestial-saturn cursor-pointer transition-colors">Local SDK</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/20">
          <p>© 2026 LumiAI Protocol. All rights reserved across the cosmic void.</p>
          <p>Synchronized with Celestial Node 0x7A2B</p>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
      {icon}
    </a>
  );
}
