'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ReviewerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (authData.user) {
        // Verify this user is a reviewer
        const { data: reviewerRecord } = await supabase
          .from('reviewers')
          .select('id, is_active')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (!reviewerRecord) {
          await supabase.auth.signOut();
          setError('Access denied. This account is not registered as a reviewer.');
          return;
        }

        if (!reviewerRecord.is_active) {
          await supabase.auth.signOut();
          setError('Your reviewer account has been deactivated. Please contact the admin.');
          return;
        }

        router.push('/reviewer/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: '#FF3B3B' }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <h1
            className="text-3xl font-bold text-white mb-1"
            style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}
          >
            Reviewer Portal
          </h1>
          <p
            className="text-sm"
            style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#94A3B8' }}
          >
            SIIF Incubation Application Review
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2
            className="text-xl font-bold mb-6"
            style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#1a1a2e' }}
          >
            Sign in to your account
          </h2>

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
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent transition"
                placeholder="reviewer@example.com"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent transition"
                placeholder="••••••••"
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
                backgroundColor: '#FF3B3B',
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '15px',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '12px',
                color: '#8A8A8A',
              }}
            >
              Are you an admin?{' '}
              <a
                href="/admin/login"
                style={{ color: '#FF3B3B', fontWeight: 600 }}
                className="hover:underline"
              >
                Admin Login →
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
