/**
 * CodexDesktop — three-column codex-style desktop shell
 *
 * Layout: left nav (56px) | center (voice/chat) | right panel (300px)
 */
import { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare, Mic, BookOpen, Settings, Wrench,
  FolderOpen, Activity, BarChart3, User,
  ChevronRight, ChevronLeft
} from 'lucide-react';
import { CodexBoot } from './CodexBoot';
import { VoiceCenter } from './VoiceCenter';
import { useApp } from '../contexts/AppContext';
import { translations } from '../lib/translations';

// Lazy-loaded content panels
const AgentChatPage = lazy(() => import('./AgentChatPage').then(m => ({ default: m.AgentChatPage })));
const KnowledgeBase = lazy(() => import('./KnowledgeBase').then(m => ({ default: m.KnowledgeBase })));
const SettingsPanel = lazy(() => import('./Settings').then(m => ({ default: m.Settings })));
const MCPSettings = lazy(() => import('./MCPSettings').then(m => ({ default: m.MCPSettings })));
const ToolPanel = lazy(() => import('./ToolPanel').then(m => ({ default: m.ToolPanel })));
const TokenDashboard = lazy(() => import('./TokenDashboard').then(m => ({ default: m.TokenDashboard })));
const DesktopOnboarding = lazy(() => import('./DesktopOnboarding').then(m => ({ default: m.DesktopOnboarding })));
const LoginModal = lazy(() => import('../core/components/Auth').then(m => ({ default: m.LoginModal })));
const NeuralSynthesisMonitor = lazy(() => import('./NeuralSynthesisMonitor').then(m => ({ default: m.NeuralSynthesisMonitor })));

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface Props {
  lang: 'en' | 'zh';
  setLang: (l: 'en' | 'zh') => void;
}

