import { motion } from 'framer-motion';
import { Mail, Building2, AlertTriangle, CheckCircle2, ArrowLeft, Sparkles, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Contact() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-hidden font-sans">
      {/* Ambient glass orb glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      {/* Floating Frutiger glass bubbles */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-24 left-[10%] w-16 h-16 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm shadow-inner" />
        <div className="absolute top-80 right-[12%] w-24 h-24 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm shadow-inner" />
      </div>

      {/* Back to Homepage Button */}
      <Link
        to="/"
        className="fixed top-5 left-5 z-40 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 backdrop-blur-md border border-slate-700 shadow-lg text-xs font-bold text-slate-200 hover:bg-slate-750 hover:scale-105 transition-all"
      >
        <ArrowLeft className="w-4 h-4 text-sky-400" />
        Back to Space
      </Link>

      {/* Main content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-sm text-xs font-bold text-[var(--app-accent)] mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Communications
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 text-[var(--text-primary)]">
            Contact & Enterprise Inquiries
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
            Direct channel for business partnerships, press inquiries, security disclosures, and enterprise operations.
          </p>
        </motion.div>

        {/* Business Email Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl bg-slate-800/90 backdrop-blur-2xl border border-slate-700 shadow-xl p-6 sm:p-8 mb-6"
        >
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-xs">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Official Business Desk</h2>
              <p className="text-xs text-slate-300">For corporate, institutional, and media communications</p>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-850/80 border border-slate-700 p-5 text-center shadow-inner">
            <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">Email Address</span>
            <a
              href="mailto:spaceappsupport@gmail.com"
              className="text-xl sm:text-2xl font-black text-sky-400 hover:underline select-all"
            >
              spaceappsupport@gmail.com
            </a>
          </div>
        </motion.div>

        {/* Support System Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-3xl bg-amber-500/10 border border-amber-500/25 backdrop-blur-xl p-6 sm:p-7 mb-6"
        >
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2 text-xs leading-relaxed text-slate-200">
              <h3 className="text-sm font-bold text-amber-400">Need Account Help or Found a Bug?</h3>
              <p>
                Please use our dedicated <strong>Support Ticket System</strong> instead of sending email. Tickets are prioritized and tracked directly by the developer and moderation team:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">• Bug reports</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">• Account recovery</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">• Feature requests</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">• Moderation queries</span>
              </div>
              <div className="pt-2">
                <Link
                  to="/support"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-md hover:bg-amber-600 transition-all"
                >
                  <LifeBuoy className="w-4 h-4" /> Open Support Center
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* What This Email Is For */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-3xl bg-slate-800/90 backdrop-blur-2xl border border-slate-700 shadow-xl p-6 sm:p-8 mb-6"
        >
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Inquiry Categories</h2>
              <p className="text-xs text-slate-300">Types of inquiries handled via our official business desk</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'Enterprise Deployments', desc: 'Custom private instances, on-premises networks, or dedicated organizational spaces.' },
              { title: 'Strategic Partnerships', desc: 'Integration opportunities, educational programs, and technical collaborations.' },
              { title: 'Press & Media Relations', desc: 'Interviews, visual brand assets, press kits, and media commentary.' },
              { title: 'Security Disclosures', desc: 'Responsible cryptographic bug bounty submissions and vulnerability reports.' },
              { title: 'Legal & Compliance', desc: 'Formal legal notices, regulatory inquiries, and verifiable institutional requests.' },
              { title: 'Investment & Grants', desc: 'Accredited inquiries regarding our open infrastructure vision and funding.' },
            ].map((item, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-850/70 border border-slate-700/80 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h4 className="text-xs font-bold text-white">{item.title}</h4>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed pl-6">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Response Policy Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-3xl bg-slate-800/90 backdrop-blur-xl border border-slate-700 shadow-lg p-6"
        >
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Response Expectations</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-xs text-slate-300">
            <div>
              <strong className="text-white block mb-1">Turnaround Time</strong>
              We review and reply to verified commercial inquiries within 2-3 business days.
            </div>
            <div>
              <strong className="text-white block mb-1">Language</strong>
              Primary correspondence is in English. Other languages may require additional translation time.
            </div>
            <div>
              <strong className="text-white block mb-1">User Support</strong>
              General chat support messages sent to this address are automatically routed to the Support Ticket system.
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}