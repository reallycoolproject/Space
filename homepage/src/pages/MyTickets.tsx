import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Tag, 
  FileText, 
  Calendar, 
  ExternalLink, 
  RefreshCw, 
  ArrowLeft,
  Search,
  Filter,
  Copy,
  Check,
  ShieldCheck,
  Plus,
  Paperclip,
  User,
  HelpCircle,
  Sparkles,
  Inbox
} from 'lucide-react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';

interface Note {
  type: 'update' | 'done' | 'info' | 'claim';
  content: string;
  author: string;
  timestamp: string;
}

interface Ticket {
  _id: string;
  userId: string;
  username: string;
  category: 'major' | 'minor';
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'bug' | 'suggestion' | 'infrastructure' | 'csam' | 'other';
  subject: string;
  description: string;
  mediaUrls: string[];
  status: 'open' | 'claimed' | 'in_progress' | 'done' | 'closed';
  claimedBy?: string;
  notes: Note[];
  createdAt: string;
  updatedAt: string;
}

export default function MyTickets() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState('');
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('username') || searchParams.get('userId')) {
      window.history.replaceState({}, '', '/my-tickets');
    }
  }, [searchParams]);

  useEffect(() => {
    if (user?.userId) {
      loadUserTickets(user.userId);
    } else {
      // Check if user has previously submitted guest ticket or saved IDs in localStorage
      const savedTicketId = localStorage.getItem('last_submitted_ticket_id');
      const savedUserId = localStorage.getItem('last_submitted_user_id');
      if (savedTicketId) {
        trackSingleTicket(savedTicketId);
      } else if (savedUserId) {
        loadUserTickets(savedUserId);
      } else {
        setIsLoading(false);
      }
    }
  }, [user]);

  const loadUserTickets = async (userId: string) => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/api/tickets/user/${userId}`, { headers });
      const data = await response.json();

      if (data.ok && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        if (data.tickets.length > 0 && !selectedTicket) {
          setSelectedTicket(data.tickets[0]);
        }
      } else {
        // Fallback to track endpoint
        const trackRes = await fetch(`${API_BASE}/api/tickets/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const trackData = await trackRes.json();
        if (trackData.ok && Array.isArray(trackData.tickets)) {
          setTickets(trackData.tickets);
          if (trackData.tickets.length > 0 && !selectedTicket) {
            setSelectedTicket(trackData.tickets[0]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  const trackSingleTicket = async (ticketId: string) => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/api/tickets/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
      const data = await response.json();
      if (data.ok && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        if (data.tickets.length > 0) {
          setSelectedTicket(data.tickets[0]);
        }
      }
    } catch (error) {
      console.error('Failed to track ticket:', error);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  const handleManualLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupError('');
    setLookupLoading(true);

    try {
      const query = lookupQuery.trim();
      const response = await fetch(`${API_BASE}/api/tickets/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query.startsWith('guest_') || query.length === 8 ? { userId: query } : { ticketId: query, userId: query })
      });
      const data = await response.json();
      if (data.ok && Array.isArray(data.tickets) && data.tickets.length > 0) {
        setTickets(data.tickets);
        setSelectedTicket(data.tickets[0]);
        setShowLookupModal(false);
      } else {
        setLookupError('No matching support ticket found for this ID');
      }
    } catch (err) {
      setLookupError('Unable to reach support service. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'medium':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'low':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return { label: 'Open • Awaiting Mod', style: 'bg-blue-500/20 text-blue-300 border-blue-400/40', icon: Clock };
      case 'claimed':
        return { label: 'Claimed by Agent', style: 'bg-purple-500/20 text-purple-300 border-purple-400/40', icon: Tag };
      case 'in_progress':
        return { label: 'Under Review', style: 'bg-amber-500/20 text-amber-300 border-amber-400/40', icon: RefreshCw };
      case 'done':
      case 'closed':
        return { label: 'Resolved & Closed', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40', icon: CheckCircle };
      default:
        return { label: status, style: 'bg-slate-700/40 text-slate-300 border-slate-600', icon: AlertTriangle };
    }
  };

  const openTickets = tickets.filter(t => t.status === 'open').length;
  const inProgressTickets = tickets.filter(t => t.status === 'claimed' || t.status === 'in_progress').length;
  const resolvedTickets = tickets.filter(t => t.status === 'done' || t.status === 'closed').length;

  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter || (statusFilter === 'resolved' && (ticket.status === 'done' || ticket.status === 'closed'));
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesSearch = 
      searchQuery === '' ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket._id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-x-hidden font-sans select-none">
      {/* Background ambient radial glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Realistic 3D Soap Bubbles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="frutiger-bubble-realistic absolute w-24 h-24 top-[6%] left-[5%] animate-float-slow opacity-60" />
        <div className="frutiger-bubble-realistic absolute w-16 h-16 top-[35%] right-[5%] animate-float-medium opacity-50" />
        <div className="frutiger-bubble-realistic absolute w-32 h-32 bottom-[12%] left-[10%] animate-float-fast opacity-65" />
        <div className="frutiger-bubble-realistic absolute w-20 h-20 bottom-[25%] right-[18%] animate-float-slow opacity-55" />
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-cyan-400/20 bg-slate-950/80 backdrop-blur-md px-6 py-3.5 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Platform Back Link & Title */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all hover:scale-105"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>Back to Space</span>
            </Link>

            <div className="h-4 w-px bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-black text-white tracking-tight">Support Tickets Matrix</h1>
                <p className="text-[11px] text-slate-400">Track and manage your verified inquiries</p>
              </div>
            </div>
          </div>

          {/* User ID & Actions */}
          <div className="flex items-center gap-3">
            {/* User ID Badge */}
            {user?.userId ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-300 font-medium">My ID:</span>
                <span className="font-mono text-cyan-300 font-bold">{user.userId}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(user.userId, 'my-user-id')}
                  className="hover:text-white ml-1 text-slate-400 hover:text-cyan-300"
                  title="Copy My User ID"
                >
                  {copiedKey === 'my-user-id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLookupModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-cyan-300 font-semibold transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Track by Ticket ID</span>
              </button>
            )}

            {/* Refresh */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => user?.userId && loadUserTickets(user.userId)}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Refresh Tickets"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.button>

            {/* Submit New Ticket */}
            <Link
              to="/support"
              className="py-1.5 px-3.5 rounded-xl text-xs font-bold text-white bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 hover:from-sky-300 hover:to-blue-500 border-t border-sky-200/50 shadow-md shadow-sky-500/25 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Ticket</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6 relative z-10">
        {/* Stats Strip (4 Frutiger Aero Glass Widgets) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="frutiger-window rounded-2xl p-4 border border-cyan-400/30 flex items-center gap-4 shadow-lg">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider">Total Tickets</p>
              <p className="text-2xl font-black text-white mt-0.5">{tickets.length}</p>
            </div>
          </div>

          <div className="frutiger-window rounded-2xl p-4 border border-blue-400/30 flex items-center gap-4 shadow-lg">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider">Awaiting Review</p>
              <p className="text-2xl font-black text-white mt-0.5">{openTickets}</p>
            </div>
          </div>

          <div className="frutiger-window rounded-2xl p-4 border border-amber-400/30 flex items-center gap-4 shadow-lg">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider">In Progress</p>
              <p className="text-2xl font-black text-white mt-0.5">{inProgressTickets}</p>
            </div>
          </div>

          <div className="frutiger-window rounded-2xl p-4 border border-emerald-400/30 flex items-center gap-4 shadow-lg">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider">Resolved</p>
              <p className="text-2xl font-black text-white mt-0.5">{resolvedTickets}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket subject, keywords, ID..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors font-medium"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Status:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Open' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'resolved', label: 'Resolved' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowLookupModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 ml-1"
            >
              <Search className="w-3 h-3" />
              <span>Lookup ID</span>
            </button>
          </div>
        </div>

        {/* Split View: Tickets List & Detailed Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Ticket Feed */}
          <div className="lg:col-span-5 space-y-3">
            {filteredTickets.length === 0 ? (
              <div className="frutiger-window rounded-2xl p-10 border border-cyan-400/30 text-center space-y-4 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 mx-auto flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">No Tickets Found</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    {searchQuery ? 'No tickets match your search filter.' : "You haven't submitted any support requests under this ID yet."}
                  </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <Link
                    to="/support"
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-b from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 border-t border-sky-200/50 shadow-sm"
                  >
                    Submit Support Ticket
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowLookupModal(true)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  >
                    Track Existing ID
                  </button>
                </div>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = selectedTicket?._id === ticket._id;
                const statusMeta = getStatusBadge(ticket.status);
                const StatusIcon = statusMeta.icon;

                return (
                  <motion.div
                    key={ticket._id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`frutiger-window rounded-2xl p-4 border transition-all cursor-pointer shadow-lg ${
                      isSelected
                        ? 'border-cyan-400/70 ring-2 ring-cyan-400/20 bg-slate-900/90'
                        : 'border-slate-800 hover:border-cyan-400/30 bg-slate-950/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Priority Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getPriorityStyle(ticket.priority)}`}>
                          {ticket.priority}
                        </span>

                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${statusMeta.style}`}>
                          <StatusIcon className="w-3 h-3" />
                          {ticket.status.replace('_', ' ')}
                        </span>

                        {/* Category */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                          {ticket.category}
                        </span>
                      </div>

                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        #{ticket._id.slice(-6).toUpperCase()}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white line-clamp-1 mb-1">
                      {ticket.subject}
                    </h3>
                    <p className="text-xs text-slate-300/80 line-clamp-2 leading-relaxed mb-3">
                      {ticket.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {ticket.notes && ticket.notes.length > 0 && (
                          <span className="text-cyan-300 font-medium flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {ticket.notes.length} {ticket.notes.length === 1 ? 'note' : 'notes'}
                          </span>
                        )}
                        {ticket.mediaUrls && ticket.mediaUrls.length > 0 && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {ticket.mediaUrls.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Right Column: Detailed Ticket Inspector */}
          <div className="lg:col-span-7 sticky top-20">
            {selectedTicket ? (
              <div className="frutiger-window rounded-2xl overflow-hidden border border-cyan-400/30 shadow-2xl space-y-0">
                {/* Window Titlebar */}
                <div className="frutiger-window-titlebar flex items-center justify-between px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-300/60 shadow-sm" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-300/60 shadow-sm" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-300/60 shadow-sm" />
                    <span className="text-xs font-bold text-sky-100 ml-2">
                      Ticket_Inspector_#{selectedTicket._id.slice(-8).toUpperCase()}.exe
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedTicket._id, 'inspector-id')}
                    className="text-[11px] font-mono text-cyan-300 hover:text-white flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700"
                  >
                    {copiedKey === 'inspector-id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'inspector-id' ? 'Copied' : 'Copy ID'}</span>
                  </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-6">
                  {/* Status Banner */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusBadge(selectedTicket.status).style}`}>
                          {getStatusBadge(selectedTicket.status).label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getPriorityStyle(selectedTicket.priority)}`}>
                          {selectedTicket.priority} Priority
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">
                        Logged on {new Date(selectedTicket.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {selectedTicket.claimedBy && (
                      <div className="px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-400/30 text-xs text-cyan-200">
                        <span className="text-slate-400">Assigned Mod: </span>
                        <span className="font-bold text-white">@{selectedTicket.claimedBy}</span>
                      </div>
                    )}
                  </div>

                  {/* Subject & Description */}
                  <div className="space-y-3">
                    <h2 className="text-lg font-black text-white leading-snug">
                      {selectedTicket.subject}
                    </h2>
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedTicket.description}
                    </div>
                  </div>

                  {/* Ticket Metadata Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                      <span className="font-semibold text-white capitalize">{selectedTicket.category}</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Inquiry Type</span>
                      <span className="font-semibold text-white capitalize">{selectedTicket.type}</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 col-span-2 sm:col-span-1">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">User Identity</span>
                      <span className="font-mono text-cyan-300 truncate block text-[11px]">{selectedTicket.userId}</span>
                    </div>
                  </div>

                  {/* Attachments Section */}
                  {selectedTicket.mediaUrls && selectedTicket.mediaUrls.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                        Uploaded Attachments ({selectedTicket.mediaUrls.length})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedTicket.mediaUrls.map((url, index) => {
                          const isImage = url.match(/\.(jpeg|jpg|png|gif|webp)$/i);
                          return (
                            <a
                              key={index}
                              href={`${API_BASE}${url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-400/40 transition-colors flex items-center gap-2 group"
                            >
                              {isImage ? (
                                <img
                                  src={`${API_BASE}${url}`}
                                  alt={`Attachment ${index + 1}`}
                                  className="w-10 h-10 object-cover rounded-lg border border-slate-700"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-cyan-950/50 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="text-xs text-slate-200 group-hover:text-cyan-300 font-medium block truncate">
                                  File #{index + 1}
                                </span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <span>View</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </span>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Moderator Timeline Notes */}
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                      Moderator Updates & Audit Timeline
                    </h4>

                    {selectedTicket.notes && selectedTicket.notes.length > 0 ? (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {selectedTicket.notes.map((note, index) => (
                          <div
                            key={index}
                            className={`p-3.5 rounded-xl border space-y-1.5 ${
                              note.type === 'done'
                                ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-100'
                                : note.type === 'claim'
                                ? 'bg-blue-950/25 border-blue-500/40 text-blue-100'
                                : 'bg-slate-950/60 border-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold uppercase tracking-wider text-cyan-400">
                                {note.type} • {note.author}
                              </span>
                              <span className="text-slate-400 font-mono text-[10px]">
                                {new Date(note.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed font-sans">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                        No agent updates posted yet. Our support staff will evaluate this ticket shortly.
                      </div>
                    )}
                  </div>

                  {/* Resolution Notice */}
                  {(selectedTicket.status === 'done' || selectedTicket.status === 'closed') && (
                    <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div className="text-xs text-emerald-200">
                        <span className="font-bold">Ticket Resolved: </span>
                        This support request has been investigated and marked complete by the moderation team.
                      </div>
                    </div>
                  )}

                  {/* Action Link to Support */}
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Need to provide additional information?</span>
                    <Link
                      to="/support"
                      className="text-xs font-bold text-cyan-300 hover:text-white hover:underline flex items-center gap-1"
                    >
                      <span>Open Support Desk</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="frutiger-window rounded-2xl p-12 border border-cyan-400/30 text-center space-y-3 shadow-xl">
                <FileText className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-white">Select a Ticket</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Click any ticket card from the list to view full communication notes, attachments, and resolution status.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Manual Lookup Modal */}
      <AnimatePresence>
        {showLookupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLookupModal(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md relative z-10"
            >
              <div className="frutiger-window rounded-2xl overflow-hidden border border-cyan-400/40 shadow-2xl">
                <div className="frutiger-window-titlebar flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs font-bold text-sky-100 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    Ticket & Identity Tracker
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLookupModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleManualLookup} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                      Ticket ID or User ID
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Enter your Ticket ID (e.g. from confirmation receipt) or User ID to fetch your tickets.
                    </p>
                  </div>

                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="e.g. 660f82... or guest_1234abcd"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    required
                  />

                  {lookupError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                      {lookupError}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowLookupModal(false)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={lookupLoading}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-b from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 border-t border-sky-200/50 shadow-sm disabled:opacity-50"
                    >
                      {lookupLoading ? 'Locating...' : 'Locate Tickets'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
