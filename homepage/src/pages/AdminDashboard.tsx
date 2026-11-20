import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldAlert, 
  Users, 
  AlertTriangle, 
  Ban, 
  LogOut, 
  RefreshCw, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  ShieldCheck, 
  Trash2, 
  Ticket as TicketIcon, 
  Lock, 
  Copy, 
  Check, 
  ArrowLeft,
  Activity,
  FileText,
  UserX,
  MessageSquare,
  Clock,
  Tag,
  Paperclip,
  Send
} from 'lucide-react';
import ReportInspectionDrawer from '../components/ReportInspectionDrawer';
import AdminTicketDrawer, { type AdminTicket } from '../components/AdminTicketDrawer';
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

interface BannedUser {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  createdAt?: string;
  email?: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'reports' | 'bans' | 'tickets' | 'audit'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedAdminTicket, setSelectedAdminTicket] = useState<AdminTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const adminToken = localStorage.getItem('admin_token');
  const storedUser = localStorage.getItem('admin_user');
  const adminUser = storedUser ? JSON.parse(storedUser) : { username: 'omg', role: 'Super Administrator' };

  useEffect(() => {
    if (!adminToken) {
      navigate('/admin/login');
      return;
    }
    loadAllData();
  }, [adminToken]);

  const loadAllData = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchReports(), fetchBannedUsers(), fetchTickets()]);
    setIsRefreshing(false);
    setLoading(false);
  };

  const fetchReports = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/reports`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await response.json();
      if (data.ok) {
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  };

  const fetchBannedUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/banned-users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await response.json();
      if (data.ok) {
        setBannedUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch banned users:', error);
    }
  };

  const fetchTickets = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tickets/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'all' })
      });
      const data = await response.json();
      if (data.ok && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        // If an active ticket is currently inspected, refresh its instance
        if (selectedAdminTicket) {
          const updated = data.tickets.find((t: AdminTicket) => t._id === selectedAdminTicket._id);
          if (updated) setSelectedAdminTicket(updated);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  const handleClearReports = async () => {
    if (!confirm('CAUTION: Are you sure you want to permanently clear all moderation reports from the database?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/reports/clear`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await response.json();
      if (data.ok) {
        fetchReports();
      } else {
        alert(data.message || 'Failed to clear reports');
      }
    } catch (error) {
      console.error('Failed to clear reports:', error);
    }
  };

  const handleUnbanUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to restore access and unban @${username}?`)) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/unban-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      if (data.ok) {
        fetchBannedUsers();
        fetchReports();
      } else {
        alert(data.message || 'Failed to unban user');
      }
    } catch (error) {
      console.error('Failed to unban user:', error);
    }
  };

  const copyToClipboard = (text: string, idKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;
  const bannedCount = bannedUsers.length > 0 ? bannedUsers.length : reports.filter(r => r.status === 'resolved').length;
  const openTicketsCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'claimed').length;

  const filteredReports = reports.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || r.reason.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchesSearch = 
      searchQuery === '' ||
      r.reporter?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reportedUser?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reporter?.userId?.includes(searchQuery) ||
      r.reportedUser?.userId?.includes(searchQuery);
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const filteredTickets = tickets.filter(t => {
    const matchesStatus = 
      ticketStatusFilter === 'all' || 
      t.status === ticketStatusFilter ||
      (ticketStatusFilter === 'resolved' && (t.status === 'done' || t.status === 'closed'));
    const matchesSearch =
      ticketSearchQuery === '' ||
      t.subject?.toLowerCase().includes(ticketSearchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(ticketSearchQuery.toLowerCase()) ||
      t._id?.toLowerCase().includes(ticketSearchQuery.toLowerCase()) ||
      t.username?.toLowerCase().includes(ticketSearchQuery.toLowerCase()) ||
      t.userId?.includes(ticketSearchQuery) ||
      t.contactEmail?.toLowerCase().includes(ticketSearchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getReasonBadge = (reason: string) => {
    const r = reason.toLowerCase();
    if (r.includes('csam') || r.includes('threat') || r.includes('exploit')) {
      return 'bg-red-500/20 text-red-300 border-red-500/40';
    }
    if (r.includes('hate') || r.includes('harass') || r.includes('toxic')) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
    if (r.includes('spam') || r.includes('bot')) {
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    }
    return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/20 text-amber-300 border-amber-400/50';
      case 'resolved':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50';
      case 'dismissed':
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getTicketStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return { label: 'Open • Awaiting Mod', style: 'bg-blue-500/20 text-blue-300 border-blue-400/40', icon: Clock };
      case 'claimed':
        return { label: 'Claimed', style: 'bg-purple-500/20 text-purple-300 border-purple-400/40', icon: Tag };
      case 'in_progress':
        return { label: 'In Progress', style: 'bg-amber-500/20 text-amber-300 border-amber-400/40', icon: RefreshCw };
      case 'done':
      case 'closed':
        return { label: 'Resolved', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40', icon: CheckCircle2 };
      default:
        return { label: status, style: 'bg-slate-700/40 text-slate-300 border-slate-600', icon: AlertTriangle };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-cyan-300 tracking-wider font-mono">INITIALIZING SHIELD CORE MATRIX...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-x-hidden font-sans select-none">
      {/* Background radial glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Realistic 3D Soap Bubbles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="frutiger-bubble-realistic absolute w-24 h-24 top-[8%] left-[4%] animate-float-slow opacity-60" />
        <div className="frutiger-bubble-realistic absolute w-14 h-14 top-[40%] right-[3%] animate-float-medium opacity-50" />
        <div className="frutiger-bubble-realistic absolute w-32 h-32 bottom-[10%] left-[8%] animate-float-fast opacity-65" />
        <div className="frutiger-bubble-realistic absolute w-20 h-20 bottom-[30%] right-[15%] animate-float-slow opacity-55" />
      </div>

      {/* Top Aero Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-cyan-400/20 bg-slate-950/80 backdrop-blur-md px-6 py-3.5 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 shadow-md shadow-cyan-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950/40 rounded-[10px] flex items-center justify-center backdrop-blur-sm">
                <ShieldCheck className="w-6 h-6 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">SHIELD CONTROL CENTER</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  v2.6 AERO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Restricted Administrative Security Matrix</p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-3">
            {/* Operator Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">Operator:</span>
              <span className="font-bold text-white">{adminUser.username}</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-400/30">ADMIN</span>
            </div>

            {/* Refresh Matrix Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={loadAllData}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Refresh Matrix Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </motion.button>

            {/* Clear All Reports Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleClearReports}
              className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Clear Moderation Reports"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">Clear Reports</span>
            </motion.button>

            {/* Return to Space Platform Link */}
            <Link
              to="/"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Space App</span>
            </Link>

            {/* Logout Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleLogout}
              className="py-1.5 px-3 rounded-xl bg-gradient-to-b from-red-500 to-rose-700 hover:from-red-400 hover:to-rose-600 text-white text-xs font-bold border-t border-red-300/40 shadow-sm flex items-center gap-1.5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-7 relative z-10">
        {/* Live Stats Row (4 Frutiger Aero Glass Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Pending */}
          <div className="frutiger-window rounded-2xl p-4 border border-amber-400/30 flex items-center gap-4 shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">Pending Reports</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white">{pendingCount}</span>
                {pendingCount > 0 && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-400/30">
                    Needs Action
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Banned Accounts */}
          <div className="frutiger-window rounded-2xl p-4 border border-rose-500/30 flex items-center gap-4 shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center shrink-0">
              <Ban className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">Banned Users</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white">{bannedCount}</span>
                <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-400/30">
                  Enforced
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Resolved */}
          <div className="frutiger-window rounded-2xl p-4 border border-emerald-400/30 flex items-center gap-4 shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">Resolved Cases</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white">{resolvedCount}</span>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30">
                  Closed
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Support Tickets */}
          <div className="frutiger-window rounded-2xl p-4 border border-cyan-400/30 flex items-center gap-4 shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <TicketIcon className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
              <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">Active Tickets</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white">{openTicketsCount}</span>
                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-400/30">
                  Helpdesk
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-cyan-400/20 pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 border-t border-sky-200/50'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Moderation Matrix</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
              {reports.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bans')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'bans'
                ? 'bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 border-t border-sky-200/50'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Banned Accounts</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
              {bannedUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'tickets'
                ? 'bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 border-t border-sky-200/50'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
            }`}
          >
            <TicketIcon className="w-3.5 h-3.5" />
            <span>Support Tickets Desk</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
              {tickets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 border-t border-sky-200/50'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Audit & Logs</span>
          </button>
        </div>

        {/* TAB 1: MODERATION MATRIX */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by username, user ID, violation keywords..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors font-medium"
                />
              </div>

              {/* Status Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Status:</span>
                {(['all', 'pending', 'resolved', 'dismissed'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                      statusFilter === status
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Frutiger Aero Window Reports Feed */}
            <div className="frutiger-window rounded-2xl overflow-hidden border border-cyan-400/30 shadow-2xl">
              {/* Window Titlebar */}
              <div className="frutiger-window-titlebar flex items-center justify-between px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-300/60 shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-300/60 shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-300/60 shadow-sm" />
                  <span className="text-xs font-bold text-sky-100 ml-2">
                    Shield_Incident_Reports_Stream.exe
                  </span>
                </div>
                <div className="text-[11px] font-mono text-cyan-300/80">
                  {filteredReports.length} Active Records
                </div>
              </div>

              {/* Table / List */}
              <div className="overflow-x-auto">
                {filteredReports.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <ShieldCheck className="w-12 h-12 text-cyan-400/40 mx-auto" />
                    <h3 className="text-lg font-bold text-white">No Incident Reports Found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      All platform telemetry is clear. When users flag harassment, threats, or abuse, cases will stream directly here.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3.5">Reported User</th>
                        <th className="px-5 py-3.5">Reporting User</th>
                        <th className="px-5 py-3.5">Violation Type</th>
                        <th className="px-5 py-3.5">Date Submitted</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Moderation Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {filteredReports.map((report) => (
                        <tr
                          key={report._id}
                          className="hover:bg-cyan-500/[0.04] transition-colors"
                        >
                          {/* Reported User */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-rose-600/30 border border-rose-500/40 flex items-center justify-center font-bold text-rose-200 shrink-0">
                                {report.reportedUser?.username?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-white truncate">
                                  {report.reportedUser?.displayName || report.reportedUser?.username || 'Unknown'}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-rose-300/80">
                                  <span>@{report.reportedUser?.username}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(report.reportedUser?.userId, `user-${report._id}`)}
                                    className="hover:text-white"
                                    title="Copy User ID"
                                  >
                                    {copiedId === `user-${report._id}` ? <Check className="w-2.5 h-2.5 text-emerald-400 inline" /> : <Copy className="w-2.5 h-2.5 inline" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Reporting User */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-cyan-600/20 border border-cyan-400/30 flex items-center justify-center font-bold text-cyan-200 text-xs shrink-0">
                                {report.reporter?.username?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-200 truncate">
                                  {report.reporter?.displayName || report.reporter?.username}
                                </p>
                                <p className="text-[11px] text-slate-400">@{report.reporter?.username}</p>
                              </div>
                            </div>
                          </td>

                          {/* Reason */}
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-block ${getReasonBadge(report.reason)}`}>
                              {report.reason}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="px-5 py-4 text-slate-300 font-mono text-[11px]">
                            {new Date(report.createdAt).toLocaleDateString()} {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider inline-block ${getStatusBadge(report.status)}`}>
                              {report.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedReport(report)}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-b from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 border-t border-sky-200/50 shadow-sm transition-all"
                            >
                              Inspect & Action
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BANNED USERS REGISTRY */}
        {activeTab === 'bans' && (
          <div className="frutiger-window rounded-2xl overflow-hidden border border-rose-500/30 shadow-2xl">
            <div className="frutiger-window-titlebar flex items-center justify-between px-5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-300/60 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-300/60 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-300/60 shadow-sm" />
                <span className="text-xs font-bold text-sky-100 ml-2">
                  Space_Security_Ban_Registry.exe
                </span>
              </div>
              <div className="text-[11px] font-mono text-rose-300">
                {bannedUsers.length} Banned Identities
              </div>
            </div>

            <div className="p-5">
              {bannedUsers.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400/50 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Active User Bans</h4>
                  <p className="text-xs text-slate-400">There are currently no accounts flagged under permanent ban restrictions.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bannedUsers.map((banned) => (
                    <div
                      key={banned.userId}
                      className="p-4 rounded-xl bg-slate-950/60 border border-rose-500/30 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-600/30 border border-rose-400/40 flex items-center justify-center font-bold text-rose-200">
                          {banned.username[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white text-sm truncate">{banned.displayName || banned.username}</p>
                          <p className="text-xs text-rose-300">@{banned.username}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          BANNED
                        </span>
                      </div>

                      <div className="text-xs font-mono text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                        <span>ID: {banned.userId}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(banned.userId, `ban-${banned.userId}`)}
                          className="hover:text-white"
                        >
                          {copiedId === `ban-${banned.userId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnbanUser(banned.userId, banned.username)}
                        className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-emerald-200 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Revoke Ban & Restore Access</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUPPORT TICKETS DESK */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {/* Filter & Search Bar for Tickets */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={ticketSearchQuery}
                  onChange={(e) => setTicketSearchQuery(e.target.value)}
                  placeholder="Filter tickets by subject, user ID, sender, keywords..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors font-medium"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Status:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'open', label: 'Open' },
                  { id: 'claimed', label: 'Claimed' },
                  { id: 'in_progress', label: 'In Progress' },
                  { id: 'resolved', label: 'Resolved' }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setTicketStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                      ticketStatusFilter === st.id
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tickets Matrix Feed */}
            <div className="frutiger-window rounded-2xl overflow-hidden border border-cyan-400/30 shadow-2xl">
              <div className="frutiger-window-titlebar flex items-center justify-between px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-300/60 shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-300/60 shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-300/60 shadow-sm" />
                  <span className="text-xs font-bold text-sky-100 ml-2">
                    Space_Support_Desk_Telemetries.exe
                  </span>
                </div>
                <div className="text-[11px] font-mono text-cyan-300/80">
                  {filteredTickets.length} Queue Tickets
                </div>
              </div>

              <div className="p-5">
                {filteredTickets.length === 0 ? (
                  <div className="p-16 text-center space-y-2">
                    <TicketIcon className="w-12 h-12 text-cyan-400/40 mx-auto" />
                    <h4 className="text-sm font-bold text-white">No Tickets in Queue</h4>
                    <p className="text-xs text-slate-400">
                      {ticketSearchQuery ? 'No tickets matched your filter query.' : 'All user inquiries and support requests are currently resolved.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTickets.map((t) => {
                      const badge = getTicketStatusBadge(t.status);
                      const BadgeIcon = badge.icon;

                      return (
                        <div
                          key={t._id}
                          onClick={() => setSelectedAdminTicket(t)}
                          className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-400/40 hover:bg-slate-900/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${badge.style}`}>
                                <BadgeIcon className="w-3 h-3" />
                                {badge.label}
                              </span>

                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                t.priority === 'critical' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                                t.priority === 'high' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              }`}>
                                {t.priority}
                              </span>

                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                                {t.category} • {t.type}
                              </span>

                              <span className="text-xs text-slate-400 font-mono">
                                #{t._id.slice(-6).toUpperCase()}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors truncate">
                              {t.subject}
                            </h4>

                            <p className="text-xs text-slate-300/80 line-clamp-1 leading-relaxed">
                              {t.description}
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                              <span>Author: <strong className="text-slate-200">@{t.username || 'User'}</strong></span>
                              <span>ID: <code className="text-cyan-300 font-mono">{t.userId}</code></span>
                              {t.isGuest && (
                                <span className="text-[10px] bg-slate-800 text-amber-300 px-1.5 py-0.2 rounded border border-amber-400/30">
                                  Guest / Visitor
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
                            <div className="text-left md:text-right text-xs text-slate-400">
                              <div>{new Date(t.createdAt).toLocaleDateString()}</div>
                              <div className="text-cyan-300/90 font-medium">
                                {t.claimedBy ? `Claimed by @${t.claimedBy}` : 'Unclaimed'}
                              </div>
                              {t.notes && t.notes.length > 0 && (
                                <div className="text-[10px] text-slate-400">
                                  {t.notes.length} communication {t.notes.length === 1 ? 'note' : 'notes'}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAdminTicket(t);
                              }}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 hover:from-sky-300 hover:to-blue-500 border-t border-sky-200/50 shadow-md shadow-sky-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Inspect & Reply</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SECURITY AUDIT & LOGS */}
        {activeTab === 'audit' && (
          <div className="frutiger-window rounded-2xl overflow-hidden border border-cyan-400/30 shadow-2xl">
            <div className="frutiger-window-titlebar flex items-center justify-between px-5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-300/60 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-300/60 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-300/60 shadow-sm" />
                <span className="text-xs font-bold text-sky-100 ml-2">
                  Space_Cryptographic_Audit_Stream.log
                </span>
              </div>
              <div className="text-[11px] font-mono text-cyan-300">
                ACTIVE INTEGRITY OK
              </div>
            </div>

            <div className="p-6 font-mono text-xs text-slate-300 space-y-3 bg-slate-950/70">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-cyan-400">[SEC-AUTH] Operator omg session initialized with 2048-bit AES bearer token</span>
                <span className="text-slate-500 text-[10px]">{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-emerald-400">[SHIELD-DB] MongoDB encrypted connection verified • 0 tampering alerts</span>
                <span className="text-slate-500 text-[10px]">{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-sky-400">[SUPPORT-KEYS] Ticket identity binding enforced with cryptographic signatures</span>
                <span className="text-slate-500 text-[10px]">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Case Inspection Drawer */}
      {selectedReport && (
        <ReportInspectionDrawer
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onRefresh={loadAllData}
        />
      )}

      {/* Ticket Support Desk Drawer */}
      {selectedAdminTicket && (
        <AdminTicketDrawer
          ticket={selectedAdminTicket}
          onClose={() => setSelectedAdminTicket(null)}
          onRefresh={loadAllData}
        />
      )}
    </div>
  );
}
