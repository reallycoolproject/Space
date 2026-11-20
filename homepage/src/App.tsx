import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { CheckCircle2, X, Lock, ShieldAlert } from 'lucide-react';
import Dashboard from './components/Dashboard';
import FrutigerHomepage from './components/FrutigerHomepage';
import { ErrorBoundary } from './components/ErrorBoundary';
import OnboardingModal from './components/OnboardingModal';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoute from './components/AdminRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useThemeCustomization } from './contexts/ThemeContext';
import { PainterMode } from './components/theme/PainterMode';
import { API_BASE } from './config';
import QA from './pages/QA';
import MoreInfo from './pages/MoreInfo';
import Docs from './pages/Docs';
import Contact from './pages/Contact';
import Support from './pages/Support';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import MyTickets from './pages/MyTickets';
import ModeratorLogin from './pages/ModeratorLogin';
import ModeratorDashboard from './pages/ModeratorDashboard';
import CallPage from './pages/CallPage';

function App() {
  const { login, user, isAuthenticated, isLoading } = useAuth();
  const [activeModal, setActiveModal] = useState<'auth' | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthSubmitting(true);
    try {
      const endpoint = authMode === 'signin' ? '/api/auth/login' : '/api/auth/signup';
      const payload = authMode === 'signin'
        ? { identifier: email, password, provider: 'local' }
        : { email, username: authMode === 'register' ? username : undefined, password, provider: 'local' };

      console.log('Auth request:', { endpoint, payload, API_BASE });

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('Auth response status:', response.status);
      const data = await response.json();
      console.log('Auth response data:', data);

      if (data.ok) {
        login(data.user, data.token, password);
        setActiveModal(null);
        // Preserve the selected theme or use the Frutiger Metro default.
        if (!localStorage.getItem('theme')) {
          document.documentElement.setAttribute('data-theme', 'frutiger-metro');
          localStorage.setItem('theme', 'frutiger-metro');
        } else {
          document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'frutiger-metro');
        }
      } else {
        setAuthError(data.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth failed:', error);
      setAuthError('Network error. Please try again.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleOnboardingComplete = async (displayName: string, avatar?: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/auth/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ displayName, avatar })
      });

      const data = await response.json();
      if (data.ok) {
        login(data.user, token);
      }
    } catch (error) {
      console.error('Onboarding failed:', error);
      throw error;
    }
  };

  const checkUsernameAvailability = async (val: string) => {
    if (val.length < 3) { setUsernameAvailable(null); return; }
    try {
      const response = await fetch(`${API_BASE}/api/auth/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: val })
      });
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch { setUsernameAvailable(null); }
  };

  const checkEmailAvailability = async (val: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) { setEmailAvailable(null); return; }
    try {
      const response = await fetch(`${API_BASE}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: val })
      });
      const data = await response.json();
      setEmailAvailable(data.available);
    } catch { setEmailAvailable(null); }
  };

  const evaluatePasswordStrength = (pass: string) => {
    let strength = 0;
    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[0-9]/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;
    if (strength <= 1) setPasswordStrength('weak');
    else if (strength <= 2) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  };

  const showOnboarding = Boolean(isAuthenticated && user && !user.hasCompletedOnboarding && !user.displayName);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full border-4 animate-spin"
            style={{ borderColor: 'var(--app-accent)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Loading Space…</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !showOnboarding) {
    return (
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    );
  }

  return (
    <>
      {showOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}

      {!isAuthenticated && (
        <FrutigerHomepage
          onSignIn={() => { setAuthMode('signin'); setActiveModal('auth'); }}
          onSignUp={() => { setAuthMode('register'); setActiveModal('auth'); }}
        />
      )}

      {/* ── Auth Modal ── */}
      <AnimatePresence>
        {activeModal === 'auth' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40"
              onClick={() => setActiveModal(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-7 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button type="button" onClick={() => setActiveModal(null)} aria-label="Close sign-in" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                  {authMode === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {authMode === 'signin' ? 'Sign in to continue to your conversations.' : 'Set up your private Space account.'}
                </p>
              </div>

              {authError && (
                <div role="alert" className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-300">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Username</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          checkUsernameAvailability(e.target.value);
                        }}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-input)] px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/40 placeholder-[var(--text-secondary)]/60"
                        placeholder="your_username"
                      />
                      {username.length >= 3 && usernameAvailable !== null && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          {usernameAvailable === true ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">Taken</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    {authMode === 'signin' ? 'Username or Email' : 'Email'}
                  </label>
                  <div className="relative">
                    <input
                      type={authMode === 'signin' ? "text" : "email"}
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (authMode === 'register') checkEmailAvailability(e.target.value);
                      }}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-input)] px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/40 placeholder-[var(--text-secondary)]/60"
                      placeholder={authMode === 'signin' ? 'username or email' : 'you@example.com'}
                    />
                    {authMode === 'register' && email.length > 3 && emailAvailable !== null && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {emailAvailable === true ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">Taken / Invalid</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (authMode === 'register') evaluatePasswordStrength(e.target.value);
                    }}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-input)] px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/40 placeholder-[var(--text-secondary)]/60"
                    placeholder="••••••••"
                  />
                  {authMode === 'register' && password.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      <div className={`h-1.5 flex-1 rounded-full ${passwordStrength === 'weak' ? 'bg-red-500' : passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                      <div className={`h-1.5 flex-1 rounded-full ${passwordStrength === 'medium' || passwordStrength === 'strong' ? (passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500') : 'bg-[#8B4513]/20'}`} />
                      <div className={`h-1.5 flex-1 rounded-full ${passwordStrength === 'strong' ? 'bg-green-500' : 'bg-[#8B4513]/20'}`} />
                    </div>
                  )}
                </div>

                {authMode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Confirm Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full bg-[var(--bg-input)] border text-[var(--text-input)] px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/40 placeholder-[var(--text-secondary)]/60 ${
                        confirmPassword.length > 0 && confirmPassword !== password 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-[var(--border-input)]'
                      }`}
                      placeholder="••••••••"
                    />
                    {confirmPassword.length > 0 && confirmPassword !== password && (
                      <p className="text-red-500 text-xs font-bold mt-2">Passwords do not match</p>
                    )}
                  </div>
                )}

                {authMode === 'register' && (
                  <div className="mt-3.5 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="terms-checkbox"
                      required
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--border-input)] accent-[var(--app-accent)] cursor-pointer"
                    />
                    <label htmlFor="terms-checkbox" className="text-xs text-[var(--text-secondary)] leading-relaxed select-none cursor-pointer">
                      I have read and agree to the{' '}
                      <Link to="/terms" target="_blank" className="text-[var(--app-accent)] font-semibold underline hover:text-[var(--app-accent-hover)]">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" target="_blank" className="text-[var(--app-accent)] font-semibold underline hover:text-[var(--app-accent-hover)]">
                        Privacy Policy
                      </Link>.
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAuthSubmitting || (authMode === 'register' && (usernameAvailable === false || emailAvailable === false || passwordStrength === 'weak' || password !== confirmPassword || !agreedToTerms))}
                  className="w-full py-3 mt-5 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[#10201d] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAuthSubmitting ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'signin' ? 'register' : 'signin');
                    setUsername('');
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                    setAuthError('');
                  }}
                  className="text-[var(--app-accent)] font-medium hover:underline text-sm"
                >
                  {authMode === 'signin' ? 'Need an account? Register' : 'Already have an account? Log in'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Insecure HTTP Warning on non-localhost */}
      {typeof window !== 'undefined' && !window.crypto?.subtle && window.location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(window.location.hostname) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-[var(--text-primary)]">HTTPS Required for Phone</h2>
            <p className="mb-5 text-sm text-[var(--text-secondary)] leading-relaxed">
              Mobile browsers (Safari & Chrome) disable encryption keys and microphones over plain HTTP (<code className="text-xs bg-black/30 px-1 py-0.5 rounded text-amber-300">http://...</code>).
              <br /><br />
              Tap below to switch to the secure HTTPS link where encryption and voice recording are fully enabled:
            </p>
            <a
              href={`https://${typeof window !== 'undefined' ? window.location.hostname : '192.168.1.3'}:5174`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl frutiger-btn frutiger-btn-primary py-3 text-sm font-bold text-white shadow-lg"
            >
              <Lock className="w-4 h-4" /> Open via Fast Local Wi-Fi (HTTPS)
            </a>
          </div>
        </div>
      )}
    </>
  );
}

function AppRouteContent() {
  return (
    <>
      <PainterMode />
      <div className="h-full w-full">
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/call" element={<CallPage />} />
          <Route path="/qa" element={<QA />} />
          <Route path="/more-info" element={<MoreInfo />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/support" element={<Support />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/my-tickets" element={<MyTickets />} />
          <Route path="/moderator/login" element={<ModeratorLogin />} />
          <Route path="/moderator/dashboard" element={<ModeratorDashboard />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Routes>
      </div>
    </>
  );
}

export default function AppWrapper() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppRouteContent />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
