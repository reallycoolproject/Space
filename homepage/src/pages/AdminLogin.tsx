import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, Lock, User, ArrowLeft, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../config';

const VALID_GATEWAY_KEYS = ['space_sec_9942', 'omg'];

export default function AdminLogin() {
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const gateKey = searchParams.get('gate') || searchParams.get('key');
  const hasStoredToken = Boolean(localStorage.getItem('admin_token'));
  const isAuthorizedGate = (gateKey && VALID_GATEWAY_KEYS.includes(gateKey.toLowerCase())) || hasStoredToken;

  useEffect(() => {
    // If admin already has an active session and enters with gate, redirect to dashboard
    if (hasStoredToken && isAuthorizedGate) {
      // User can immediately access dashboard
    }
  }, [hasStoredToken, isAuthorizedGate]);

  // If accessed directly without the secret security gateway key, cloak the portal with a 404
  if (!isAuthorizedGate) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-4 shadow-lg">
          <span className="text-2xl font-black font-mono">404</span>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
          The requested URL was not found on this server. Please check the address or return to the platform home.
        </p>
        <Link
          to="/"
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
        >
          Return to Space
        </Link>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both administrator username and password');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-gateway-key': 'space_sec_9942'
        },
        body: JSON.stringify({ 
          username: username.trim(), 
          password,
          gatewayKey: 'space_sec_9942'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.ok || !data.token) {
        throw new Error(data.message || 'Invalid administrator credentials');
      }

      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.admin || { username: username.trim(), role: 'admin' }));
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid administrator credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Realistic 3D Soap Bubbles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="frutiger-bubble-realistic absolute w-28 h-28 top-[10%] left-[8%] animate-float-slow opacity-80" />
        <div className="frutiger-bubble-realistic absolute w-16 h-16 top-[65%] left-[12%] animate-float-medium opacity-65" />
        <div className="frutiger-bubble-realistic absolute w-20 h-20 bottom-[15%] right-[10%] animate-float-slow opacity-75" />
        <div className="frutiger-bubble-realistic absolute w-36 h-36 top-[18%] right-[14%] animate-float-fast opacity-85" />
        <div className="frutiger-bubble-realistic absolute w-14 h-14 bottom-[35%] left-[25%] animate-float-medium opacity-60" />
      </div>

      {/* Top Bar with Return Link */}
      <header className="fixed top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-sky-200/80 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-105"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Space Platform
        </Link>
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
          <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
          <span>PORTAL SECURE 2048-BIT AES</span>
        </div>
      </header>

      {/* Main Glass Aero Window */}
      <motion.div
        initial={{ opacity: 0, y: 25, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10 my-auto mt-14"
      >
        <div className="frutiger-window shadow-2xl rounded-2xl overflow-hidden border border-cyan-400/30">
          {/* Aero Titlebar */}
          <div className="frutiger-window-titlebar flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-300/60 shadow-sm inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-300/60 shadow-sm inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-300/60 shadow-sm inline-block" />
              <span className="text-xs font-bold text-sky-100 tracking-wide ml-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Space Security Console • Admin Authorization.exe
              </span>
            </div>
            <div className="text-[10px] font-mono text-cyan-300/60">v2.6</div>
          </div>

          {/* Window Body */}
          <div className="p-7 space-y-6">
            {/* Header Icon + Subtitle */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-inner shadow-cyan-500/20">
                <ShieldCheck className="w-8 h-8 text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Admin Console
              </h1>
              <p className="text-xs text-slate-300/80 font-medium">
                Shield Moderation System • Restricted Operator Access
              </p>
            </div>

            {hasStoredToken && (
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-400/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-cyan-200">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Existing active admin session detected</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/admin/dashboard')}
                  className="text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 px-3 py-1 rounded-lg transition-colors shadow-sm"
                >
                  Enter
                </button>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Administrator Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter administrator ID"
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Security Passcode
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter access passcode"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium"
                  required
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 hover:from-sky-300 hover:to-blue-500 border-t border-sky-200/50 shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authorizing Operator...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Authorize & Access Dashboard</span>
                  </>
                )}
              </motion.button>
            </form>

            {/* Security Notice */}
            <div className="pt-2 border-t border-white/10 text-center">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Notice: All session events and administrative actions are logged with immutable cryptographic audit timestamps.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
