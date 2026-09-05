'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiArrowRight, FiLock, FiMail, FiEye, FiEyeOff, FiTrendingUp, FiShield, FiZap, FiBarChart2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await login(email.trim(), password);
      localStorage.setItem('userId', response.user.id);
      toast.success('Signed in successfully');
      router.push('/dashboard');
    } catch {
      toast.error(error || 'Login failed. Check your credentials.');
    }
  };

  const features = [
    { icon: FiTrendingUp, title: 'Real-time Trading', desc: 'Execute orders with live market data and smart routing.' },
    { icon: FiShield,     title: 'Risk Management',  desc: 'Automated circuit breakers and portfolio protection.' },
    { icon: FiZap,        title: 'AI Signals',        desc: 'LSTM-powered alpha signals with 75%+ confidence threshold.' },
    { icon: FiBarChart2,  title: 'Analytics Suite',   desc: 'Comprehensive P&L tracking and portfolio analytics.' },
  ];

  const handleSkipLogin = () => {
    const demoUser = {
      id: 'demo_trader_001',
      name: 'Alex Vance (Lead Quant)',
      email: 'trader@sovereign.local',
      role: 'HEAD_TRADER',
    };
    localStorage.setItem('token', 'demo_access_token_sovereign_ai');
    localStorage.setItem('accessToken', 'demo_access_token_sovereign_ai');
    localStorage.setItem('userId', demoUser.id);
    localStorage.setItem('user', JSON.stringify(demoUser));
    toast.success('Bypassing login — Demo Session Active');
    router.push('/dashboard');
  };

  const handleFillDemoCredentials = () => {
    setEmail('admin@sovereign.local');
    setPassword('SovereignAI2026!');
    toast('Demo credentials populated', { icon: '🔑' });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 bg-[var(--bg)]">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-xl)] lg:grid-cols-[1.2fr_0.8fr]">
        
        {/* Left panel */}
        <section className="hidden border-r border-slate-100 bg-gradient-to-br from-[#1e40af] via-[#1d4ed8] to-[#2563eb] p-12 lg:flex lg:flex-col">
          <div className="mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-200">Sovereign AI Platform</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white leading-tight">
              Enterprise trading intelligence, unified.
            </h1>
            <p className="mt-4 text-base leading-7 text-blue-100/80 max-w-lg">
              Institutional-grade algorithmic trading, AI-powered signals, and autonomous portfolio management 
              from a single clean workspace.
            </p>
          </div>

          <div className="grid gap-4 mt-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 rounded-xl bg-white/8 border border-white/10 p-4 backdrop-blur-sm">
                <div className="shrink-0 rounded-lg bg-white/15 p-2 h-9 w-9 flex items-center justify-center">
                  <Icon className="text-white" size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{title}</h2>
                  <p className="mt-0.5 text-xs leading-5 text-blue-100/70">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick test bypass in left panel too */}
          <div className="mt-auto pt-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="live-dot" />
              <span className="text-xs text-blue-200 font-medium">Test Mode Available · v2.0.4</span>
            </div>
            <button
              type="button"
              onClick={handleSkipLogin}
              className="text-xs text-blue-100 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg transition font-medium"
            >
              Skip to Dashboard →
            </button>
          </div>
        </section>

        {/* Right panel — login form */}
        <section className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Sign In</p>
              <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                Testing Mode Active
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter your workspace credentials or use instant demo access below.
            </p>

            {/* Quick Testing Access Banner */}
            <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  ⚡ Testing Shortcut
                </span>
                <button
                  type="button"
                  onClick={handleFillDemoCredentials}
                  className="text-blue-600 hover:text-blue-700 font-medium underline text-[11px]"
                >
                  Fill demo credentials
                </button>
              </div>
              <button
                type="button"
                id="skip-login-btn"
                onClick={handleSkipLogin}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <span>🚀 Skip Login — Access Dashboard Directly</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <FiMail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="input-field pl-10"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input-field pl-10 pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                id="login-submit-btn"
                disabled={loading}
                className="primary-button w-full mt-2"
                style={{ height: '44px' }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign in
                    <FiArrowRight size={15} />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6 text-sm">
              <span className="text-slate-500">Need an account?</span>
              <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Create workspace access
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};