import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n'; // i18n must init before App renders
import './index.css';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
