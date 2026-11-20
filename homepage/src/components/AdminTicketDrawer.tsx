import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CheckCircle, 
  Clock, 
  Tag, 
  RefreshCw, 
  AlertTriangle, 
  User, 
  Mail, 
  Copy, 
  Check, 
  Send, 
  Paperclip, 
  ExternalLink, 
  MessageSquare, 
  ShieldCheck,
  Calendar,
  Sparkles
} from 'lucide-react';
import { API_BASE } from '../config';

export interface TicketNote {
  type: 'update' | 'done' | 'info' | 'claim';
  content: string;
  author: string;
  timestamp: string | Date;
}

export interface AdminTicket {
  _id: string;
  userId: string;
  username: string;
  isGuest?: boolean;
  contactEmail?: string;
  category: string;
  priority: string;
  type: string;
  subject: string;
  description: string;
  mediaUrls?: string[];
  status: string;
  claimedBy?: string;
  notes: TicketNote[];
  createdAt: string;
  updatedAt?: string;
}

interface AdminTicketDrawerProps {
  ticket: AdminTicket;
  onClose: () => void;
  onRefresh: () => void;
}

export default function AdminTicketDrawer({ ticket, onClose, onRefresh }: AdminTicketDrawerProps) {
  const [currentTicket, setCurrentTicket] = useState<AdminTicket>(ticket);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyType, setReplyType] = useState<'update' | 'info' | 'done'>('update');
  const [newStatus, setNewStatus] = useState<string>(ticket.status);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const adminToken = localStorage.getItem('admin_token');
  const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{"username":"omg"}');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const showNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Claim or Unclaim Ticket
  const handleClaimTicket = async () => {
    setIsClaiming(true);
    try {
      const response = await fetch(`${API_BASE}/api/tickets/${currentTicket._id}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      });
      const data = await response.json();
      if (data.ok && data.ticket) {
        setCurrentTicket(data.ticket);
        showNotification(`Ticket claimed by @${adminUser.username}`);
        onRefresh();
      } else {
        alert(data.message || 'Failed to claim ticket');
      }
    } catch (err) {
      alert('Network error while claiming ticket');
    } finally {
      setIsClaiming(false);
    }
  };

  // Update Status or Priority
  const handleStatusChange = async (targetStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`${API_BASE}/api/tickets/${currentTicket._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await response.json();
      if (data.ok && data.ticket) {
        setCurrentTicket(data.ticket);
        setNewStatus(data.ticket.status);
        showNotification(`Ticket status updated to ${targetStatus}`);
        onRefresh();
      } else {
        alert(data.message || 'Failed to update status');
      }
    } catch (err) {
      alert('Network error while updating status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Send Reply / Note to Ticket
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    setIsSubmittingReply(true);
    try {
      const response = await fetch(`${API_BASE}/api/tickets/${currentTicket._id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          type: replyType,
          content: replyMessage.trim(),
          status: newStatus !== currentTicket.status ? newStatus : undefined
        })
      });
      const data = await response.json();
      if (data.ok && data.ticket) {
        setCurrentTicket(data.ticket);
        setReplyMessage('');
        showNotification('Response sent to user ticket successfully');
        onRefresh();
      } else {
        alert(data.message || 'Failed to send note');
      }
    } catch (err) {
      alert('Network error while sending response');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'high': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'medium': return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'low': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default: return 'bg-slate-700/40 text-slate-300 border-slate-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return { label: 'Open • Needs Review', style: 'bg-blue-500/20 text-blue-300 border-blue-400/40', icon: Clock };
      case 'claimed':
        return { label: 'Claimed', style: 'bg-purple-500/20 text-purple-300 border-purple-400/40', icon: Tag };
      case 'in_progress':
        return { label: 'In Progress', style: 'bg-amber-500/20 text-amber-300 border-amber-400/40', icon: RefreshCw };
      case 'done':
      case 'closed':
        return { label: 'Resolved', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40', icon: CheckCircle };
      default:
        return { label: status, style: 'bg-slate-700/40 text-slate-300 border-slate-600', icon: AlertTriangle };
    }
  };

  const statusMeta = getStatusBadge(currentTicket.status);
  const StatusIcon = statusMeta.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[150] bg-slate-950/75 backdrop-blur-md"
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl z-[160] overflow-y-auto bg-slate-900 border-l border-cyan-400/30 shadow-2xl flex flex-col text-slate-100"
      >
        {/* Aero Window Titlebar */}
        <div className="frutiger-window-titlebar flex items-center justify-between px-5 py-3 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-300/60 shadow-sm" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-300/60 shadow-sm" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-300/60 shadow-sm" />
            <span className="text-xs font-bold text-sky-100 ml-2">
              Support Desk Operator • Ticket #{currentTicket._id.slice(-8).toUpperCase()}
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
          {/* Notification Banner */}
          {actionSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{actionSuccess}</span>
            </motion.div>
          )}

          {/* Ticket Header & Author Identity */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider flex items-center gap-1 ${statusMeta.style}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusMeta.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getPriorityStyle(currentTicket.priority)}`}>
                    {currentTicket.priority} Priority
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                    {currentTicket.category} • {currentTicket.type}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mt-2 leading-snug">
                  {currentTicket.subject}
                </h2>
              </div>

              {/* Claim Action */}
              <div>
                {currentTicket.claimedBy ? (
                  <div className="px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-400/40 text-xs text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Claimed Operator</span>
                    <span className="font-bold text-cyan-300">@{currentTicket.claimedBy}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isClaiming}
                    onClick={handleClaimTicket}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-b from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 border-t border-sky-200/50 shadow-md shadow-sky-500/20 transition-all flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>{isClaiming ? 'Claiming...' : 'Claim Ticket'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Author Breakdown */}
            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Username */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center font-bold text-cyan-200 text-xs shrink-0">
                  {currentTicket.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Author</span>
                  <span className="font-bold text-white truncate block">@{currentTicket.username}</span>
                </div>
              </div>

              {/* User ID */}
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">User ID</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-cyan-300 text-[11px] truncate">{currentTicket.userId}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentTicket.userId, 'drawer-user-id')}
                    className="text-slate-400 hover:text-white"
                    title="Copy User ID"
                  >
                    {copiedKey === 'drawer-user-id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Contact Email / Timestamp */}
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Submitted</span>
                <span className="text-slate-300 font-mono text-[11px] block">
                  {new Date(currentTicket.createdAt).toLocaleDateString()} {new Date(currentTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {currentTicket.contactEmail && (
                  <span className="text-slate-400 text-[11px] truncate block">{currentTicket.contactEmail}</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Status Controller Bar */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isUpdatingStatus ? 'animate-spin' : ''}`} />
              Update Status:
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'open', label: 'Open' },
                { id: 'claimed', label: 'Claimed' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'done', label: 'Done / Resolved' },
                { id: 'closed', label: 'Closed' }
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  disabled={isUpdatingStatus || currentTicket.status === st.id}
                  onClick={() => handleStatusChange(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                    currentTicket.status === st.id
                      ? 'bg-cyan-500 text-slate-950 shadow-sm cursor-default'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Issue Narrative / Description */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Issue Narrative / User Description
            </h4>
            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
              {currentTicket.description}
            </div>
          </div>

          {/* Uploaded Attachments */}
          {currentTicket.mediaUrls && currentTicket.mediaUrls.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                Attachments ({currentTicket.mediaUrls.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {currentTicket.mediaUrls.map((url, idx) => {
                  const isImg = url.match(/\.(jpeg|jpg|png|gif|webp)$/i);
                  return (
                    <a
                      key={idx}
                      href={`${API_BASE}${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400/40 flex items-center gap-2 group transition-all"
                    >
                      {isImg ? (
                        <img
                          src={`${API_BASE}${url}`}
                          alt="Attachment"
                          className="w-10 h-10 object-cover rounded-lg border border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-cyan-950/40 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
                          <Paperclip className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-slate-200 group-hover:text-cyan-300 font-medium block truncate">
                          Attachment {idx + 1}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span>Inspect</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Communication & Audit Notes Timeline */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                Communication Notes History ({currentTicket.notes?.length || 0})
              </h4>
            </div>

            {currentTicket.notes && currentTicket.notes.length > 0 ? (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {currentTicket.notes.map((note, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      note.type === 'done'
                        ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-100'
                        : note.type === 'claim'
                        ? 'bg-blue-950/25 border-blue-500/40 text-blue-100'
                        : note.type === 'info'
                        ? 'bg-amber-950/25 border-amber-500/40 text-amber-100'
                        : 'bg-slate-900 border-slate-700/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between opacity-80 text-[10px] font-mono">
                      <span className="font-bold uppercase tracking-wider text-cyan-400">
                        {note.type} • @{note.author}
                      </span>
                      <span>{new Date(note.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="font-sans leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400 italic">
                No communication updates posted yet. Use the composer below to reply directly to the sender.
              </div>
            )}
          </div>

          {/* Direct Response / Reply Composer */}
          <form onSubmit={handleSendReply} className="p-4 rounded-xl bg-slate-950/80 border border-cyan-400/30 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-cyan-400" />
                Reply to Ticket Sender (@{currentTicket.username})
              </h4>

              {/* Message Type Selector */}
              <div className="flex items-center gap-1">
                {(['update', 'info', 'done'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setReplyType(t);
                      if (t === 'done') setNewStatus('done');
                      if (t === 'update' && currentTicket.status === 'open') setNewStatus('in_progress');
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                      replyType === t
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t === 'done' ? 'Resolve' : t}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder={`Write response or update to @${currentTicket.username}...`}
              className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors font-sans"
              required
            />

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Next Status:</span>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs font-medium focus:outline-none focus:border-cyan-400"
                >
                  <option value="open">Keep Open</option>
                  <option value="in_progress">Set In Progress</option>
                  <option value="done">Mark Done</option>
                  <option value="closed">Close Ticket</option>
                </select>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmittingReply || !replyMessage.trim()}
                className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-b from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 border-t border-sky-200/50 shadow-md shadow-sky-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingReply ? 'Sending Note...' : 'Send Communication'}</span>
              </motion.button>
            </div>
          </form>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
