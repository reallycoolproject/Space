import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Book, Shield, MessageSquare, Users, Settings, AlertCircle, ArrowLeft, Sparkles, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const docsData = [
  {
    category: 'Getting Started',
    icon: <Book className="w-5 h-5" />,
    sections: [
      {
        title: 'Creating Your Account',
        content: `
          <h4 class="text-sm font-bold mb-2 text-[var(--text-primary)]">Fast & Private Registration</h4>
          <p class="mb-3 text-xs text-[var(--text-secondary)]">To create a Space account:</p>
          <ol class="list-decimal list-inside mb-4 space-y-1.5 text-xs text-[var(--text-secondary)]">
            <li>Visit the Space homepage</li>
            <li>Click the "Make your Space" or "Sign Up" button</li>
            <li>Enter your email and choose a unique username</li>
            <li>Set a strong master passphrase</li>
            <li>Your cryptographic keys will generate locally in your browser</li>
          </ol>
          <p class="text-xs text-[var(--text-secondary)]">Your account is ready immediately without intrusive phone number verification.</p>
        `
      },
      {
        title: 'Setting Up Your Profile & Avatar',
        content: `
          <h4 class="text-sm font-bold mb-2 text-[var(--text-primary)]">Personalizing Your Identity</h4>
          <ul class="list-disc list-inside mb-4 space-y-1.5 text-xs text-[var(--text-secondary)]">
            <li>Open Settings by clicking the gear icon</li>
            <li>Upload a custom avatar or choose an animated GIF</li>
            <li>Add a short bio and custom status quote</li>
            <li>Set custom banner colors or upload a profile header image</li>
          </ul>
        `
      },
      {
        title: 'Account Settings & User ID',
        content: `
          <h4 class="text-sm font-bold mb-2 text-[var(--text-primary)]">Security & Support Identifiers</h4>
          <p class="mb-3 text-xs text-[var(--text-secondary)]">Access your account controls from the settings modal:</p>
          <ul class="list-disc list-inside space-y-1.5 text-xs text-[var(--text-secondary)]">
            <li><strong>Profile:</strong> Update your display name, username, bio, and profile picture</li>
            <li><strong>Security:</strong> Change your password and export your Web Crypto keypair</li>
            <li><strong>Privacy:</strong> Manage blocked users and who can add you to groups</li>
            <li><strong>User ID:</strong> Your unique User ID is displayed in Profile Settings. This ID is used for support ticket identification and is separate from your login credentials.</li>
          </ul>
        `
      }
    ]
  },
  {
    category: 'Security & Privacy',
    icon: <Shield className="w-5 h-5" />,
    sections: [
      {
        title: 'End-to-End Encryption',
        content: `
          <h4 class="text-sm font-bold mb-2 text-[var(--text-primary)]">How Your Messages Stay Safe</h4>
          <p class="mb-3 text-xs text-[var(--text-secondary)]">Every direct conversation uses asymmetric cryptographic keypairs generated inside your browser via the standard Web Crypto API.</p>
          <ul class="list-disc list-inside space-y-1.5 text-xs text-[var(--text-secondary)]">
            <li>Plaintext messages never touch our server memory</li>
            <li>Your private key remains strictly on your local device</li>
            <li>Messages are encrypted into ciphertext before being piped over WebSockets</li>
          </ul>
        `
      },
      {
        title: 'Key Storage & HTTPS Requirements',
        content: `
          <h4 class="text-sm font-bold mb-2 text-[var(--text-primary)]">Securing Your Keys</h4>
          <p class="mb-3 text-xs text-[var(--text-secondary)]">Modern mobile browsers (Safari on iOS, Chrome on Android) require secure HTTPS connections to enable cryptographic storage and microphone permissions. When using Space over Wi-Fi, always connect to the HTTPS address.</p>
        `
      }
    ]
  },
  {
    category: 'Spaces & Channels',
    icon: <Users className="w-5 h-5" />,
    sections: [
      {
        title: 'Creating and Managing Spaces',
        content: `
          <h4 class="text-sm font-bold mb-2 text-[var(--text-primary)]">Community Hubs</h4>
          <p class="mb-3 text-xs text-[var(--text-secondary)]">Spaces allow you to build complete communities with channels, categories, and role permissions.</p>
          <ul class="list-disc list-inside space-y-1.5 text-xs text-[var(--text-secondary)]">
            <li>Click the "+" button in the left server navigation bar to create a Space</li>
            <li>Organize discussion by creating Categories (e.g. "Text Channels", "Voice Lounges")</li>
            <li>Drag and drop channels or categories in the sidebar to reorder them</li>
          </ul>
        `
      },
      {
        title: 'Private Channels & Role Permissions',
        content: `
          <h4 class="text-sm font-bold mb-2 text-[var(--text-primary)]">Granular Access Control</h4>
          <p class="mb-3 text-xs text-[var(--text-secondary)]">Click the gear icon next to any channel or category to configure visibility. Toggle "Private Channel" to restrict access only to selected roles or individual members.</p>
        `
      }
    ]
  },
  {
    category: 'Themes & Aesthetics',
    icon: <Sparkles className="w-5 h-5" />,
    sections: [
      {
        title: 'Selecting Themes',
        content: `
          <h4 class="text-sm font-bold mb-2 text-[var(--text-primary)]">Authentic Nostalgia</h4>
          <p class="mb-3 text-xs text-[var(--text-secondary)]">Choose from 9 built-in themes in Settings > Themes & Appearance, including Vista-era Frutiger Aero, Organic Eco, Northern Lights Aurora, Windows Phone Metro, and Turn-of-the-Millennium Y2K Chrome.</p>
        `
      },
      {
        title: 'Chat Formatting Shortcuts',
        content: `
          <h4 class="text-sm font-bold mb-2 text-[var(--text-primary)]">Text Markdown Guide</h4>
          <p class="mb-3 text-xs text-[var(--text-secondary)]">Format any message by surrounding text with markdown tokens:</p>
          <ul class="list-disc list-inside space-y-1.5 text-xs text-[var(--text-secondary)]">
            <li><code>**bold**</code> for bold text</li>
            <li><code>*italic*</code> for italic text</li>
            <li><code>__underline__</code> for underlined text</li>
            <li><code>~~strike~~</code> for strikethrough text</li>
            <li><code>\`code\`</code> for inline code snippets</li>
            <li><code>||spoiler||</code> for blacked-out spoiler bars</li>
          </ul>
        `
      }
    ]
  }
];