export function CodexDesktop({ lang, setLang }: Props) {
  const { user, login: appLogin, refreshUser } = useApp();
  const t = translations[lang];

  const [bootDone, setBootDone] = useState(false);
  const [mode, setMode] = useState<'voice' | 'chat'>('voice');
  const [activeNav, setActiveNav] = useState('voice');
  const [rightOpen, setRightOpen] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  const navItems: NavItem[] = [
    { id: 'chat', icon: <MessageSquare size={20} />, label: t.chat || '对话' },
    { id: 'voice', icon: <Mic size={20} />, label: t.voice || '语音' },
    { id: 'knowledge', icon: <BookOpen size={20} />, label: t.knowledgeBase || '知识库' },
    { id: 'settings', icon: <Settings size={20} />, label: t.settings || '设置' },
    { id: 'mcp', icon: <Wrench size={20} />, label: 'MCP' },
    { id: 'files', icon: <FolderOpen size={20} />, label: t.files || '文件' },
    { id: 'tools', icon: <Activity size={20} />, label: t.tools || '工具' },
    { id: 'dashboard', icon: <BarChart3 size={20} />, label: t.dashboard || '仪表盘' },
  ];

  const handleNav = (id: string) => {
    setActiveNav(id);
    if (id === 'voice') setMode('voice');
    else if (id === 'chat') setMode('chat');
  };

  const renderCenter = () => {
    // Voice mode
    if (mode === 'voice') {
      return <VoiceCenter t={t} onSwitchToChat={() => { setMode('chat'); setActiveNav('chat'); }} />;
    }

    // Chat mode
    if (activeNav === 'chat') {
      if (!user) {
        return (
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => setLoginOpen(true)}
              className="px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 hover:bg-green-500/20 transition-colors font-mono text-sm"
            >
              Sign in to start chatting
            </button>
          </div>
        );
      }
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-white/20 font-mono text-sm">Loading...</div>}>
          <AgentChatPage t={t} user={user} agent={null} isOpen={true} onClose={() => {}} />
        </Suspense>
      );
    }

    // Other nav items
    if (activeNav === 'knowledge') {
      if (!user) return <LoginPrompt onLogin={() => setLoginOpen(true)} />;
      return (
        <Suspense fallback={<Loading />}>
          <KnowledgeBase t={t} isOpen={true} onClose={() => setActiveNav('voice')} />
        </Suspense>
      );
    }

    if (activeNav === 'settings') {
      if (!user) return <LoginPrompt onLogin={() => setLoginOpen(true)} />;
      return (
        <Suspense fallback={<Loading />}>
          <SettingsPanel t={t} lang={lang} setLang={setLang} />
        </Suspense>
      );
    }

    if (activeNav === 'mcp') {
      if (!user) return <LoginPrompt onLogin={() => setLoginOpen(true)} />;
      return (
        <Suspense fallback={<Loading />}>
          <MCPSettings t={t} />
        </Suspense>
      );
    }

    if (activeNav === 'tools') {
      return (
        <Suspense fallback={<Loading />}>
          <ToolPanel t={t} />
        </Suspense>
      );
    }

    if (activeNav === 'dashboard') {
      if (!user) return <LoginPrompt onLogin={() => setLoginOpen(true)} />;
      return (
        <Suspense fallback={<Loading />}>
          <TokenDashboard />
        </Suspense>
      );
    }

    if (activeNav === 'files') {
      return (
        <div className="flex-1 flex items-center justify-center text-white/20 font-mono text-sm">
          File browser coming soon
        </div>
      );
    }

    return null;
  };

  const renderRightPanel = () => {
    if (!rightOpen) return null;

    return (
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 300 }}
        exit={{ width: 0 }}
        className="border-l border-white/5 bg-[#0f0f0f] overflow-y-auto"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-white/30">
              {mode === 'voice' ? 'Voice Info' : 'Context'}
            </span>
            <button
              onClick={() => setRightOpen(false)}
              className="text-white/20 hover:text-white/60 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {mode === 'voice' ? (
            <div className="space-y-4 text-sm text-white/50">
              <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                <p className="text-xs text-white/30 mb-1">Provider</p>
                <p className="text-white/70 font-mono">Deepgram STT + GPT-SoVITS TTS</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                <p className="text-xs text-white/30 mb-1">Model</p>
                <p className="text-white/70 font-mono">DeepSeek Chat</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                <p className="text-xs text-white/30 mb-1">Language</p>
                <p className="text-white/70 font-mono">{lang === 'zh' ? '中文' : 'English'}</p>
              </div>
              {/* Neural synthesis monitor — real-time system stats */}
              <Suspense fallback={<div className="text-xs text-white/20">Loading monitor...</div>}>
                <NeuralSynthesisMonitor />
              </Suspense>
            </div>
          ) : (
            <div className="space-y-4 text-sm text-white/30">
              <p className="mb-3">Agent memory and tool context will appear here during conversations.</p>
              <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                <p className="text-xs text-white/20">No active context</p>
              </div>
              {/* Neural synthesis monitor */}
              <Suspense fallback={<div className="text-xs text-white/20">Loading monitor...</div>}>
                <NeuralSynthesisMonitor />
              </Suspense>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  if (!bootDone) {
    return <CodexBoot onComplete={() => setBootDone(true)} />;
  }

  return (
    <div className="h-screen w-full flex bg-[#0a0a0a] text-white overflow-hidden select-none">
      {/* ===== LEFT SIDEBAR ===== */}
      <nav className="w-14 flex-shrink-0 bg-[#0a0a0a] border-r border-white/5 flex flex-col items-center py-4 gap-1">
        {navItems.map(item => {
          const isActive = item.id === activeNav || (item.id === 'voice' && mode === 'voice') || (item.id === 'chat' && mode === 'chat' && activeNav === 'chat');
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all group relative ${
                isActive
                  ? 'bg-white/10 text-green-400'
                  : 'text-white/25 hover:text-white/60 hover:bg-white/5'
              }`}
              title={item.label}
            >
              {item.icon}
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-green-500 rounded-r-full"
                />
              )}
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {item.label}
              </div>
            </button>
          );
        })}

        <div className="flex-1" />

        {/* User avatar */}
        <button
          onClick={() => user ? handleNav('settings') : setLoginOpen(true)}
          className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-all"
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-6 h-6 rounded" />
          ) : (
            <User size={18} />
          )}
        </button>
      </nav>

      {/* ===== CENTER ===== */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d]">
        {renderCenter()}

        {/* Bottom status bar */}
        <div className="h-8 flex-shrink-0 border-t border-white/5 flex items-center px-4 gap-4 text-xs font-mono text-white/20">
          <span className="text-green-500/60">DeepSeek-chat</span>
          <span>·</span>
          <span>Online</span>
          <span className="flex-1" />
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </main>

      {/* ===== RIGHT PANEL ===== */}
      <AnimatePresence>
        {rightOpen ? (
          renderRightPanel()
        ) : (
          <motion.button
            key="open-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRightOpen(true)}
            className="absolute right-4 top-4 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 hover:text-white/60 z-50"
          >
            <ChevronLeft size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ===== MODALS ===== */}
      <Suspense fallback={null}>
        <DesktopOnboarding isOpen={false} onFinish={() => {}} t={t} />

        <LoginModal
          t={t}
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          onLoginSuccess={() => refreshUser()}
          onGoogleLogin={() => {}}
        />
      </Suspense>
    </div>
  );
}

function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <button
        onClick={onLogin}
        className="px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 hover:bg-green-500/20 transition-colors font-mono text-sm"
      >
        Sign in to continue
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center text-white/20 font-mono text-sm">
      Loading...
    </div>
  );
}
