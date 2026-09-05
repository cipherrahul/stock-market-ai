'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FiActivity, FiBarChart2, FiChevronRight, FiChevronLeft, FiCpu,
  FiGrid, FiList, FiLogOut, FiMenu, FiSettings,
  FiTrendingUp, FiX, FiWifi, FiWifiOff, FiBell,
  FiArrowUpRight, FiArrowDownRight, FiDollarSign,
} from 'react-icons/fi';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { ConnectionStatus } from './ConnectionStatus';
import { ThemeSwitcher } from './ThemeSwitcher';
import axios from 'axios';
import toast from 'react-hot-toast';

interface LayoutProps { children: React.ReactNode; }

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: FiGrid },
  { href: '/trading', label: 'Trading Desk', icon: FiTrendingUp },
  { href: '/signals', label: 'AI Signals', icon: FiCpu },
  { href: '/analytics', label: 'Analytics', icon: FiBarChart2 },
  { href: '/orders', label: 'Orders', icon: FiList },
  { href: '/settings', label: 'Settings', icon: FiSettings },
];

interface PortfolioMini { cash: number; totalValue: number; totalPnl: number; }

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: 'ABOVE' | 'BELOW';
  triggered: boolean;
  createdAt: string;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clock, setClock] = useState('');
  const { status: wsStatus, latencyMs, subscribe } = useWebSocket();
  const [portfolioMini, setPortfolioMini] = useState<PortfolioMini | null>(null);
  const [alertCount, setAlertCount] = useState(0);

  // ── Navbar Collapse / Hide Toggle ───────────────────────────────────────────
  const [navbarCollapsed, setNavbarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sovereign_navbar_collapsed');
      if (saved !== null) setNavbarCollapsed(saved === 'true');
    } catch { /* ignore */ }
  }, []);

  const toggleNavbar = () => {
    setNavbarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sovereign_navbar_collapsed', String(next)); } catch { }
      return next;
    });
  };

  // Shortcut: Ctrl+B or Cmd+B to toggle navbar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleNavbar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [userName, setUserName] = useState('User');

  useEffect(() => {
    try {
      const stored = (JSON.parse(localStorage.getItem('user') || '{}') as { name?: string }).name;
      if (stored) setUserName(stored);
    } catch {
      // ignore
    }
  }, []);

  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const fetchPortfolioMini = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    const userId = localStorage.getItem('userId') || '';
    if (!token || !userId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    try {
      const [pRes, plRes] = await Promise.all([
        axios.get(`${apiUrl}/api/v1/portfolio/${userId}`, { headers: { Authorization: `Bearer ${token}` }, timeout: 6000 }),
        axios.get(`${apiUrl}/api/v1/portfolio/${userId}/pnl`, { headers: { Authorization: `Bearer ${token}` }, timeout: 6000 }),
      ]);
      setPortfolioMini({ cash: pRes.data?.cash || 0, totalValue: pRes.data?.totalValue || 0, totalPnl: plRes.data?.totalPnl || 0 });
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchPortfolioMini();
    const id = setInterval(fetchPortfolioMini, 30000);
    return () => clearInterval(id);
  }, [fetchPortfolioMini]);

  useEffect(() => subscribe('PORTFOLIO_UPDATES', (data: any) => {
    if (data?.cash !== undefined) setPortfolioMini(prev => prev ? { ...prev, cash: data.cash ?? prev.cash, totalValue: data.totalValue ?? prev.totalValue } : prev);
  }), [subscribe]);

  // Real-time price alert evaluation
  useEffect(() => subscribe('PRICE_UPDATES', (data: any) => {
    if (!data?.symbol || !data?.price || typeof window === 'undefined') return;
    try {
      const alerts: PriceAlert[] = JSON.parse(localStorage.getItem('priceAlerts') || '[]');
      let changed = false;
      const updated = alerts.map(a => {
        if (a.triggered || a.symbol !== data.symbol) return a;
        const hit = (a.direction === 'ABOVE' && data.price >= a.targetPrice) || (a.direction === 'BELOW' && data.price <= a.targetPrice);
        if (hit) {
          toast(`🔔 ${a.symbol} ${a.direction === 'ABOVE' ? '📈' : '📉'} hit ₹${a.targetPrice.toFixed(2)}`, { duration: 8000 });
          changed = true;
          return { ...a, triggered: true };
        }
        return a;
      });
      if (changed) { localStorage.setItem('priceAlerts', JSON.stringify(updated)); setAlertCount(updated.filter(a => !a.triggered).length); }
    } catch { /* ignore */ }
  }), [subscribe]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { setAlertCount((JSON.parse(localStorage.getItem('priceAlerts') || '[]') as PriceAlert[]).filter(a => !a.triggered).length); }
    catch { setAlertCount(0); }
  }, []);

  const handleLogout = () => {
    ['accessToken', 'token', 'refreshToken', 'accessTokenExpiry', 'user', 'userId'].forEach(k => localStorage.removeItem(k));
    router.push('/login');
  };

  const pageName = navItems.find(item => pathname?.startsWith(item.href))?.label || 'Workspace';
  const wsLabel = wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting' : 'Offline';
  const wsStatusClass = wsStatus === 'connected' ? 'status-pill-success' : wsStatus === 'connecting' ? 'status-pill-warning' : 'status-pill-danger';
  const pnlPositive = (portfolioMini?.totalPnl || 0) >= 0;

  return (
    <div className="app-shell" style={{ gridTemplateColumns: navbarCollapsed ? '1fr' : undefined }}>
      <ConnectionStatus />

      {/* Navigation Bar (Sidebar) */}
      <aside
        className={`sidebar-surface fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ${navbarCollapsed ? 'lg:hidden -translate-x-full' : 'lg:static lg:translate-x-0'
          } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 'var(--sidebar-w)' }}
      >
        <div className="flex h-full flex-col p-4">
          {/* Brand */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <p className="eyebrow">Enterprise Suite</p>
              <h1 className="mt-1 text-base font-bold tracking-tight text-slate-900">Sovereign AI</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleNavbar}
                title="Collapse Navigation Bar (Ctrl+B)"
                className="hidden lg:inline-flex rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FiChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 lg:hidden"><FiX size={16} /></button>
            </div>
          </div>

          {/* Live Portfolio Widget */}
          {portfolioMini && (
            <div className="mb-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-3 space-y-2">
              <p className="data-label flex items-center gap-1.5"><FiDollarSign size={11} className="text-blue-500" /> Portfolio</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Value</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
                    ₹{portfolioMini.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <span className={`flex items-center gap-0.5 text-sm font-bold ${pnlPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {pnlPositive ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
                  {pnlPositive ? '+' : ''}₹{Math.abs(portfolioMini.totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-400 pt-1.5 border-t border-blue-100/80">
                <span>Cash</span>
                <span className="font-semibold text-slate-600 tabular-nums">₹{portfolioMini.cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          )}

          {/* Status Card */}
          <div className={`mb-4 rounded-xl border p-3 ${wsStatus === 'connected' ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50'}`}>
            <p className="data-label mb-2">System Status</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">Market data</span>
                <span className={`status-pill ${wsStatusClass}`}>
                  {wsStatus === 'connected' ? <span className="live-dot" /> : wsStatus === 'connecting' ? <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" /> : <span className="live-dot-danger" />}
                  {wsLabel}
                </span>
              </div>
              {latencyMs !== null && wsStatus === 'connected' && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Latency</span>
                  <span className="font-mono text-xs text-slate-700 tabular-nums">{latencyMs} ms</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">Session</span>
                <span className="font-mono text-xs text-slate-700 tabular-nums">{clock}</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-0.5" aria-label="Main navigation">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}>
                  <Icon size={16} /><span className="flex-1">{label}</span>{active && <FiChevronRight size={14} />}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="mt-auto pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div suppressHydrationWarning className="flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold shrink-0" style={{ background: 'var(--primary)' }}>{userInitials}</div>
              <div className="min-w-0">
                <p suppressHydrationWarning className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                <p className="text-xs text-slate-500">Enterprise workspace</p>
              </div>
            </div>
            <button type="button" onClick={handleLogout} className="secondary-button w-full text-xs"><FiLogOut size={14} /> Sign out</button>
          </div>
        </div>
      </aside>

      {mobileOpen && (<button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />)}

      <div className="flex min-h-screen flex-col">
        {/* Workspace Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm transition-all duration-200">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setMobileOpen(!mobileOpen);
                  } else {
                    toggleNavbar();
                  }
                }}
                title={navbarCollapsed ? "Expand Navigation Bar (Ctrl+B)" : "Collapse Navigation Bar (Ctrl+B)"}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <FiMenu size={16} />
              </button>
              <div>
                <p className="text-xs text-slate-400 leading-none mb-0.5">Workspace</p>
                <h2 className="text-sm font-semibold text-slate-900">{pageName}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher variant="header" />
              {portfolioMini && (
                <span className={`hidden md:inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums ${pnlPositive ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                  {pnlPositive ? <FiArrowUpRight size={11} /> : <FiArrowDownRight size={11} />}
                  {pnlPositive ? '+' : ''}₹{Math.abs(portfolioMini.totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })} P&L
                </span>
              )}
              <Link href="/settings#alerts" className="relative hidden md:inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                <FiBell size={14} />
                {alertCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold">{alertCount > 9 ? '9+' : alertCount}</span>}
              </Link>
              {wsStatus === 'connected'
                ? <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"><FiWifi size={11} /> Live sync</span>
                : <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600"><FiWifiOff size={11} /> Offline</span>}
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-xs font-mono text-slate-600 tabular-nums"><FiActivity size={11} /> {clock}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};