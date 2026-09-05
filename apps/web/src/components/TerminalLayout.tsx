'use client';

import React, { useState } from 'react';
import { FiHome, FiTrendingUp, FiPieChart, FiSettings, FiCpu, FiShield, FiMenu, FiX } from 'react-icons/fi';
import { MotionDiv } from './Motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FleetTelemetry } from './FleetTelemetry';

interface TerminalLayoutProps {
  children: React.ReactNode;
}

export const TerminalLayout: React.FC<TerminalLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const menuItems = [
    { icon: FiHome, label: 'CMD_CENTER', href: '/dashboard' },
    { icon: FiTrendingUp, label: 'EXECUTION', href: '/trading' },
    { icon: FiPieChart, label: 'PORTFOLIO', href: '/analytics' },
    { icon: FiCpu, label: 'AI_SIGNALS', href: '/signals' },
    { icon: FiSettings, label: 'PROTOCOL_CFG', href: '/settings' },
  ];

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-50 font-display overflow-hidden selection:bg-sky-500/30">
      {/* CRT Overlay Effects */}
      <div className="crt-overlay" />
      <div className="scanline" />

      {/* Institutional Sidebar */}
      <MotionDiv
        initial={false}
        animate={{ width: collapsed ? '80px' : '280px' }}
        className="relative z-50 flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-3xl"
      >
        <div className="p-8 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            <FiShield className="text-white text-lg" />
          </div>
          {!collapsed && (
            <span className="font-black italic tracking-tighter text-2xl text-white">SOVEREIGN</span>
          )}
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2">
          {menuItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`group flex items-center gap-4 px-4 py-4 rounded-2xl transition-all cursor-pointer ${
                  active 
                    ? 'bg-sky-500/10 border border-sky-500/20 text-sky-400' 
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                }`}>
                  <item.icon className={`text-xl ${active ? 'text-sky-400' : 'group-hover:text-sky-400'}`} />
                  {!collapsed && (
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase">{item.label}</span>
                  )}
                  {active && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-8">
           <button 
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors"
           >
             {collapsed ? <FiMenu /> : <FiX />}
           </button>
        </div>
      </MotionDiv>

      {/* Main Operational Surface */}
      <main className="flex-1 relative overflow-y-auto custom-scrollbar pt-12 px-12 pb-20 z-10">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
        
        {/* Persistence Status Bar */}
        <div className="fixed bottom-0 right-0 left-0 h-10 bg-black/80 backdrop-blur-md border-t border-white/5 flex items-center px-12 justify-between z-50">
           <div className="flex items-center gap-6">
              <FleetTelemetry />
           </div>

           <div className="flex items-center gap-6">
              <button 
                className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg group hover:bg-rose-500/20 transition-all"
                onClick={() => {
                    const confirmed = window.confirm('☢️ WARNING: ACTIVATE GLOBAL LIQUIDATION PROTOCOL?');
                    if (confirmed) {
                        alert('PROTOCOL INITIATED: LIQUIDATING ALL POSITIONS');
                        // In a real app, we'd call the kill-switch API here
                    }
                }}
              >
                 <FiShield className="text-rose-500 text-[10px] group-hover:animate-pulse" />
                 <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Global_Kill_Switch</span>
              </button>
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest italic font-bold">Execution monitored by Sovereign Risk Mesh v3.1</span>
              {mounted && (
                <span className="text-[8px] font-mono text-sky-400/50 uppercase tracking-widest">{new Date().toISOString()}</span>
              )}
           </div>
        </div>
      </main>
    </div>
  );
};
