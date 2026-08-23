import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'react-hot-toast';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import { initSentry } from './sentry';
import './styles.css';          // global styles: reset, navbar, landing, vars, utilities, dark mode
import './design-system.css';   /* design system: --ss-* tokens, components, grids, animations */
import './styles/typography.css'; /* centralized typography scale: --type-* tokens + .text-* utilities */
import './styles/forms.css';
import './styles/responsive.css';

initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />

        <Toaster
          position="top-right"
          reverseOrder={false}
        />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);