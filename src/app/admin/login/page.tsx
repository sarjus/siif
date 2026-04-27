'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function AdminLogin() {
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
      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (authData.user) {
        // Check if this user is a reviewer
        const { data: reviewerRecord } = await supabase
          .from('reviewers')
          .select('id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (reviewerRecord) {
          router.push('/reviewer/dashboard');
        } else {
          router.push('/admin/dashboard');
        }
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#700333] to-[#E81116] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image
              src="/assets/College Logo.png"
              alt="SJCET College Logo"
              width={360}
              height={200}
              className="h-10 w-auto max-w-[180px] object-contain"
              priority
            />
            <Image
              src="/assets/SIIF Logo.png"
              alt="SIIF Logo"
              width={80}
              height={40}
              className="h-10 w-auto max-w-[110px] object-contain"
              priority
            />
          </div>
          <h1 
            className="text-3xl font-bold text-center mb-2"
            style={{
              fontFamily: '"Hanken Grotesk", sans-serif',
              color: '#FF3B3B'
            }}
          >
            SIIF Admin
          </h1>
          <p 
            className="text-center text-gray-600 mb-8"
            style={{
              fontFamily: '"Hanken Grotesk", sans-serif',
              fontSize: '14px'
            }}
          >
            Manage incubation applications
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label 
                className="block mb-2 font-medium"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A'
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="admin@siif.com"
                required
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>

            <div>
              <label 
                className="block mb-2 font-medium"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A'
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="••••••••"
                required
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>

            {error && (
              <div 
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: '#FFE5E5',
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  color: '#D32F2F',
                  fontSize: '14px'
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-white font-bold rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                fontFamily: 'var(--font-hanken-grotesk)',
                borderRadius: '74px',
                background: 'radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), linear-gradient(90deg, #700333 0%, #E81116 100%)'
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p 
            className="text-center mt-6 text-sm"
            style={{
              fontFamily: '"Hanken Grotesk", sans-serif',
              color: '#8A8A8A'
            }}
          >
            Protected admin area. Contact administrator for credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
