import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Ban, XCircle, CheckCircle2, User, Calendar, FileText, Copy, Check } from 'lucide-react';
import { API_BASE } from '../config';

interface Report {
  _id: string;
  reporter: {
    username: string;
    displayName?: string;
    avatar?: string;
    userId: string;
  };
  reportedUser: {
    username: string;
    displayName?: string;
    avatar?: string;
    userId: string;
  };
  reason: string;
  details: string;
  chatTranscript: any[];
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: Date;
}

interface ReportInspectionDrawerProps {
  report: Report;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function ReportInspectionDrawer({ report, onClose, onRefresh }: ReportInspectionDrawerProps) {
  const [isBanning, setIsBanning] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, idKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBanUser = async () => {
    const confirmed = confirm(
      `Are you sure you want to PERMANENTLY BAN ${report.reportedUser.username} (${report.reportedUser.userId}) and blacklist their session?`
    );
    if (!confirmed) return;

    setIsBanning(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/ban-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          userId: report.reportedUser.userId,
          reportId: report._id
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Failed to ban user');
      if (onRefresh) onRefresh();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to ban user');
    } finally {
      setIsBanning(false);
    }
  };

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/reports/${report._id}/dismiss`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Failed to dismiss report');
      if (onRefresh) onRefresh();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to dismiss report');
    } finally {
      setIsDismissing(false);
    }
  };

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/reports/${report._id}/resolve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Failed to resolve report');
      if (onRefresh) onRefresh();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to resolve report');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-md"
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-xl z-[160] overflow-y-auto bg-slate-900 border-l border-cyan-400/30 shadow-2xl flex flex-col text-slate-100"
      >
        {/* Aero Window Titlebar */}
        <div className="frutiger-window-titlebar flex items-center justify-between px-5 py-3 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-300/60 shadow-sm" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-300/60 shadow-sm" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-300/60 shadow-sm" />
            <span className="text-xs font-bold text-sky-100 ml-2">
              Case Inspector • #{report._id.slice(-8).toUpperCase()}
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Top Summary Banner */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold tracking-wider text-cyan-400 uppercase">Violation Category</div>
              <h3 className="text-lg font-black text-white mt-0.5">{report.reason}</h3>
              <p className="text-xs text-slate-400 mt-1">Submitted {new Date(report.createdAt).toLocaleString()}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                report.status === 'pending'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                  : report.status === 'resolved'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : 'bg-slate-700/40 text-slate-300 border-slate-600'
              }`}
            >
              {report.status}
            </span>
          </div>

          {/* Reported User & Reporter Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reported User */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                <Ban className="w-3.5 h-3.5" />
                Reported Offender
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-600/30 border border-rose-400/40 flex items-center justify-center font-bold text-rose-200">
                  {report.reportedUser.username[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-sm truncate">
                    {report.reportedUser.displayName || report.reportedUser.username}
                  </p>
                  <p className="text-xs text-rose-300/80">@{report.reportedUser.username}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px]">ID: {report.reportedUser.userId}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(report.reportedUser.userId, 'reported')}
                  className="p-1 text-slate-300 hover:text-white bg-slate-800/80 rounded border border-slate-700 text-[10px] flex items-center gap-1 px-1.5"
                >
                  {copiedId === 'reported' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedId === 'reported' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Reporter */}
            <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <User className="w-3.5 h-3.5" />
                Reporting User
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center font-bold text-cyan-200">
                  {report.reporter.username[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-sm truncate">
                    {report.reporter.displayName || report.reporter.username}
                  </p>
                  <p className="text-xs text-cyan-300/80">@{report.reporter.username}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-cyan-500/20 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px]">ID: {report.reporter.userId}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(report.reporter.userId, 'reporter')}
                  className="p-1 text-slate-300 hover:text-white bg-slate-800/80 rounded border border-slate-700 text-[10px] flex items-center gap-1 px-1.5"
                >
                  {copiedId === 'reporter' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedId === 'reporter' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Details & Statement */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/80 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Incident Narrative / Reporter Statement
            </h4>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-slate-900/50 p-3 rounded-lg border border-slate-800">
              {report.details || 'No additional written narrative provided by reporter.'}
            </p>
          </div>

          {/* Chat Transcript / Evidence Section */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Chat Transcript & Telemetry Log
            </h4>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {report.chatTranscript && report.chatTranscript.length > 0 ? (
                report.chatTranscript.map((msg: any, index: number) => {
                  const isOffender = msg.senderId === report.reportedUser.userId;
                  return (
                    <div
                      key={index}
                      className={`p-2.5 rounded-lg text-xs border ${
                        isOffender
                          ? 'bg-rose-950/30 border-rose-500/40 text-rose-100 ml-4'
                          : 'bg-cyan-950/30 border-cyan-500/40 text-cyan-100 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 opacity-75 font-mono text-[10px]">
                        <span>{isOffender ? `@${report.reportedUser.username}` : `@${report.reporter.username}`}</span>
                        <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : 'Log'}</span>
                      </div>
                      <p className="font-sans leading-relaxed">{msg.content || '[Encrypted Content]'}</p>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400 italic">
                  No encrypted chat transcript packets attached to this incident report.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-cyan-400/20 bg-slate-950/80 sticky bottom-0 z-20 space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isDismissing || isBanning || isResolving}
              onClick={handleDismiss}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5 text-slate-400" />
              {isDismissing ? 'Dismissing...' : 'Dismiss False Flag'}
            </button>

            <button
              type="button"
              disabled={isDismissing || isBanning || isResolving}
              onClick={handleResolve}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-emerald-100 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isResolving ? 'Resolving...' : 'Mark Resolved'}
            </button>
          </div>

          <button
            type="button"
            disabled={isDismissing || isBanning || isResolving}
            onClick={handleBanUser}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 border-t border-red-300/40 shadow-lg shadow-rose-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Ban className="w-4 h-4 text-rose-200" />
            {isBanning ? 'Executing Network Ban...' : 'Enforce Account Ban & Blacklist'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
