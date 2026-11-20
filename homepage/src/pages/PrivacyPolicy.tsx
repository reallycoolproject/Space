import { motion } from 'framer-motion';
import { Shield, Lock, EyeOff, Server, Database, Trash2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  const lastUpdated = 'November 2026';

  const highlights = [
    {
      icon: <Lock className="w-5 h-5 text-sky-500" />,
      title: 'Private Encrypted DMs',
      desc: 'Your DMs are locked on your device. Nobody else — not even Space — can read them.'
    },
    {
      icon: <EyeOff className="w-5 h-5 text-emerald-500" />,
      title: 'Zero Third-Party Trackers',
      desc: 'No Google Analytics, no Facebook Pixels, and no ad trackers following you across the web.'
    },
    {
      icon: <Database className="w-5 h-5 text-indigo-500" />,
      title: 'No Data Brokerage',
      desc: 'We never sell, rent, or trade your personal information or contact lists to advertisers or data brokers.'
    },
    {
      icon: <Trash2 className="w-5 h-5 text-rose-500" />,
      title: 'One-Click Account Deletion',
      desc: 'You can delete your account at any time in Settings. When deleted, your credentials and profile are wiped.'
    }
  ];

  const sections = [
    {
      title: '1. What Information We Collect',
      icon: <Server className="w-4 h-4 text-sky-500" />,
      content: `We collect only what is strictly necessary to run your account:
• Account Info: Your chosen username, email address, password hash, and the date you joined.
• Profile Settings: Your avatar, banner, bio, and custom status that you choose to display in Spaces.
• Direct Messages: Encrypted message blobs that are stored temporarily so your recipient can receive them.`
    },
    {
      title: '2. What We NEVER Collect or Read',
      icon: <EyeOff className="w-4 h-4 text-emerald-500" />,
      content: `Our system is built so we cannot spy on you:
• Your Private Direct Messages: Your DMs are encrypted before leaving your device. We cannot read them.
• Your Private Keys: Your device creates and holds your private keys locally. They are never sent to our servers.
• Location Tracking: We do not log GPS locations or track your physical movements.
• Advertising Cookies: We do not cooperate with advertising networks or tracking pixels.`
    },
    {
      title: '3. Data Retention & Deletion',
      icon: <Trash2 className="w-4 h-4 text-rose-500" />,
      content: `You have full control over your profile.
You can delete your account anytime in Settings > Account. Once confirmed:
• Your user profile, credentials, and settings are permanently erased from our active database.
• Encrypted messages associated with your account are purged.`
    },
    {
      title: '4. Law Enforcement & Legal Disclosures',
      icon: <Shield className="w-4 h-4 text-amber-500" />,
      content: `We comply with valid court orders and legal subpoenas issued by lawful authorities.
Because private direct messages are encrypted on your device, we cannot provide plaintext of those messages to anyone, including law enforcement, because we do not have the keys to unlock them.`
    },
    {
      title: '5. Your Privacy Rights (GDPR & CCPA)',
      icon: <CheckCircle2 className="w-4 h-4 text-teal-500" />,
      content: `Every user has the right to:
• Access: Request an export of your account data.
• Edit: Update your username, avatar, and password at any time.
• Delete: Wipe your account and data with one click.
• Privacy: We do not sell your personal data, ever.`
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-x-hidden font-sans py-10 px-4 sm:px-6">
      {/* Top Navigation */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 shadow-md text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-700 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
          Back to Space
        </Link>
        <div className="flex items-center gap-2">
          <span className="frutiger-badge-retro text-[10px] px-3 py-1 rounded-full uppercase">
            ✦ Privacy Policy ✦
          </span>
        </div>
      </div>

      {/* Main Aero Desktop Window */}
      <div className="max-w-4xl mx-auto frutiger-window shadow-2xl">
        {/* Titlebar */}
        <div className="frutiger-window-titlebar px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-xs sm:text-sm tracking-wide text-white">
              Space Privacy Policy
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="frutiger-window-dot bg-amber-400 border border-amber-300 cursor-pointer" title="Minimize" />
            <span className="frutiger-window-dot bg-emerald-400 border border-emerald-300 cursor-pointer" title="Maximize" />
            <Link to="/" className="frutiger-window-dot bg-rose-500 border border-rose-400 cursor-pointer" title="Close" />
          </div>
        </div>

        {/* Window Interior Body */}
        <div className="p-6 sm:p-8 space-y-6 bg-slate-900">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Privacy Policy
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto font-medium">
              Plain English. No corporate doublespeak. How Space protects your chats, keys, and identity.
            </p>
            <p className="text-[11px] font-bold text-slate-400">
              Last Updated: {lastUpdated}
            </p>
          </div>

          {/* Highlights 4-Card Grid */}
          <div className="grid sm:grid-cols-2 gap-3.5">
            {highlights.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-700 bg-slate-800/90 shadow-sm hover:border-sky-500 transition-all flex items-start gap-3"
              >
                <div className="p-2.5 rounded-xl bg-slate-700/60 shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white mb-0.5">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Policy Sections */}
          <div className="space-y-4 pt-2">
            {sections.map((section, idx) => (
              <motion.section
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-xl border border-slate-700 bg-slate-800/90 p-5 shadow-sm hover:border-sky-500 transition-all"
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-700/60">
                    {section.icon}
                  </div>
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    {section.title}
                  </h2>
                </div>
                <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line pl-1 font-medium">
                  {section.content}
                </div>
              </motion.section>
            ))}
          </div>

          {/* Footer Contact */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-center text-xs text-slate-300 font-medium shadow-sm">
            Questions regarding our privacy standards? Read our{' '}
            <Link to="/qa" className="text-sky-400 font-bold underline hover:text-sky-300">
              FAQ & Tips
            </Link>{' '}
            or contact us through the{' '}
            <Link to="/contact" className="text-sky-400 font-bold underline hover:text-sky-300">
              Contact Page
            </Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
