import React from 'react';
import ReactDOM from 'react-dom/client';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import App from './App.tsx';
import './index.css';

// Register AG-Grid modules
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
