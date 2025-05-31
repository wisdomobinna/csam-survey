import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';


console.log('=== ENVIRONMENT DEBUG ===');
console.log('All env vars:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
console.log('API Key:', process.env.REACT_APP_FIREBASE_API_KEY);
console.log('=========================');

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);