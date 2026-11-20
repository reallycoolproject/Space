import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowLeft, Search, HelpCircle, Shield, Sparkles, MessageCircle, Palette } from 'lucide-react';
import { Link } from 'react-router-dom';

const qaData = [
  {
    category: 'Getting Started',
    icon: <Sparkles className="w-4 h-4 text-sky-500" />,
    questions: [
      {
        q: 'How do I get in?',
        a: 'Just click "Sign Up" or "Make your Space". All you need is a username, email, and password. No phone numbers, no credit cards, and no waiting around.'
      },
      {
        q: 'Is Space really 100% free?',
        a: 'Yes, completely free. There are no paywalls, hidden fees, or monthly subscriptions. Custom themes, HD streaming, and full profile personalization are completely free for everyone.'
      },
      {
        q: 'What makes Space different from Discord?',
        a: 'Space gives you the community clubhouse feel of Discord, but with true private end-to-end encryption for your DMs, zero ad tracking, and customizable aesthetic themes — like discord... but actually safer.'
      }
    ]
  },
  {
    category: 'Privacy & Chats',
    icon: <Shield className="w-4 h-4 text-emerald-500" />,
    questions: [
      {
        q: 'Are my private messages actually private?',
        a: 'Yes. When you send a direct message, it gets locked directly on your device before it ever leaves your phone or computer. Only the person you sent it to has the key to unlock and read it. Nobody in between — not even Space administrators — can read your conversations.'
      },
      {
        q: 'Can server moderators read my private DMs?',
        a: 'No, it is technically impossible. Moderators only have tools inside their own community channels. They cannot view or access your private direct messages.'
      },
      {
        q: 'Do you track me or sell my data?',
        a: 'No. We do not sell your personal data, we do not track you across other websites, and we have zero advertising trackers.'
      }
    ]
  },
  {
    category: 'Spaces & Channels',
    icon: <MessageCircle className="w-4 h-4 text-indigo-500" />,
    questions: [
      {
        q: 'What is a Space?',
        a: 'A Space is your community server where you can make text channels, voice hangouts, announcement boards, and set custom roles for your members.'
      },
      {
        q: 'Can I send voice notes, images, and files?',
        a: 'Yes! Drop pictures, videos, files, and voice notes straight into any chat. Voice notes also come with clickable audio waveforms.'
      },
      {
        q: 'How do private channels work?',
        a: 'Moderators can toggle "Private Channel" in channel settings and choose which roles or members are allowed to view it. Everyone else will not even see the channel listed.'
      },
      {
        q: 'Can I format messages like bold, italic, and spoilers?',
        a: 'Yes! You can use standard formatting shortcuts: **bold**, *italic*, __underline__, ~~strikethrough~~, `code`, and ||spoiler|| right into the message box.'
      },
      {
        q: 'Can I reorder channels and categories?',
        a: 'Yes! Admins and moderators can easily drag channels and categories up and down to organize their server however they like.'
      }
    ]
  },
  {
    category: 'Themes & Looks',
    icon: <Palette className="w-4 h-4 text-pink-500" />,
    questions: [
      {
        q: 'How do I change my theme?',
        a: 'Head into Settings > Appearance to pick from 16 different aesthetics (Frutiger Aero, Aqua, Eco, Aurora, Metro, Emo, Goth, and more). You can also open Theme Studio to set custom colors.'
      },
      {
        q: 'Can I set a custom wallpaper for a chat?',
        a: 'Yes! Inside any conversation, click the wallpaper icon in the top header to upload a picture, adjust blur, or set background dimming.'
      }
    ]
  }
];

export default function QA() {
  const [activeCategory, setActiveCategory] = useState<string>('Getting Started');
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return qaData;
    const query = search.toLowerCase();
    return qaData
      .map(cat => ({
        ...cat,
        questions: cat.questions.filter(
          q => q.q.toLowerCase().includes(query) || q.a.toLowerCase().includes(query)
        )
      }))
      .filter(cat => cat.questions.length > 0);
  }, [search]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-x-hidden font-sans py-10 px-4 sm:px-6">
      {/* Top Navigation Bar */}
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
            ✦ FAQ & Help ✦
          </span>
        </div>
      </div>

      {/* Main Aero Desktop Window Frame */}
      <div className="max-w-4xl mx-auto frutiger-window shadow-2xl">
        {/* Titlebar */}
        <div className="frutiger-window-titlebar px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-xs sm:text-sm tracking-wide text-white">
              Space Help & FAQ
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
          {/* Header Banner */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Frequently Asked Questions
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto font-medium">
              Everything you need to know about Space, private messaging, servers, and custom looks.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-lg mx-auto relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions (e.g. encryption, spaces, themes)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium"
            />
          </div>

          {/* Category Tabs */}
          {!search && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {qaData.map(cat => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setActiveCategory(cat.category)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    activeCategory === cat.category
                      ? 'frutiger-btn frutiger-btn-primary text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
                  }`}
                >
                  {cat.icon}
                  {cat.category}
                </button>
              ))}
            </div>
          )}

          {/* Q&A Accordion Items */}
          <div className="space-y-3">
            {(search ? filteredCategories : filteredCategories.filter(c => c.category === activeCategory)).map(category => (
              <div key={category.category} className="space-y-2">
                {search && (
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 pt-3 flex items-center gap-1.5">
                    {category.icon} {category.category}
                  </h3>
                )}
                {category.questions.map((item, index) => {
                  const questionId = `${category.category}-${index}`;
                  const isOpen = expandedQuestion === questionId;
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-700 bg-slate-800/90 shadow-sm overflow-hidden transition-all hover:border-sky-500"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedQuestion(isOpen ? null : questionId)}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left gap-3 select-none"
                      >
                        <span className="text-xs sm:text-sm font-bold text-white">
                          {item.q}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-sky-400 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 text-xs sm:text-sm text-slate-200 leading-relaxed border-t border-slate-750 pt-3 bg-slate-850/60 font-medium">
                              {item.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Contact Box */}
          <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-sm">
            <div>
              <p className="text-xs font-bold text-white">Have another question?</p>
              <p className="text-[11px] text-slate-300 font-medium">Reach out directly or send us a support ticket.</p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/support"
                className="px-3.5 py-1.5 rounded-lg frutiger-btn frutiger-btn-primary text-white text-xs font-bold shadow-sm"
              >
                Submit Ticket
              </Link>
              <Link
                to="/contact"
                className="px-3.5 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-650"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
