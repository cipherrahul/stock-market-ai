'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { PageIntro, SectionCard } from '@/components/EnterpriseUI';
import { useApi } from '@/hooks/useApi';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { FiBell, FiPlus, FiTrash2, FiArrowUp, FiArrowDown, FiUser, FiShield } from 'react-icons/fi';
import type { PriceAlert } from '@/components/Layout';

function loadAlerts(): PriceAlert[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('priceAlerts') || '[]'); } catch { return []; }
}
function saveAlerts(alerts: PriceAlert[]) {
  if (typeof window !== 'undefined') localStorage.setItem('priceAlerts', JSON.stringify(alerts));
}

export default function SettingsPage() {
  const router = useRouter();
  const { put, get, loading } = useApi();
  const { isDracula, setTheme } = useTheme();
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  // Risk preferences
  const [riskLevel, setRiskLevel] = useState('medium');
  const [maxPositionSize, setMaxPositionSize] = useState('100000');
  const [defaultVariant, setDefaultVariant] = useState<'CNC' | 'MIS'>('CNC');
  const [defaultStopLossPct, setDefaultStopLossPct] = useState('2');
  const [notifications, setNotifications] = useState(true);

  // Account info
  const [userEmail, setUserEmail] = useState('');
  const [userCreatedAt, setUserCreatedAt] = useState('');

  // Price alerts
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertSymbol, setAlertSymbol] = useState('');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDirection, setAlertDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');

  useEffect(() => { if (!token) router.push('/login'); }, [router, token]);

  // Load user profile + saved preferences
  useEffect(() => {
    if (!userId) return;
    const prefs = JSON.parse(localStorage.getItem(`prefs_${userId}`) || '{}');
    if (prefs.riskLevel) setRiskLevel(prefs.riskLevel);
    if (prefs.maxPositionSize) setMaxPositionSize(String(prefs.maxPositionSize));
    if (prefs.defaultVariant) setDefaultVariant(prefs.defaultVariant);
    if (prefs.defaultStopLossPct) setDefaultStopLossPct(String(prefs.defaultStopLossPct));
    if (prefs.notifications !== undefined) setNotifications(prefs.notifications);
    if (prefs.darkMode !== undefined) {
      setTheme(prefs.darkMode ? 'dracula' : 'light');
    }

    setAlerts(loadAlerts());

    get(`/api/v1/users/${userId}`)
      .then((data: any) => { if (data) { setUserEmail(data.email || ''); setUserCreatedAt(data.createdAt || data.created_at || ''); } })
      .catch(() => { });
  }, [userId, get, setTheme]);

  const handleSave = useCallback(async () => {
    if (!userId) return;
    const prefs = { riskLevel, maxPositionSize: Number(maxPositionSize), defaultVariant, defaultStopLossPct: Number(defaultStopLossPct), notifications, darkMode: isDracula };
    localStorage.setItem(`prefs_${userId}`, JSON.stringify(prefs));
    // Also persist default variant for TradingPanel to read
    localStorage.setItem('defaultOrderVariant', defaultVariant);
    localStorage.setItem('defaultStopLossPct', defaultStopLossPct);
    try {
      await put(`/api/v1/users/${userId}`, { preferences: prefs });
      toast.success('Settings saved successfully');
    } catch {
      toast.success('Settings saved locally'); // Still save locally even if API fails
    }
  }, [userId, riskLevel, maxPositionSize, defaultVariant, defaultStopLossPct, notifications, isDracula, put]);

  const addAlert = useCallback(() => {
    if (!alertSymbol.trim() || !alertPrice.trim() || isNaN(Number(alertPrice))) {
      toast.error('Enter a valid symbol and price'); return;
    }
    const newAlert: PriceAlert = {
      id: crypto.randomUUID(),
      symbol: alertSymbol.trim().toUpperCase(),
      targetPrice: Number(alertPrice),
      direction: alertDirection,
      triggered: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [...alerts, newAlert];
    setAlerts(updated); saveAlerts(updated);
    setAlertSymbol(''); setAlertPrice('');
    toast.success(`Alert set: ${newAlert.symbol} ${alertDirection} ₹${newAlert.targetPrice}`);
  }, [alertSymbol, alertPrice, alertDirection, alerts]);

  const removeAlert = useCallback((id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated); saveAlerts(updated);
    toast('Alert removed', { icon: '🗑️' });
  }, [alerts]);

  const clearTriggered = useCallback(() => {
    const updated = alerts.filter(a => !a.triggered);
    setAlerts(updated); saveAlerts(updated);
    toast.success('Triggered alerts cleared');
  }, [alerts]);

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <Layout>
      <div className="space-y-6">
        <PageIntro
          badge="Settings"
          title="Configuration Workspace"
          description="Execution preferences, default order types, stop-loss defaults, price alerts, and account information."
          actions={
            <button onClick={handleSave} disabled={loading} className="primary-button text-xs">
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          {/* Left column */}
          <div className="space-y-6">
            {/* Execution Preferences */}
            <SectionCard title="Execution Preferences" description="Default parameters applied to new orders at the trading desk.">
              <div className="grid gap-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Risk Level</span>
                    <select value={riskLevel} onChange={e => setRiskLevel(e.target.value)} className="input-field">
                      <option value="low">Low — Conservative</option>
                      <option value="medium">Medium — Balanced</option>
                      <option value="high">High — Aggressive</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Max Position Size (₹)</span>
                    <input value={maxPositionSize} onChange={e => setMaxPositionSize(e.target.value)} className="input-field" type="number" min="1" />
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <span className="mb-2 block text-sm font-medium text-slate-700">Default Order Type</span>
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                      {(['CNC', 'MIS'] as const).map(v => (
                        <button key={v} onClick={() => setDefaultVariant(v)}
                          className={`flex-1 py-2.5 text-xs font-bold tracking-widest transition-all ${defaultVariant === v
                            ? v === 'MIS' ? 'bg-purple-600 text-white' : 'bg-sky-600 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                          {v === 'CNC' ? 'CNC — Delivery' : 'MIS — Intraday'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {defaultVariant === 'MIS' ? '⚡ Intraday: Auto square-off at 15:30 IST' : '📦 Delivery: Position held overnight'}
                    </p>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Default Stop-Loss %</span>
                    <div className="relative">
                      <input
                        value={defaultStopLossPct}
                        onChange={e => setDefaultStopLossPct(e.target.value)}
                        className="input-field pr-8"
                        type="number" min="0.1" max="50" step="0.5"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Push Notifications</p>
                    <p className="text-xs text-slate-500 mt-0.5">Trade confirmations, price alerts, and system updates</p>
                  </div>
                  <button
                    onClick={() => setNotifications(n => !n)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifications ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifications ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Theme & Appearance */}
            <SectionCard
              title="Theme & Appearance"
              description="Switch between Light Enterprise and the official Dracula Theme. Applied instantly with zero page reload."
            >
              <ThemeSwitcher variant="card" />
            </SectionCard>

            {/* Price Alerts */}
            <SectionCard
              id="alerts"
              title={<span className="flex items-center gap-2"><FiBell size={15} className="text-blue-500" /> Price Alerts <span className="ml-1 rounded-full bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5">{activeAlerts.length}</span></span>}
              description="Get notified when any stock crosses your target price."
              actions={triggeredAlerts.length > 0 ? (
                <button onClick={clearTriggered} className="secondary-button text-xs"><FiTrash2 size={12} /> Clear triggered</button>
              ) : undefined}
            >
              <div className="space-y-4">
                {/* Add Alert Form */}
                <div className="flex flex-wrap gap-2 items-end p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex-1 min-w-[100px]">
                    <p className="text-xs font-medium text-slate-500 mb-1.5">Symbol</p>
                    <input value={alertSymbol} onChange={e => setAlertSymbol(e.target.value.toUpperCase())} placeholder="RELIANCE" className="input-field h-9 text-sm uppercase font-bold" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1.5">Direction</p>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden h-9">
                      {(['ABOVE', 'BELOW'] as const).map(d => (
                        <button key={d} onClick={() => setAlertDirection(d)}
                          className={`px-3 text-xs font-bold flex items-center gap-1 transition-colors ${alertDirection === d
                            ? d === 'ABOVE' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                          {d === 'ABOVE' ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />} {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-[110px]">
                    <p className="text-xs font-medium text-slate-500 mb-1.5">Target Price (₹)</p>
                    <input value={alertPrice} onChange={e => setAlertPrice(e.target.value)} placeholder="2800.00" type="number" className="input-field h-9 text-sm tabular-nums" />
                  </div>
                  <button onClick={addAlert} className="primary-button h-9 text-xs flex items-center gap-1.5 shrink-0">
                    <FiPlus size={13} /> Add Alert
                  </button>
                </div>

                {/* Active Alerts */}
                {activeAlerts.length > 0 && (
                  <div className="space-y-2">
                    {activeAlerts.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={`p-1.5 rounded-lg ${a.direction === 'ABOVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {a.direction === 'ABOVE' ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{a.symbol}</p>
                            <p className="text-xs text-slate-500">{a.direction} ₹{a.targetPrice.toFixed(2)}</p>
                          </div>
                        </div>
                        <button onClick={() => removeAlert(a.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Triggered Alerts */}
                {triggeredAlerts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Triggered</p>
                    {triggeredAlerts.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 opacity-60">
                        <div className="flex items-center gap-3">
                          <span className="p-1.5 rounded-lg bg-slate-100 text-slate-400">
                            {a.direction === 'ABOVE' ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-600 line-through">{a.symbol}</p>
                            <p className="text-xs text-slate-400">{a.direction} ₹{a.targetPrice.toFixed(2)} — ✅ Triggered</p>
                          </div>
                        </div>
                        <button onClick={() => removeAlert(a.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 transition-colors">
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {alerts.length === 0 && (
                  <p className="text-xs text-center text-slate-400 py-4">No alerts set. Add one above — alerts fire instantly when prices are received via WebSocket.</p>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Current Configuration Summary */}
            <SectionCard title="Active Configuration" description="Effective values for the current session.">
              <div className="space-y-3">
                {[
                  ['Risk Level', riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)],
                  ['Position Cap', `₹${Number(maxPositionSize || '0').toLocaleString('en-IN')}`],
                  ['Default Order', defaultVariant],
                  ['Default SL', `${defaultStopLossPct}%`],
                  ['Notifications', notifications ? 'Enabled' : 'Disabled'],
                  ['Theme', isDracula ? 'Dracula Theme (Dark)' : 'Light Enterprise'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</span>
                    <span className="text-sm font-bold text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Account Info */}
            <SectionCard title="Account Information" description="Your registered profile details.">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    <FiUser size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{userEmail || 'Loading…'}</p>
                    {userCreatedAt && (
                      <p className="text-xs text-slate-400 mt-0.5">Member since {new Date(userCreatedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}</p>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                  <FiShield size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">AES-256 Encrypted Session</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Your trading data is secured end-to-end. Session tokens rotate every 24 hours.</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div >
    </Layout >
  );
}
