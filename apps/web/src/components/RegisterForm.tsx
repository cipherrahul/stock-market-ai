import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { MotionDiv, MotionButton, MotionP } from '@/components/Motion';
import { FiUser, FiMail, FiLock, FiShield, FiArrowRight } from 'react-icons/fi';

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const { register, loading, error } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Identity Verification Failed: Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Security Violation: Password must be at least 8 characters');
      return;
    }

    try {
      await register(email, password, name);
      toast.success('Onboarding Successful // Redirecting to Secure Gateway');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      toast.error(error || 'Onboarding Protocol Failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden font-sans">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />

      <MotionDiv 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-xl relative z-10 px-6 py-12"
      >
        <div className="glass-panel rounded-[3rem] p-12 border-glow shadow-2xl relative overflow-hidden backdrop-blur-3xl bg-white/[0.01]">
          {/* Header Section */}
          <div className="text-center mb-10">
            <MotionDiv 
              initial={{ rotate: 10 }}
              animate={{ rotate: 0 }}
              className="inline-flex items-center gap-3 mb-6"
            >
              <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                <FiShield className="text-indigo-400 text-xl" />
              </div>
              <span className="text-indigo-400 font-black tracking-[0.4em] uppercase text-[10px]">Institutional Onboarding</span>
            </MotionDiv>
            
            <h1 className="text-6xl font-black tracking-tighter italic uppercase text-white leading-none mb-4">
              JOIN FLEET
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Initialize your Sovereign Trading Identity</p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4">Full Identity Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <FiUser className="text-white" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-white/[0.02] border border-white/10 rounded-[2rem] text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.04] transition-all font-medium placeholder:text-slate-700"
                    placeholder="Operator Name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4">Personnel Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <FiMail className="text-white" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-white/[0.02] border border-white/10 rounded-[2rem] text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.04] transition-all font-medium placeholder:text-slate-700"
                    placeholder="name@sovereign.vault"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4">Security Key</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                      <FiLock className="text-white" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-14 pr-6 py-4 bg-white/[0.02] border border-white/10 rounded-[2rem] text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.04] transition-all font-medium placeholder:text-slate-700"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4">Confirm Key</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                      <FiLock className="text-white" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-14 pr-6 py-4 bg-white/[0.02] border border-white/10 rounded-[2rem] text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.04] transition-all font-medium placeholder:text-slate-700"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <MotionP 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-rose-400 text-[10px] font-black uppercase tracking-widest text-center py-2"
              >
                ONBOARDING_ERROR: {error}
              </MotionP>
            )}

            <MotionButton
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 bg-white text-[#020617] font-black rounded-[2rem] transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs hover:bg-slate-100 disabled:opacity-50 mt-4"
            >
              {loading ? (
                'Processing...'
              ) : (
                <>
                  Process Onboarding <FiArrowRight className="text-lg" />
                </>
              )}
            </MotionButton>
          </form>

          {/* Footer Section */}
          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              Already Cleared?{' '}
              <a href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors ml-2 underline decoration-indigo-500/30 underline-offset-4">
                Enter Gateway
              </a>
            </p>
          </div>
        </div>
        
        {/* Compliance Footer */}
        <p className="mt-8 text-center text-[8px] text-slate-600 font-bold uppercase tracking-[0.3em] opacity-40">
          Agentic Sovereignty Protocols Active // Verified 2026 Fleet Identity // AES-256
        </p>
        </MotionDiv>
    </div>
  );
};
