import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthPage } from '@/pages/AuthPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { AppShell } from '@/components/AppShell';

function AppRoutes() {
  const { user, profile, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full border-2 border-brand-500 border-t-transparent w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage mode={authMode} setMode={setAuthMode} />;
  }

  if (profile && !profile.onboarded) {
    return <OnboardingPage />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
