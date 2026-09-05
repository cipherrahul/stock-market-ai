'use client';

import React from 'react';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';

function ThemedToaster() {
  const { isDracula } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: isDracula
          ? {
              background: '#21222c',
              color: '#f8f8f2',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              padding: '12px 16px',
              border: '1px solid #44475a',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }
          : {
              background: '#0f1929',
              color: '#fff',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              padding: '12px 16px',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            },
        success: {
          iconTheme: { primary: isDracula ? '#50fa7b' : '#059669', secondary: isDracula ? '#282a36' : '#fff' },
          style: { borderLeft: `3px solid ${isDracula ? '#50fa7b' : '#059669'}` },
        },
        error: {
          iconTheme: { primary: isDracula ? '#ff5555' : '#dc2626', secondary: isDracula ? '#282a36' : '#fff' },
          style: { borderLeft: `3px solid ${isDracula ? '#ff5555' : '#dc2626'}` },
        },
      }}
    />
  );
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ThemeProvider>
      <WebSocketProvider>
        {children}
        {mounted && <ThemedToaster />}
      </WebSocketProvider>
    </ThemeProvider>
  );
}

