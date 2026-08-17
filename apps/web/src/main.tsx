import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WebApp from '@twa-dev/sdk';
import './styles.css';
import { App } from './App';

WebApp.ready();
WebApp.expand();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
