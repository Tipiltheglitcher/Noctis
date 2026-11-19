import React from 'react';
import ReactDOM from 'react-dom/client';
import { installWebPronoteBridge } from './webPronoteBridge';
import App from './App';
import '../../PC/src/index.css';

installWebPronoteBridge();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
