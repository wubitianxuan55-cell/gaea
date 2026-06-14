// Desktop entry — Codex three-column desktop shell
import { useState, useEffect } from 'react';
import { ProactiveNotifications } from '../components/ProactiveNotifications';
import { LoginModal } from '../core/components/Auth';
import { Toaster } from 'sonner';
import { installApiBridge } from '../services/apiBridge';
import '@fontsource-variable/geist';
import '../index.css';
import { CodexDesktop } from '../components/CodexDesktop';
import { SetupWizard } from '../components/SetupWizard';
import { useAppShell } from './useAppShell';
import { LoadingFallback } from '../components/LoadingFallback';

installApiBridge();

const SETUP_DONE_KEY = 'gaea_setup_complete';

export function DesktopApp() {
  const shell = useAppShell();
  const [showSetup, setShowSetup] = useState(() => localStorage.getItem(SETUP_DONE_KEY) !== '1');

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, []);

  if (shell.loading) {
    return <LoadingFallback />;
  }

  return (
    <div className="h-screen w-full bg-transparent overflow-hidden">
      <ProactiveNotifications />
      <Toaster position="top-right" theme="dark" />

      {showSetup ? (
        <div className="h-full w-full flex items-center justify-center bg-black/80 p-8">
          <SetupWizard
            onFinish={() => {
              setShowSetup(false);
              localStorage.setItem(SETUP_DONE_KEY, '1');
            }}
          />
        </div>
      ) : (
        <CodexDesktop lang={shell.lang} setLang={shell.setLang} />
      )}
    </div>
  );
}
