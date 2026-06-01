'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface ApprovedCompany {
  id: string;
}

interface ReviewerRecord {
  id: string;
  is_active: boolean;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceResetHint = searchParams.get('reset') === '1';

  const [email, setEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState<'company_first_login' | 'email_recovery' | null>(null);
  const [viewMode, setViewMode] = useState<'login' | 'forgot'>('login');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const findApprovedCompany = async (userEmail: string): Promise<ApprovedCompany | null> => {
    const { data, error: queryError } = await supabase
      .from('applications')
      .select('id')
      .ilike('email', userEmail)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) throw queryError;
    return data || null;
  };

  const routeByRole = async (user: User) => {
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    const role = String(user.user_metadata?.role || '');

    if (role === 'company') {
      if (!normalizedEmail) {
        await supabase.auth.signOut();
        throw new Error('Company account email is missing. Please contact admin.');
      }

      const approvedCompany = await findApprovedCompany(normalizedEmail);
      if (!approvedCompany) {
        await supabase.auth.signOut();
        throw new Error('Access denied. Company login is available only after approval.');
      }

      if (user.user_metadata?.must_reset_password === true) {
        setResetMode('company_first_login');
        setAccountEmail(normalizedEmail);
        return;
      }

      router.push('/company/dashboard');
      router.refresh();
      return;
    }

    const { data: reviewerRecord } = await supabase
      .from('reviewers')
      .select('id, is_active')
      .eq('user_id', user.id)
      .maybeSingle<ReviewerRecord>();

    if (reviewerRecord) {
      if (!reviewerRecord.is_active) {
        await supabase.auth.signOut();
        throw new Error('Your reviewer account has been deactivated. Please contact the admin.');
      }
      router.push('/reviewer/dashboard');
      router.refresh();
      return;
    }

    router.push('/admin/dashboard');
    router.refresh();
  };

  useEffect(() => {
    const verifyCurrentSession = async () => {
      setError(null);
      setNotice(null);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;
      await routeByRole(session.user);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetMode('email_recovery');
        setAccountEmail(session?.user?.email || null);
        setViewMode('login');
        setError(null);
        setNotice('Set your new password to complete recovery.');
      }
    });

    verifyCurrentSession().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to verify session');
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (!authData.user) {
        setError('Login failed');
        return;
      }

      await routeByRole(authData.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const normalizedEmail = forgotEmail.trim().toLowerCase();
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (resetError) {
        throw resetError;
      }

      setNotice('Password reset link sent. Please check your email inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Session expired. Please login again.');
      }

      if (resetMode === 'company_first_login' && String(user.user_metadata?.role || '') !== 'company') {
        await supabase.auth.signOut();
        throw new Error('Password reset is only required for company users.');
      }

