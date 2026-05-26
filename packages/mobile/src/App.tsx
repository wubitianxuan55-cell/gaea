import React, { useState, useEffect, lazy, Suspense } from 'react';
import { setLang } from './lib/useT';
import * as authService from './services/authService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';
import { Toaster } from 'sonner';
import { motion } from 'motion/react';
import { Rocket } from 'lucide-react';
import { translations } from './lib/translations';
import { useApp } from './contexts/AppContext';
import { LoginRequired, LoginModal } from './core/components/Auth';

const MobilePlatform = lazy(() => import('./platforms/mobile/MobilePlatform').then(m => ({ default: m.MobilePlatform })));

export default function App() {
  const { user, loading: appLoading, logout: appLogout, refreshUser } = useApp();
  const [lang, setLangState] = useState<'en' | 'zh'>('zh');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    setLang(lang);
  }, [lang]);

  useEffect(() => {
    const handler = () => setIsLoginModalOpen(true);
    window.addEventListener('lumi:open-login', handler);
    return () => window.removeEventListener('lumi:open-login', handler);
  }, []);

  const handleSetLang = (l: 'en' | 'zh') => setLangState(l);

  if (appLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-celestial-deep">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <Rocket size={48} className="text-celestial-saturn" />
          <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-celestial-mars to-celestial-saturn">
            {t.appInitializing || 'Lumi Core v2.0 Initializing...'}
          </div>
        </motion.div>
      </div>
    );
  }

  const renderTabContent = (tab: string) => null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-celestial-deep">
      <ErrorBoundary>
        <Toaster position="top-center" theme="dark" />
        <Suspense fallback={<LoadingFallback />}>
          <MobilePlatform
            t={t}
            user={user}
            lang={lang}
            setLang={handleSetLang}
            onLogin={() => setIsLoginModalOpen(true)}
            onExit={() => {}}
            renderTabContent={renderTabContent}
          />
        </Suspense>
        <LoginModal
          t={t}
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={() => refreshUser()}
          onGoogleLogin={() => setIsLoginModalOpen(true)}
        />
      </ErrorBoundary>
    </div>
  );
}
