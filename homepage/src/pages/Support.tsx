import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, AlertCircle, CheckCircle, Upload, X, MessageSquare, Info, User, Key, ArrowLeft, Sparkles, LifeBuoy, HelpCircle } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';

export default function Support() {
  const { user, token, login } = useAuth();
  const [searchParams] = useSearchParams();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'guest'>('login');
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [guestForm, setGuestForm] = useState({ email: '', name: '' });
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestInfo, setGuestInfo] = useState({ email: '', name: '' });

  const [formData, setFormData] = useState({
    type: 'bug' as 'bug' | 'suggestion' | 'infrastructure' | 'csam' | 'other',
    subject: '',
    description: ''
  });
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loginError, setLoginError] = useState('');

  // If user is not logged in on initial load and hasn't selected guest mode, open modal
  useEffect(() => {
    if (!user && !isGuestMode) {
      setShowLoginModal(true);
    }
  }, [user, isGuestMode]);

  const handleSupportLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (authTab === 'login') {
      if (!loginForm.identifier || !loginForm.password) {
        setLoginError('Please enter both username/email and your password.');
        return;
      }
      setIsLoggingIn(true);
      try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: loginForm.identifier,
            password: loginForm.password,
            provider: 'local'
          })
        });
        const data = await response.json();
        if (response.ok && data.ok) {
          login(data.user, data.token, loginForm.password);
          setIsGuestMode(false);
          setShowLoginModal(false);
          setLoginForm({ identifier: '', password: '' });
        } else {
          setLoginError(data.message || 'Invalid credentials. Please verify your password.');
        }
      } catch (err) {
        setLoginError('Network error connecting to login service.');
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      // Guest mode
      if (!guestForm.email || !guestForm.email.includes('@')) {
        setLoginError('Please enter a valid contact email address.');
        return;
      }
      setGuestInfo({ email: guestForm.email.trim(), name: guestForm.name.trim() || 'Visitor' });
      setIsGuestMode(true);
      setShowLoginModal(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf'];
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024; // 10MB limit
    });
    
    if (validFiles.length !== files.length) {
      setSubmitError('Some files were rejected. Only images, videos, and PDFs under 10MB are allowed.');
    }
    
    setMediaFiles([...mediaFiles, ...validFiles].slice(0, 5)); // Max 5 files
  };

  const removeFile = (index: number) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user && !isGuestMode) {
      setShowLoginModal(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const formPayload = new FormData();
      formPayload.append('type', formData.type);
      formPayload.append('subject', formData.subject);
      formPayload.append('description', formData.description);

      if (isGuestMode) {
        formPayload.append('isGuest', 'true');
        formPayload.append('contactEmail', guestInfo.email);
        formPayload.append('guestName', guestInfo.name || 'Visitor');
      } else {
        formPayload.append('username', user?.username || '');
        formPayload.append('userId', user?.userId || '');
      }

      mediaFiles.forEach((file) => {
        formPayload.append('media', file);
      });

      const response = await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formPayload
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setSubmitSuccess(true);
        setFormData({ type: 'bug', subject: '', description: '' });
        setMediaFiles([]);
      } else {
        setSubmitError(data.message || 'Failed to submit ticket');
      }
    } catch (error) {
      setSubmitError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-x-hidden font-sans py-10 px-4 sm:px-6">
      {/* 3D Iridescent Soap Bubbles */}
      <div className="frutiger-bubble-realistic w-32 h-32 top-10 left-[6%] opacity-40 animate-float pointer-events-none" />
      <div className="frutiger-bubble-realistic w-44 h-44 top-80 right-[5%] opacity-35 animate-float pointer-events-none" style={{ animationDelay: '-4s' }} />
      <div className="frutiger-bubble-realistic w-20 h-20 bottom-24 left-[14%] opacity-30 animate-float pointer-events-none" style={{ animationDelay: '-7s' }} />

      {/* Top Navigation */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 shadow-md text-xs font-bold text-slate-200 hover:bg-slate-750 hover:scale-105 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
          Back to Space
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Link
              to={`/my-tickets?username=${encodeURIComponent(user.username)}&userId=${encodeURIComponent(user.userId)}`}
              className="frutiger-badge-retro text-[10px] px-3 py-1 rounded-full uppercase flex items-center gap-1.5"
            >
              <MessageSquare className="w-3 h-3 text-sky-400" /> My Tickets
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="frutiger-badge-retro text-[10px] px-3 py-1 rounded-full uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <User className="w-3 h-3 text-sky-400" /> Sign In / Visitor
            </button>
          )}
        </div>
      </div>

      {/* Secure Authentication & Verification Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowLoginModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md frutiger-window shadow-2xl overflow-hidden"
            >
              <div className="frutiger-window-titlebar px-4 py-2 flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-xs text-white">
                    Support Ticket Verification
                  </span>
                </div>
                <button type="button" onClick={() => setShowLoginModal(false)} className="frutiger-window-dot bg-rose-500 border border-rose-400 cursor-pointer" />
              </div>

              <div className="p-6 bg-slate-900 text-slate-100 space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-bold tracking-tight text-white">Identity Verification</h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Connect tickets to your Space account securely to prevent impersonation
                  </p>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex rounded-xl bg-slate-800 p-1 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => { setAuthTab('login'); setLoginError(''); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      authTab === 'login'
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sign In to Space
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthTab('guest'); setLoginError(''); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      authTab === 'guest'
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Submit as Visitor
                  </button>
                </div>

                {loginError && (
                  <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold text-center">
                    {loginError}
                  </div>
                )}

                {authTab === 'login' ? (
                  <form onSubmit={handleSupportLogin} className="space-y-3">
                    <div className="rounded-xl bg-sky-500/10 border border-sky-500/25 p-3 flex items-start gap-2.5 text-xs text-slate-300">
                      <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Anti-Spoofing Protection:</strong> Signing in with your password proves you own the account, preventing anyone from sending false tickets using your ID.
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Username or Email</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={loginForm.identifier}
                          onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder:text-slate-500"
                          placeholder="Your username or email"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Account Password</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          required
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder:text-slate-500"
                          placeholder="Your account password"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full py-2.5 rounded-xl frutiger-btn frutiger-btn-primary text-white font-bold text-xs shadow-md transition-all mt-2 disabled:opacity-50"
                    >
                      {isLoggingIn ? 'Authenticating...' : 'Sign In & Verify Account'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSupportLogin} className="space-y-3">
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 flex items-start gap-2.5 text-xs text-slate-300">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Account Recovery / Visitor Mode:</strong> Use this if you cannot sign in or don't have an account yet. Visitor tickets do not access private account histories.
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Contact Email</label>
                      <input
                        type="email"
                        required
                        value={guestForm.email}
                        onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder:text-slate-500"
                        placeholder="your@email.com for ticket updates"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Your Name or Alias</label>
                      <input
                        type="text"
                        value={guestForm.name}
                        onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder:text-slate-500"
                        placeholder="Your name (optional)"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all mt-2"
                    >
                      Continue as Visitor
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Aero Support Desk Window */}
      <div className="max-w-3xl mx-auto frutiger-window shadow-2xl">
        {/* Titlebar */}
        <div className="frutiger-window-titlebar px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-xs sm:text-sm tracking-wide text-white">
              Space Help Desk & Ticket Dispatcher
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="frutiger-window-dot bg-amber-400 border border-amber-300 cursor-pointer" title="Minimize" />
            <span className="frutiger-window-dot bg-emerald-400 border border-emerald-300 cursor-pointer" title="Maximize" />
            <Link to="/" className="frutiger-window-dot bg-rose-500 border border-rose-400 cursor-pointer" title="Close" />
          </div>
        </div>

        {/* Window Body */}
        <div className="p-6 sm:p-8 space-y-6 bg-slate-900">
          {submitSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-md">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Ticket Successfully Logged!</h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed font-medium">
                Your support request has been queued in our ticket dispatcher. Our moderation and engineering team will review it promptly.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center max-w-sm mx-auto">
                {user && (
                  <Link
                    to={`/my-tickets?username=${encodeURIComponent(user.username)}&userId=${encodeURIComponent(user.userId)}`}
                    className="px-5 py-2.5 rounded-xl frutiger-btn frutiger-btn-primary text-white font-bold text-xs shadow-md"
                  >
                    View My Tickets
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 border border-slate-700"
                >
                  Submit Another Ticket
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header Info */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/40 text-xs font-bold text-sky-300">
                  <Sparkles className="w-3.5 h-3.5" /> Direct Community Support
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  How Can We Help You?
                </h1>
                <p className="text-xs text-slate-300 max-w-md mx-auto font-medium">
                  Submit a bug report, request an aesthetic theme, or report platform misconduct.
                </p>
                {user ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-semibold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Verified Account:</span>
                    <strong className="text-sky-400">@{user.username}</strong>
                    <span className="text-slate-400 font-mono text-[10px]">({user.userId})</span>
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className="ml-1 text-[10px] text-sky-400 hover:underline"
                    >
                      (Switch)
                    </button>
                  </div>
                ) : isGuestMode ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-semibold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Visitor Request:</span>
                    <strong className="text-amber-400">{guestInfo.name}</strong>
                    <span className="text-slate-400 text-[10px]">({guestInfo.email})</span>
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className="ml-1 text-[10px] text-sky-400 hover:underline"
                    >
                      (Log In Instead)
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-semibold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>Unverified Session</span>
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className="ml-1 text-[10px] text-sky-400 underline font-bold"
                    >
                      Sign In or Continue as Visitor
                    </button>
                  </div>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Ticket Category
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400 font-medium"
                    required
                  >
                    <option value="bug">Bug Report (UI glitch, call dropped, error)</option>
                    <option value="suggestion">Feature or Theme Suggestion</option>
                    <option value="infrastructure">Infrastructure & Connection Latency</option>
                    <option value="csam">Safety / Zero-Tolerance Abuse Report</option>
                    <option value="other">General Question</option>
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400 font-medium placeholder:text-slate-500"
                    placeholder="Brief summary of your issue or feedback"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Description & Steps to Reproduce
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400 min-h-[120px] leading-relaxed font-medium placeholder:text-slate-500"
                    placeholder="Please include details, what browser/device you're using, and steps taken..."
                    required
                  />
                </div>

                {/* Media Attachments */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Screenshots & Attachments (Optional)
                  </label>
                  <div className="border border-dashed border-slate-700 rounded-xl p-5 text-center bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer shadow-xs">
                    <input
                      type="file"
                      id="media-upload"
                      multiple
                      accept="image/*,video/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="media-upload" className="cursor-pointer flex flex-col items-center gap-1">
                      <Upload className="w-5 h-5 text-sky-400" />
                      <span className="text-xs font-semibold text-white">Click to attach files</span>
                      <span className="text-[10px] text-slate-400 font-medium">PNG, JPEG, GIF, MP4 or PDF (up to 5 files, 10MB max each)</span>
                    </label>
                  </div>

                  {mediaFiles.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {mediaFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Paperclip className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span className="truncate text-white font-medium">{file.name}</span>
                            <span className="text-[10px] text-slate-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-rose-400 hover:text-rose-500 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error Banner */}
                {submitError && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl frutiger-btn frutiger-btn-primary text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    'Dispatching Ticket...'
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Ticket
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer (Clean, no green dot or fake telemetry) */}
        <div className="px-5 py-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400 select-none">
          <span>Space Support Desk</span>
          <span className="font-mono text-slate-400">HelpDesk v2.4</span>
        </div>
      </div>
    </div>
  );
}