      const metadata = user.user_metadata || {};
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          ...metadata,
          must_reset_password: false,
          password_reset_at: new Date().toISOString(),
        },
      });

      if (updateError) {
        throw updateError;
      }

      setResetMode(null);
      setNotice('Password updated successfully.');

      if (resetMode === 'company_first_login') {
        router.push('/company/dashboard');
      } else {
        await routeByRole(user);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-6"
      style={{
        background:
          'linear-gradient(180deg, #FFFFFF 0%, #F8F8F8 100%)',
        fontFamily: 'var(--font-hanken-grotesk)',
      }}
    >
      <div className="w-full max-w-md md:max-w-lg">
        <div className="text-center mb-8">
          <h1
            className="text-3xl md:text-4xl font-semibold mb-1 tracking-tight"
            style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}
          >
            <span
              style={{
                background: 'linear-gradient(180deg, #5D5B5B 63.86%, #D5D0D0 89.74%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              SIIF Portal Login
            </span>
          </h1>
          <p
            className="text-sm md:text-base"
            style={{ color: '#565555', fontFamily: '"Hanken Grotesk", sans-serif' }}
          >
            Unified access for SIIF users
          </p>
        </div>

        <div className="bg-white rounded-[24px] shadow-[0_12px_36px_rgba(0,0,0,0.08)] p-7 md:p-8 border border-[#ECECEC]">
          <h2
            className="text-xl font-bold mb-6"
            style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}
          >
            {resetMode ? 'Set New Password' : viewMode === 'forgot' ? 'Reset Password' : 'Sign in'}
          </h2>

          {!resetMode && (
            <div className="mb-6 rounded-xl border border-[#EAEAEA] bg-[#F8F8F8] p-1 flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setViewMode('login');
                  setError(null);
                  setNotice(null);
                }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  backgroundColor: viewMode === 'login' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'login' ? '#4A4A4A' : '#8A8A8A',
                  boxShadow: viewMode === 'login' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('forgot');
                  setError(null);
                  setNotice(null);
                }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  backgroundColor: viewMode === 'forgot' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'forgot' ? '#4A4A4A' : '#8A8A8A',
                  boxShadow: viewMode === 'forgot' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                Forgot Password
              </button>
            </div>
          )}

          {error && (
            <div
              className="mb-5 p-4 rounded-lg text-sm"
              style={{
                backgroundColor: '#FFE5E5',
                color: '#D32F2F',
                fontFamily: '"Hanken Grotesk", sans-serif',
              }}
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              className="mb-5 p-4 rounded-lg text-sm"
              style={{
                backgroundColor: '#E8F6EE',
                color: '#1E7F46',
                fontFamily: '"Hanken Grotesk", sans-serif',
              }}
            >
              {notice}
            </div>
          )}

          {!resetMode && viewMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  className="block mb-1.5 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    color: '#4A4A4A',
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#D7D7D7] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent transition"
                  placeholder="you@example.com"
                  required
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A',
                  }}
                />
              </div>

              <div>
                <label
                  className="block mb-1.5 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    color: '#4A4A4A',
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#D7D7D7] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent transition"
                  placeholder="Enter password"
                  required
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderRadius: '74px',
                  background:
                    'radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), linear-gradient(90deg, #700333 0%, #E81116 100%)',
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '15px',
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : !resetMode && viewMode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <p
                style={{
                  fontSize: '13px',
                  color: '#666666',
                  fontFamily: '"Hanken Grotesk", sans-serif',
                }}
              >
                Enter your email to receive a secure password reset link.
              </p>

              <div>
                <label
                  className="block mb-1.5 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    color: '#4A4A4A',
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#D7D7D7] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent transition"
                  placeholder="you@example.com"
                  required
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderRadius: '74px',
                  background:
                    'radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), linear-gradient(90deg, #700333 0%, #E81116 100%)',
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '15px',
                }}
              >
                {loading ? 'Sending link...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <p style={{ fontSize: '13px', color: '#666666', fontFamily: '"Hanken Grotesk", sans-serif' }}>
                {resetMode === 'email_recovery'
                  ? 'You are in recovery mode. Set a new password for your account.'
                  : forceResetHint
                  ? 'For security, reset your temporary password before continuing.'
                  : 'Reset your temporary password to continue to the company dashboard.'}
              </p>

              {accountEmail && (
                <p
                  style={{
                    fontSize: '13px',
                    color: '#102A43',
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontWeight: 600,
                  }}
                >
                  Logged in as: {accountEmail}
                </p>
              )}

              <div>
                <label
                  className="block mb-1.5 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    color: '#4A4A4A',
                  }}
                >
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#D7D7D7] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent transition"
                  placeholder="At least 8 characters"
                  required
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A',
                  }}
                />
              </div>

              <div>
                <label
                  className="block mb-1.5 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    color: '#4A4A4A',
                  }}
                >
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#D7D7D7] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent transition"
                  placeholder="Re-enter new password"
                  required
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderRadius: '74px',
                  background:
                    'radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), linear-gradient(90deg, #700333 0%, #E81116 100%)',
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '15px',
                }}
              >
                {loading ? 'Updating password...' : 'Reset Password & Continue'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
