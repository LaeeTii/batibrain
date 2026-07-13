import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <MantineProvider theme={createTheme({ primaryColor: 'teal', fontFamily: "'Avenir Next', 'Segoe UI', sans-serif" })}>
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
