'use client';

import React from 'react';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { FiSun, FiMoon, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface ThemeSwitcherProps {
  variant?: 'header' | 'card' | 'compact';
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ variant = 'header', className = '' }) => {
  const { theme, isDracula, setTheme } = useTheme();

  const handleToggle = () => {
    const nextTheme: Theme = isDracula ? 'light' : 'dracula';
    setTheme(nextTheme);
    if (nextTheme === 'dracula') {
      toast('🧛 Switched to Dracula Theme', {
        id: 'theme-switch',
        duration: 3000,
        style: {
          background: '#21222c',
          color: '#bd93f9',
          border: '1px solid #44475a',
          fontWeight: 600,
        },
        icon: '🌙',
      });
    } else {
      toast('☀️ Switched to Light Theme', {
        id: 'theme-switch',
        duration: 3000,
        style: {
          background: '#ffffff',
          color: '#0f1929',
          border: '1px solid #dde3ee',
          fontWeight: 600,
        },
        icon: '☀️',
      });
    }
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={isDracula ? 'Switch to Light Theme' : 'Switch to Dracula Theme'}
        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200 ${
          isDracula
            ? 'border-[#44475a] bg-[#282a36] text-[#bd93f9] hover:border-[#bd93f9] hover:shadow-[0_0_12px_rgba(189,147,249,0.35)]'
            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-slate-50'
        } ${className}`}
        aria-label="Toggle Theme"
      >
        {isDracula ? <FiMoon size={15} className="animate-pulse" /> : <FiSun size={15} />}
      </button>
    );
  }

  if (variant === 'header') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={isDracula ? 'Active: Dracula Theme. Click to switch to Light.' : 'Active: Light Theme. Click to switch to Dracula.'}
        className={`group relative flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 ${
          isDracula
            ? 'border-[#6272a4]/40 bg-[#282a36] text-[#f8f8f2] shadow-[0_0_16px_rgba(189,147,249,0.2)] hover:border-[#bd93f9] hover:shadow-[0_0_20px_rgba(189,147,249,0.35)]'
            : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50'
        } ${className}`}
        aria-label="Theme Switcher"
      >
        {/* Toggle Track */}
        <div
          className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-200 ${
            isDracula ? 'bg-[#44475a]' : 'bg-slate-200'
          }`}
        >
          {/* Thumb */}
          <div
            className={`flex h-4 w-4 transform items-center justify-center rounded-full transition-transform duration-200 ${
              isDracula
                ? 'translate-x-4 bg-[#bd93f9] text-[#282a36] shadow-[0_0_8px_#bd93f9]'
                : 'translate-x-0 bg-white text-amber-500 shadow-sm'
            }`}
          >
            {isDracula ? <FiMoon size={10} /> : <FiSun size={10} />}
          </div>
        </div>

        {/* Label badge */}
        <span className="flex items-center gap-1.5 tracking-tight">
          {isDracula ? (
            <>
              <span className="font-bold text-[#bd93f9]">Dracula</span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#50fa7b] shadow-[0_0_6px_#50fa7b]" />
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-600">Light</span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            </>
          )}
        </span>
      </button>
    );
  }

  // variant === 'card' for Settings page
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>
      {/* Light Theme Card */}
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`relative flex flex-col rounded-2xl border p-5 text-left transition-all duration-200 ${
          theme === 'light'
            ? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20 shadow-md'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
        }`}
      >
        <div className="flex items-center justify-between w-full mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 border border-amber-200 text-amber-500">
              <FiSun size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Light Enterprise</h4>
              <p className="text-[11px] text-slate-500">Daylight institutional mode</p>
            </div>
          </div>
          {theme === 'light' && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
              <FiCheck size={14} />
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          Crisp high-contrast workspace with pure white card surfaces and sovereign royal blue accents.
        </p>

        {/* Color Palette Swatches */}
        <div className="mt-auto flex items-center gap-1.5 pt-3 border-t border-slate-100">
          <span className="text-[10px] font-semibold text-slate-400 mr-1 uppercase tracking-wider">Palette</span>
          <span className="h-4 w-4 rounded-full border border-slate-300 bg-[#ffffff] shadow-xs" title="#ffffff (Surface)" />
          <span className="h-4 w-4 rounded-full border border-slate-300 bg-[#f4f6fb]" title="#f4f6fb (Canvas)" />
          <span className="h-4 w-4 rounded-full bg-[#2563eb]" title="#2563eb (Primary Blue)" />
          <span className="h-4 w-4 rounded-full bg-[#059669]" title="#059669 (Emerald)" />
        </div>
      </button>

      {/* Dracula Theme Card */}
      <button
        type="button"
        onClick={() => setTheme('dracula')}
        className={`relative flex flex-col rounded-2xl border p-5 text-left transition-all duration-200 ${
          theme === 'dracula'
            ? 'border-[#bd93f9] bg-[#282a36] ring-2 ring-[#bd93f9]/30 shadow-[0_8px_30px_rgba(0,0,0,0.6)]'
            : 'border-[#44475a] bg-[#21222c] hover:border-[#6272a4]'
        }`}
      >
        <div className="flex items-center justify-between w-full mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#44475a]/50 border border-[#bd93f9]/40 text-[#bd93f9] shadow-[0_0_12px_rgba(189,147,249,0.3)]">
              <FiMoon size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#f8f8f2] flex items-center gap-1.5">
                Dracula Theme
                <span className="rounded bg-[#bd93f9]/20 px-1.5 py-0.2 text-[9px] font-extrabold text-[#bd93f9] uppercase tracking-wider">
                  Vampire
                </span>
              </h4>
              <p className="text-[11px] text-[#6272a4]">Official dark high-focus mode</p>
            </div>
          </div>
          {theme === 'dracula' && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#bd93f9] text-[#282a36] font-bold shadow-[0_0_10px_#bd93f9]">
              <FiCheck size={14} />
            </span>
          )}
        </div>

        <p className="text-xs text-[#bfbfd4] leading-relaxed mb-4">
          The iconic Dracula theme. Deep violet-tinted dark canvas with glowing purple, cyan, green, and pink accents.
        </p>

        {/* Color Palette Swatches */}
        <div className="mt-auto flex items-center gap-1.5 pt-3 border-t border-[#44475a]/60">
          <span className="text-[10px] font-semibold text-[#6272a4] mr-1 uppercase tracking-wider">Dracula</span>
          <span className="h-4 w-4 rounded-full bg-[#282a36] border border-[#44475a]" title="#282a36 (Dracula Background)" />
          <span className="h-4 w-4 rounded-full bg-[#44475a]" title="#44475a (Current Line)" />
          <span className="h-4 w-4 rounded-full bg-[#bd93f9] shadow-[0_0_6px_#bd93f9]" title="#bd93f9 (Purple)" />
          <span className="h-4 w-4 rounded-full bg-[#8be9fd]" title="#8be9fd (Cyan)" />
          <span className="h-4 w-4 rounded-full bg-[#50fa7b]" title="#50fa7b (Green)" />
          <span className="h-4 w-4 rounded-full bg-[#ff79c6]" title="#ff79c6 (Pink)" />
        </div>
      </button>
    </div>
  );
};

export default ThemeSwitcher;
