import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  FiLogOut, 
  FiHome, 
  FiTrendingUp, 
  FiSettings, 
  FiBarChart2, 
  FiList, 
  FiCpu,
  FiShield,
  FiActivity
} from 'react-icons/fi';
import { MotionAside, MotionDiv } from '@/components/Motion';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { href: '/dashboard', label: 'Command Center', icon: FiHome },
    { href: '/trading', label: 'Execution', icon: FiTrendingUp },
    { href: '/signals', label: 'Neural Alpha', icon: FiCpu },
    { href: '/analytics', label: 'Intelligence', icon: FiBarChart2 },
    { href: '/orders', label: 'Registry', icon: FiList },
    { href: '/settings', label: 'Protocols', icon: FiSettings },
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-50 font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Sidebar */}
      <MotionAside 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-80 bg-white/[0.01] border-r border-white/5 flex flex-col relative z-20 backdrop-blur-3xl"
      >
        {/* Brand Header */}
        <div className="p-10 mb-8">
          <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <FiShield className="text-indigo-400 text-sm" />
             </div>
             <span className="text-indigo-400 font-black tracking-[0.3em] uppercase text-[9px]">Sovereign // Agent</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter italic uppercase text-white leading-none">
            SOVEREIGN
          </h1>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.15em] mt-2">Asset Orchestrator v2.0</p>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-6 space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center px-6 py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${
                  active
                    ? 'bg-white/[0.03] text-white border border-white/10 shadow-xl'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.01]'
                }`}
              >
                {active && (
                  <MotionDiv 
                    layoutId="nav-active"
                    className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  />
                )}
                <Icon className={`mr-4 text-lg ${active ? 'text-indigo-400' : 'group-hover:text-indigo-300'} transition-colors`} /> 
                <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* System Intelligence Matrix */}
        <div className="p-8 m-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <FiActivity className="text-3xl text-indigo-400" />
           </div>
           <p className="text-[10px] font-black text-indigo-300/60 uppercase tracking-widest mb-3 italic underline decoration-indigo-500/30 underline-offset-4">Fleet Status</p>
           <div className="space-y-4">
              <div className="flex justify-between items-center">
                 <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">API Liveness</span>
                 <span className="text-[9px] font-mono text-emerald-400 font-black tracking-tighter">NOMINAL</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Vault Latency</span>
                 <span className="text-[9px] font-mono text-blue-400 font-black tracking-tighter">0.14ms</span>
              </div>
           </div>
        </div>

        {/* Action Section */}
        <div className="p-8 border-t border-white/5 space-y-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-6 py-4 bg-white/[0.02] hover:bg-rose-500/10 hover:text-rose-400 group border border-white/5 hover:border-rose-500/20 rounded-[1.5rem] transition-all text-slate-600"
          >
            <FiLogOut className="mr-3 text-lg group-hover:text-rose-400 transition-colors" /> 
            <span className="text-[11px] font-black uppercase tracking-widest">Terminate Session</span>
          </button>
        </div>
      </MotionAside>

      {/* Main Orchestration Viewport */}
      <main className="flex-1 overflow-auto relative z-10 custom-scrollbar">
        {/* Content Container */}
        <div className="p-4 md:p-8">
           {children}
        </div>
      </main>

      {/* Global CSS for scrollbars */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
};