export default function Docs() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Getting Started');
  const [expandedSection, setExpandedSection] = useState<string | null>('Getting Started-0');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#d6f0ff] via-[#eef8ff] to-[#cbe8fa] dark:from-[#0a1226] dark:via-[#0e1c38] dark:to-[#081124] text-[var(--text-primary)] relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

      {/* Floating bubbles */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-24 left-[10%] w-16 h-16 rounded-full border border-white/60 bg-white/20 backdrop-blur-sm shadow-inner" />
        <div className="absolute top-80 right-[12%] w-24 h-24 rounded-full border border-white/50 bg-white/10 backdrop-blur-sm shadow-inner" />
      </div>

      {/* Back Button */}
      <Link
        to="/"
        className="fixed top-5 left-5 z-40 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 dark:bg-black/50 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-lg text-xs font-bold text-[var(--text-primary)] hover:bg-white dark:hover:bg-black/70 hover:scale-105 transition-all"
      >
        <ArrowLeft className="w-4 h-4 text-[var(--app-accent)]" />
        Back to Space
      </Link>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-sm text-xs font-bold text-[var(--app-accent)] mb-3">
            <HelpCircle className="w-3.5 h-3.5" /> Help & Tips
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 text-[var(--text-primary)]">
            Space Documentation & Guides
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Clear instructions for creating accounts, securing encryption keys, organizing spaces, and customizing themes.
          </p>
        </motion.div>

        {/* Categories Accordion */}
        <div className="space-y-4">
          {docsData.map((category, catIndex) => {
            const isCatOpen = expandedCategory === category.category;
            return (
              <motion.div
                key={category.category}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: catIndex * 0.08 }}
                className="rounded-3xl bg-white/80 dark:bg-[#12213d]/80 backdrop-blur-2xl border border-white/70 dark:border-white/10 shadow-xl overflow-hidden"
              >
                {/* Category Header */}
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isCatOpen ? null : category.category)}
                  className={`w-full p-5 flex items-center justify-between text-left transition-colors ${
                    isCatOpen
                      ? 'bg-[var(--app-accent)] text-white shadow-sm'
                      : 'hover:bg-white/40 dark:hover:bg-white/5 text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`p-2 rounded-xl ${isCatOpen ? 'bg-white/20' : 'bg-[var(--app-accent)]/15 text-[var(--app-accent)]'}`}>
                      {category.icon}
                    </span>
                    <span className="text-sm font-bold tracking-tight">{category.category}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isCatOpen ? 'rotate-180 text-white' : 'text-[var(--text-secondary)]'
                    }`}
                  />
                </button>

                {/* Category Sections */}
                <AnimatePresence>
                  {isCatOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="divide-y divide-[var(--app-border)]/50"
                    >
                      {category.sections.map((section, secIndex) => {
                        const sectionId = `${category.category}-${secIndex}`;
                        const isSecOpen = expandedSection === sectionId;
                        return (
                          <div key={secIndex}>
                            <button
                              type="button"
                              onClick={() => setExpandedSection(isSecOpen ? null : sectionId)}
                              className="w-full p-4 text-left flex items-center justify-between hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
                            >
                              <span className="text-xs font-bold text-[var(--text-primary)]">{section.title}</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-200 ${
                                  isSecOpen ? 'rotate-180 text-[var(--app-accent)]' : ''
                                }`}
                              />
                            </button>
                            <AnimatePresence>
                              {isSecOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="px-4 pb-4 pt-1"
                                >
                                  <div
                                    className="p-3.5 rounded-2xl bg-white/60 dark:bg-black/20 border border-[var(--app-border)]/60 text-xs text-[var(--text-secondary)] leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: section.content }}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-center gap-4">
          <Link to="/qa" className="hover:text-[var(--app-accent)] transition-colors">Frequently Asked Questions</Link>
          <span>•</span>
          <Link to="/support" className="hover:text-[var(--app-accent)] transition-colors">Submit Support Ticket</Link>
          <span>•</span>
          <Link to="/privacy" className="hover:text-[var(--app-accent)] transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}