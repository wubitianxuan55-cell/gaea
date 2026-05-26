import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from './contexts/AppContext';
import '@fontsource-variable/geist';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installApiBridge } from './services/apiBridge';

installApiBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
