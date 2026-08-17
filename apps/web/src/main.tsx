import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WebApp from '@twa-dev/sdk';
import { Toaster } from 'react-hot-toast';
import './styles.css';
import { App } from './App';

WebApp.ready();
WebApp.expand();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster position="top-center" />
  </StrictMode>
);
