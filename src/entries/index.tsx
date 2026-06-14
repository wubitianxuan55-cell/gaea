// Unified entry — always renders the desktop UI shell
// Both Tauri WebView and browser get the same experience.
import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from '../contexts/AppContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingFallback } from '../components/LoadingFallback';
import { installApiBridge } from '../services/apiBridge';
import '@fontsource-variable/geist';
import '../index.css';

installApiBridge();

const DesktopApp = lazy(() => import('./desktop').then(m => ({ default: m.DesktopApp })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <Suspense fallback={<LoadingFallback />}>
          <DesktopApp />
        </Suspense>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
