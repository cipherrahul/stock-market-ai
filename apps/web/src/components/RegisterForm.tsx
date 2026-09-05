'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiArrowRight, FiLock, FiMail, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const { register, loading, error } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      await register(email.trim(), password, name.trim());
      toast.success('Account created');
      router.push('/login');
    } catch (err) {
      toast.error(error || 'Registration failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="border-b border-slate-200 bg-slate-50 p-8 lg:border-b-0 lg:border-r lg:p-12">
          <p className="eyebrow">Workspace Provisioning</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Set up a new enterprise user</h1>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Create a user profile for portfolio review, trading operations, analytics, and AI-assisted execution workflows.
          </p>

          <div className="mt-8 space-y-4">
            {[
              'Dedicated white-theme workspace with persistent left navigation',
              'Protected auth flow with refresh token support',
              'Built for trading desks, review teams, and operational monitoring',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                <p className="text-sm text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto max-w-lg">
            <p className="eyebrow">Register</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Create your account</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Provision access with a secure password and business email.</p>

            <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Full name</span>
                <div className="relative">
                  <FiUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter full name"
                    className="input-field pl-11"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <div className="relative">
                  <FiMail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@company.com"
                    className="input-field pl-11"
                    required
                  />
                </div>
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                  <div className="relative">
                    <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 8 characters"
                      className="input-field pl-11"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Confirm password</span>
                  <div className="relative">
                    <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat password"
                      className="input-field pl-11"
                      required
                    />
                  </div>
                </label>
              </div>

              {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

              <button type="submit" disabled={loading} className="primary-button mt-2 w-full gap-2">
                {loading ? 'Creating account...' : 'Create account'}
                {!loading ? <FiArrowRight /> : null}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6 text-sm">
              <span className="text-slate-500">Already have access?</span>
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
