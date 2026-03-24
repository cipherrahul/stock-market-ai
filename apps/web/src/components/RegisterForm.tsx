import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { MotionDiv, MotionButton, MotionP } from '@/components/Motion';
import { FiUser, FiMail, FiLock, FiArrowRight } from 'react-icons/fi';

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const { register, loading, error } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value.trim());
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value.trim());
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      await register(email, password, name);
      toast.success('Account created successfully. Redirecting to login...');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      toast.error(error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 relative overflow-hidden font-sans">
      {/* Subtle background pattern */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-30" />

      <MotionDiv 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md relative z-10 px-6"
      >
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Create Account
            </h1>
            <p className="text-slate-600 text-sm">Sign up to get started</p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-slate-600 transition-colors">
                  <FiUser className="text-base" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-200 transition-all font-medium"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-slate-600 transition-colors">
                  <FiMail className="text-base" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-200 transition-all font-medium"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-slate-600 transition-colors">
                  <FiLock className="text-base" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-200 transition-all font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
              <p className="text-xs text-slate-500 pl-4">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Confirm Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-slate-600 transition-colors">
                  <FiLock className="text-base" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-200 transition-all font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <MotionP 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-200"
              >
                {error}
              </MotionP>
            )}

            <MotionButton
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                'Creating account...'
              ) : (
                <>
                  Sign up <FiArrowRight className="text-base" />
                </>
              )}
            </MotionButton>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-slate-300" />
            <span className="px-3 text-sm text-slate-500">or</span>
            <div className="flex-1 border-t border-slate-300" />
          </div>

          {/* Footer Section */}
          <div className="text-center">
            <p className="text-slate-600 text-sm">
              Already have an account?{' '}
              <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
                Sign in
              </a>
            </p>
          </div>
        </div>
        
        {/* Footer text */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Protected by enterprise-grade security
        </p>
        </MotionDiv>
    </div>
  );
};
