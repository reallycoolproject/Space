import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Terminal, BookOpen, Zap, ChevronRight, ShieldCheck, Cpu, Copy, Check, FileCode, Lock, ArrowLeft, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Code Block Component with Copy to Clipboard
function CodeBlock({ code, language = 'typescript' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative my-6 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#080B1A]/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-200/50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="text-xs font-mono text-gray-500 dark:text-white/40 ml-2">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-transparent"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-xs md:text-sm font-mono text-gray-800 dark:text-blue-200/90 overflow-x-auto leading-relaxed">
        <code>{code.trim()}</code>
      </pre>
    </div>
  )
}

function Documentation() {
  const [activeTab, setActiveTab] = useState<'getting-started' | 'architecture' | 'security' | 'api-reference'>('getting-started')

  const navItems = [
    { id: 'getting-started', label: 'Getting Started', icon: BookOpen, tag: 'Quickstart' },
    { id: 'architecture', label: 'Architecture', icon: Cpu, tag: 'Deep Dive' },
    { id: 'security', label: 'Security & E2EE', icon: Lock, tag: 'Core Spec' },
    { id: 'api-reference', label: 'API Reference', icon: FileCode, tag: 'REST & WS' },
  ]

  return (
    <div className="min-h-screen bg-[#f2f3f5] dark:bg-[#111214] text-gray-900 dark:text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden transition-colors duration-300">
      
      {/* Soft background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-[800px] h-[400px] bg-indigo-500/20 dark:bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#111214]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <MessageCircle className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black tracking-tighter">space.</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full lg:w-72 flex-shrink-0"
          >
            <div className="bg-white dark:bg-[#1e1f22] rounded-3xl p-6 sticky top-32 border border-gray-100 dark:border-[#2b2d31] shadow-xl shadow-gray-200/50 dark:shadow-none">
              <div className="flex items-center gap-2 mb-6">
                <Terminal className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold tracking-tight">Documentation</h3>
              </div>

              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-bold transition-all ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2b2d31] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-500' : ''}`} />
                        <span>{item.label}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${isActive ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-gray-100 dark:bg-[#111214] text-gray-500 dark:text-gray-400'
                        }`}>
                        {item.tag}
                      </span>
                    </button>
                  )
                })}
              </nav>

              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-[#2b2d31]">
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                    <ShieldCheck className="w-4 h-4" />
                    Zero-Knowledge Guarantee
                  </div>
                  <p className="text-xs text-indigo-900/70 dark:text-indigo-200/70 leading-relaxed font-medium">
                    Keys are generated on client runtime using native Web Crypto APIs. Servers never see plaintext payload bytes.                     Message contents are not available to us in readable form.
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>

          {/* Main Content Area */}
          <motion.main
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="flex-1"
          >
            <div className="bg-white dark:bg-[#1e1f22] rounded-3xl p-8 md:p-12 border border-gray-100 dark:border-[#2b2d31] shadow-xl shadow-gray-200/50 dark:shadow-none min-h-[600px]">
              <AnimatePresence mode="wait">
                {/* 1. GETTING STARTED */}
                {activeTab === 'getting-started' && (
                  <motion.div
                    key="getting-started"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                        v1.4.0 Production
                      </span>
                      <span className="text-xs text-gray-500 font-mono font-medium">Updated: July 2026</span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-6 text-gray-900 dark:text-white">
                      Space Developer Platform
                    </h1>

                    <p className="text-lg text-gray-600 dark:text-gray-400 font-medium leading-relaxed mb-10">
                      Space is an end-to-end encrypted (E2EE) messaging and workspace platform built on zero-trust primitives. All messages, media, and channel metadata are encrypted locally in the user browser before hitting WebSocket ingestion nodes.
                    </p>

                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                      <div className="p-6 rounded-2xl bg-gray-50 dark:bg-[#111214] border border-gray-200 dark:border-transparent">
                        <Zap className="w-6 h-6 text-amber-500 mb-3" />
                        <h4 className="font-bold text-gray-900 dark:text-white text-base mb-2">Ultra-Low Latency</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Sub-50ms message distribution over edge WebSocket clusters.</p>
                      </div>
                      <div className="p-6 rounded-2xl bg-gray-50 dark:bg-[#111214] border border-gray-200 dark:border-transparent">
                        <Lock className="w-6 h-6 text-emerald-500 mb-3" />
                        <h4 className="font-bold text-gray-900 dark:text-white text-base mb-2">AES-GCM-256</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Authentic client-side encryption using NIST-standard primitives.</p>
                      </div>
                      <div className="p-6 rounded-2xl bg-gray-50 dark:bg-[#111214] border border-gray-200 dark:border-transparent">
                        <Globe className="w-6 h-6 text-indigo-500 mb-3" />
                        <h4 className="font-bold text-gray-900 dark:text-white text-base mb-2">Zero Metadata Leak</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Blinded routing prevents traffic analysis and server eavesdropping.</p>
                      </div>
                    </div>

                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <ChevronRight className="w-5 h-5 text-indigo-500" /> Key Initialization Example
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-4">
                      Initialize client keypairs using native Web Crypto APIs prior to establishing WebSocket connection:
                    </p>

                    <CodeBlock
                      code={`import { generateIdentityKeyPair, deriveRoomKey } from '@space/crypto'

// Generate ECDH P-256 Keypair locally on client startup
const identityKeys = await generateIdentityKeyPair();

// Derive symmetric AES-GCM-256 room key from pre-shared secret
const roomKey = await deriveRoomKey(identityKeys.privateKey, remotePublicKey);

console.log("Client E2EE Engine Active:", identityKeys.publicKey);`}
                    />
                  </motion.div>
                )}

                {/* 2. ARCHITECTURE */}
                {activeTab === 'architecture' && (
                  <motion.div
                    key="architecture"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-6">
                      System Architecture
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed mb-8">
                      The Space architecture is divided into three isolated layers: the local Client Encryption Engine, the Stateless WebSocket Relay Mesh, and the Blinded Database Storage engine.
                    </p>

                    <div className="space-y-6 mb-8">
                      <div className="p-6 rounded-2xl bg-gray-50 dark:bg-[#111214] border border-gray-200 dark:border-transparent flex gap-4 items-start">
                        <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-mono text-sm font-bold">01</div>
                        <div>
                          <h3 className="text-lg font-bold mb-2">Client Layer (Browser / Desktop)</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                            Executes crypto primitives, manages IndexedDB encrypted key stores, renders React UI trees, and handles media blob encryption.
                          </p>
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-gray-50 dark:bg-[#111214] border border-gray-200 dark:border-transparent flex gap-4 items-start">
                        <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-mono text-sm font-bold">02</div>
                        <div>
                          <h3 className="text-lg font-bold mb-2">Stateless Relay Gateway</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                            High-throughput Node/Rust WebSocket nodes. Responsible solely for distributing encrypted payloads to connected channel listeners without inspecting payload bodies.
                          </p>
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-gray-50 dark:bg-[#111214] border border-gray-200 dark:border-transparent flex gap-4 items-start">
                        <div className="p-3 rounded-xl bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 font-mono text-sm font-bold">03</div>
                        <div>
                          <h3 className="text-lg font-bold mb-2">Blinded Persistence Store</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                            Stores ciphertexts tagged with ephemeral room hashes. No plaintexts, user real names, or raw email associations are stored on disk.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 3. SECURITY & E2EE */}
                {activeTab === 'security' && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-6">
                      Security & Cryptographic Specification
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed mb-8">
                      Space implements standard cryptographic primitives. Key exchanges use **Elliptic Curve Diffie-Hellman (ECDH)** over Curve P-256, combined with **AES-GCM-256** for payload encryption.
                    </p>

                    <h3 className="text-xl font-bold mb-4">Payload Encryption Flow</h3>
                    <CodeBlock
                      language="typescript"
                      code={`// Client-side payload encryption before network dispatch
async function encryptMessage(text: string, secretKey: CryptoKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    secretKey,
    encodedText
  );

  return {
    ciphertext: Array.from(new Uint8Array(ciphertext)),
    iv: Array.from(iv)
  };
}`}
                    />

                    <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 mt-8">
                      <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold mb-2">
                        <ShieldCheck className="w-5 h-5" />
                        Forward Secrecy Guarantee
                      </div>
                      <p className="text-sm text-emerald-900/70 dark:text-emerald-100/70 font-medium leading-relaxed">
                        Channel ephemeral keys rotate automatically on member join/leave events. Compromising a single historic key does not decrypt future channel communications.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* 4. API REFERENCE */}
                {activeTab === 'api-reference' && (
                  <motion.div
                    key="api-reference"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-6">
                      WebSocket & REST API Reference
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed mb-8">
                      Connect your applications directly to the Space Edge Gateway to stream ciphertexts or manage room ACL permissions.
                    </p>

                    <div className="space-y-4 mb-10">
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#111214] border border-gray-200 dark:border-transparent flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                            POST
                          </span>
                          <span className="font-mono text-sm font-bold">/api/v1/spaces/create</span>
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Create Encrypted Room</span>
                      </div>

                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#111214] border border-gray-200 dark:border-transparent flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">
                            GET
                          </span>
                          <span className="font-mono text-sm font-bold">/api/v1/spaces/:id/keys</span>
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fetch Public Key Prekey Bundle</span>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold mb-4">WebSocket Ingestion Example</h3>
                    <CodeBlock
                      language="javascript"
                      code={`const ws = new WebSocket('wss://gateway.space.app/v1/stream');

ws.onopen = () => {
  ws.send(JSON.stringify({
    op: 'SUBSCRIBE',
    spaceId: 'spc_998271',
    authTicket: 'ey...jwt'
  }));
};

ws.onmessage = (event) => {
  const { encryptedPayload, iv } = JSON.parse(event.data);
  // Decrypt locally using room key
  decryptMessage(encryptedPayload, iv);
};`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.main>
        </div>
      </div>
    </div>
  )
}

export default Documentation