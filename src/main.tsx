import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './index.css';

window.addEventListener('error', (e) => {
  const err = document.createElement('div');
  err.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;background:red;color:white;padding:20px;font-size:16px;white-space:pre-wrap;';
  err.textContent = e.error?.stack || e.message;
  document.body.appendChild(err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
