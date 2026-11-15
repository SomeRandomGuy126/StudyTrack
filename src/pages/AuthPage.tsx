import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Mail, Lock, ArrowRight, BookOpen, Brain, Calendar } from 'lucide-react';

type Props = {
  mode: 'login' | 'signup' | 'reset';
  setMode: (m: 'login' | 'signup' | 'reset') => void;
};

export function AuthPage({ mode, setMode }: Props) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else if (mode === 'signup') {
      const { error } = await signUp(email, password);
      if (error) setError(error);
      else setSuccess('Account created! Check your email or sign in if confirmation is off.');
    } else {
      const { error } = await resetPassword(email);
      if (error) setError(error);
      else setSuccess('Password reset link sent to your email.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-brand-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <GraduationCap size={28} />
            </div>
            <span className="text-2xl font-bold">StudyTrack</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Your AI-powered<br />study companion
          </h1>
          <p className="text-brand-100 text-lg mb-12 max-w-md">
            Organise subjects, track study sessions, automate revision with spaced repetition, and learn faster with AI.
          </p>
          <div className="space-y-4 max-w-md">
            {[
              { icon: BookOpen, text: 'Track every topic across all your subjects' },
              { icon: Brain, text: 'AI-powered spaced repetition knows what to revise' },
              { icon: Calendar, text: 'Plan your week with a unified calendar' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-brand-50">
                <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon size={20} />
                </div>
                <span className="text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white">
              <GraduationCap size={22} />
            </div>
            <span className="text-xl font-bold text-primary">StudyTrack</span>
          </div>

          <h2 className="text-2xl font-bold text-primary mb-2">
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'}
          </h2>
          <p className="text-secondary text-sm mb-8">
            {mode === 'login'
              ? 'Sign in to continue your study journey'
              : mode === 'signup'
              ? 'Start organising your education today'
              : 'Enter your email to receive a reset link'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-60">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-secondary">
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('reset')} className="text-brand-600 hover:underline mr-3">
                  Forgot password?
                </button>
                <span>Don't have an account? </span>
                <button onClick={() => setMode('signup')} className="text-brand-600 hover:underline font-medium">
                  Sign up
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>
                <span>Already have an account? </span>
                <button onClick={() => setMode('login')} className="text-brand-600 hover:underline font-medium">
                  Sign in
                </button>
              </>
            )}
            {mode === 'reset' && (
              <button onClick={() => setMode('login')} className="text-brand-600 hover:underline font-medium">
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
