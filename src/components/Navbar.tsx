import React from 'react';
import { User } from 'firebase/auth';
import { Rocket, MessageSquare, Cpu, Globe, Users, Settings as SettingsIcon, User as UserIcon, BookOpen, Zap } from 'lucide-react';
import { Button } from './ui/button';

interface NavbarProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: 'en' | 'zh';
  setLang: (lang: 'en' | 'zh') => void;
  t: any;
}

export function Navbar({ user, onLogin, onLogout, activeTab, setActiveTab, lang, setLang, t }: NavbarProps) {
  return (
    <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
        <div className="w-10 h-10 rounded-full mars-gradient flex items-center justify-center">
          <Rocket className="text-white" size={20} />
        </div>
        <span className="text-2xl font-bold tracking-tighter glow-text">LumiAI</span>
      </div>

        <div className="hidden lg:flex items-center gap-8">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Rocket size={18} />} label={t.interact} />
          <NavItem active={activeTab === 'generate'} onClick={() => setActiveTab('generate')} icon={<Cpu size={18} />} label={t.generate} />
          <NavItem active={activeTab === 'ecosystem'} onClick={() => setActiveTab('ecosystem')} icon={<Globe size={18} />} label={t.ecosystem} />
          <NavItem active={activeTab === 'multimodal'} onClick={() => setActiveTab('multimodal')} icon={<Zap size={18} />} label={t.multimodalProducts} />
          <NavItem active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<BookOpen size={18} />} label={t.docs} />
          <NavItem active={activeTab === 'join'} onClick={() => setActiveTab('join')} icon={<Users size={18} />} label={t.join} />
        </div>

      <div className="flex items-center gap-4">
        <div className="lg:hidden">
          <select 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white/80 focus:outline-none"
          >
            <option value="home" className="bg-celestial-deep">{t.interact}</option>
            <option value="generate" className="bg-celestial-deep">{t.generate}</option>
            <option value="ecosystem" className="bg-celestial-deep">{t.ecosystem}</option>
            <option value="multimodal" className="bg-celestial-deep">{t.multimodalProducts}</option>
            <option value="docs" className="bg-celestial-deep">{t.docs}</option>
            <option value="join" className="bg-celestial-deep">{t.join}</option>
          </select>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
          className="text-white/60 hover:text-white border border-white/10 rounded-full px-3"
        >
          {lang === 'en' ? '中文' : 'EN'}
        </Button>

        {user ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('settings')}
              className={`p-2 rounded-full transition-all ${activeTab === 'settings' ? 'bg-celestial-saturn text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              <SettingsIcon size={20} />
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${activeTab === 'profile' ? 'border-celestial-saturn scale-110' : 'border-white/10 hover:border-white/30'}`}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/40">
                  <UserIcon size={20} />
                </div>
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-white/60 hover:text-white hidden sm:block">{t.logout}</Button>
          </div>
        ) : (
          <Button onClick={onLogin} className="bg-celestial-saturn text-black hover:scale-105 transition-transform">
            {t.connect}
          </Button>
        )}
      </div>
    </nav>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 text-sm font-medium transition-colors ${active ? 'text-celestial-saturn' : 'text-white/60 hover:text-white'}`}
    >
      {icon}
      {label}
    </button>
  );
}
