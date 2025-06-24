import React from 'react'
import ReactDOM from 'react-dom/client'
import { provideGlobalGridOptions } from 'ag-grid-community'
import App from './App.tsx'
import './index.css'

// Configure AG-Grid v33 to use legacy theme mode
// This maintains compatibility with v32 CSS imports
provideGlobalGridOptions({ theme: "legacy" });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)