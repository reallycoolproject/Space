import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Brush,
  Check,
  Hand,
  MousePointer2,
  RotateCcw,
  Upload,
  Users,
  X,
  Type,
  Palette,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Camera,
  Paperclip,
  Smile,
  Send,
  Image as ImageIcon
} from 'lucide-react';
import { useThemeCustomization, type ElementStyleRule } from '../../contexts/ThemeContext';

type PainterTool = 'select' | 'navigate';
type PainterSector = 'app' | 'dummy-chat';

const PRESET_FONTS = [
  { name: 'Press Start 2P', tag: 'Pixel 8-bit' },
  { name: 'VT323', tag: 'Retro Terminal' },
  { name: 'Silkscreen', tag: 'Arcade Display' },
  { name: 'Orbitron', tag: 'Y2K Sci-Fi' },
  { name: 'Comic Neue', tag: 'Y2K Casual' },
  { name: 'Trebuchet MS', tag: 'Frutiger Aero' },
  { name: 'Permanent Marker', tag: 'Graffiti' }
];

const colorToHex = (value: string, fallback: string) => {
  const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  return `#${match.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('')}`;
};

const escapeSelectorValue = (value: string) => CSS.escape(value);

function getElementSelector(element: HTMLElement): string {
  // 1. Direct paint ID
  const paintId = element.getAttribute('data-paint-id');
  if (paintId) return `[data-paint-id="${escapeSelectorValue(paintId)}"]`;

  // 2. Element ID
  if (element.id) return `#${escapeSelectorValue(element.id)}`;

  // 3. Painter role if present
  const painterRole = element.getAttribute('data-painter-role');
  if (painterRole) return `[data-painter-role="${escapeSelectorValue(painterRole)}"]`;

  // 4. Test ID
  const testId = element.getAttribute('data-testid');
  if (testId) return `[data-testid="${escapeSelectorValue(testId)}"]`;

  // 5. Aria label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return `${element.tagName.toLowerCase()}[aria-label="${escapeSelectorValue(ariaLabel)}"]`;

  // 6. Title
  const title = element.getAttribute('title');
  if (title) return `${element.tagName.toLowerCase()}[title="${escapeSelectorValue(title)}"]`;

  // 7. Guaranteed isolation: stamp data-paint-id on the element
  const generatedId = `paint_${Math.random().toString(36).slice(2, 9)}_${element.tagName.toLowerCase()}`;
  element.setAttribute('data-paint-id', generatedId);
  return `[data-paint-id="${generatedId}"]`;
}

function getPaintTarget(target: HTMLElement): HTMLElement {
  return target.closest('button, a, [role="button"]') as HTMLElement || target;
}

function describeElement(element: HTMLElement): string {
  const paintId = element.getAttribute('data-paint-id');
  if (paintId) return paintId.replace(/-/g, ' ');
  const label = element.getAttribute('aria-label') || element.getAttribute('title') ||
    element.innerText?.trim().replace(/\s+/g, ' ').slice(0, 32);
  return label || `${element.tagName.toLowerCase()} element`;
}

const swatches = [
  '#0288d1', '#00e5cc', '#76c442', '#ff0080', '#e91e8c',
  '#ff9800', '#7c4dff', '#00f0ff', '#1a1a2e', '#ffffff', '#000000'
];

const gradients = [
  { label: 'None', value: '' },
  { label: 'Aero Blue Glow', value: 'linear-gradient(135deg, #0288d1, #00e5cc)' },
  { label: 'Sunset Glow', value: 'linear-gradient(135deg, #ff7e5f, #feb47b)' },
  { label: 'Ocean Depth', value: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { label: 'Cyber Violet', value: 'linear-gradient(135deg, #7f00ff, #e100ff)' },
  { label: 'Y2K Hot Pink', value: 'linear-gradient(135deg, #ff0080, #7928ca)' },
  { label: 'Emerald Glass', value: 'linear-gradient(135deg, #10b981, #059669)' }
];

export function PainterMode() {
  const {
    isPainterMode,
    setIsPainterMode,
    elementStyles,
    setElementStyle,
    removeElementStyle,
    clearAllElementStyles,
    senderFont,
    setSenderFont,
    senderColor,
    setSenderColor,
    loadGoogleFont,
    wallpapers,
    setWallpaper
  } = useThemeCustomization();

  const [activeSector, setActiveSector] = useState<PainterSector>('app');
  const [tool, setTool] = useState<PainterTool>('select');

  // Dummy Chat State
  const [demoMessages, setDemoMessages] = useState<Array<{ id: string; author: string; text: string; own: boolean }>>([
    { id: '1', author: 'Mika', text: 'hi', own: false },
    { id: '2', author: 'You', text: 'HOW ARE YOU', own: true },
    { id: '3', author: 'Mika', text: 'Welcome to Painter Mode! Click any element, name, or bubble to customize it.', own: false }
  ]);
  const [demoInput, setDemoInput] = useState('');
  const [showFontModal, setShowFontModal] = useState(false);
  const [fontInputValue, setFontInputValue] = useState('');
  const [fontNotice, setFontNotice] = useState('');

  // Inspector State
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [hoverLabel, setHoverLabel] = useState('');
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [selectedSelector, setSelectedSelector] = useState('');
  const [draft, setDraft] = useState<ElementStyleRule>({});
  const [originalRule, setOriginalRule] = useState<ElementStyleRule | undefined>();
  const [isButtonTarget, setIsButtonTarget] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const editedElementCount = Object.keys(elementStyles).length;
  const computed = selectedElement ? window.getComputedStyle(selectedElement) : null;

  // Hover & selection listeners on the document
  useEffect(() => {
    if (!isPainterMode || tool !== 'select' || inspectorOpen) {
      setHoverRect(null);
      return;
    }

    const updateHover = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('#painter-hud, #painter-inspector, #painter-font-modal')) {
        setHoverRect(null);
        return;
      }
      const element = getPaintTarget(target);
      setHoverRect(element.getBoundingClientRect());
      setHoverLabel(describeElement(element));
    };

    const selectTarget = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('#painter-hud, #painter-inspector, #painter-font-modal')) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const element = getPaintTarget(target);
      const selector = getElementSelector(element);
      const savedRule = elementStyles[selector];

      setSelectedElement(element);
      setSelectedSelector(selector);
      setHoverLabel(describeElement(element));
      setOriginalRule(savedRule);
      setDraft(savedRule || {});
      setIsButtonTarget(element.matches('button, a, [role="button"]'));
      setUploadError('');
      setInspectorOpen(true);
      setHoverRect(null);
    };

    window.addEventListener('mouseover', updateHover, true);
    window.addEventListener('click', selectTarget, true);
    return () => {
      window.removeEventListener('mouseover', updateHover, true);
      window.removeEventListener('click', selectTarget, true);
    };
  }, [elementStyles, inspectorOpen, isPainterMode, tool]);

  if (!isPainterMode) return null;

  const updateStyle = (patch: Partial<ElementStyleRule>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setElementStyle(selectedSelector, next);
  };

  const applyStyle = () => setInspectorOpen(false);

  const cancelEditing = () => {
    if (selectedSelector) {
      if (originalRule) setElementStyle(selectedSelector, originalRule);
      else removeElementStyle(selectedSelector);
    }
    setDraft(originalRule || {});
    setInspectorOpen(false);
  };

  const resetSelectedElement = () => {
    removeElementStyle(selectedSelector);
    setDraft({});
  };

  const handleIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setUploadError('Choose a PNG, JPG, GIF, WebP, or SVG image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Choose an image smaller than 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') updateStyle({ iconUrl: reader.result });
    };
    reader.onerror = () => setUploadError('Image could not be read.');
    reader.readAsDataURL(file);
    setUploadError('');
  };

  const handleBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a PNG, JPG, GIF, or WebP image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setUploadError('Choose an image smaller than 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') updateStyle({ backgroundImage: reader.result });
    };
    reader.onerror = () => setUploadError('Image could not be read.');
    reader.readAsDataURL(file);
    setUploadError('');
  };

  const handleApplyFont = (nameOrUrl: string) => {
    if (!nameOrUrl.trim()) return;
    const loadedName = loadGoogleFont(nameOrUrl.trim());
    setSenderFont(loadedName);
    setFontNotice(`Font "${loadedName}" applied to all chats!`);
    setTimeout(() => setFontNotice(''), 3000);
  };

  const colorField = (label: string, value: string, onChange: (color: string) => void) => {
    const hex = colorToHex(value, '#0288d1');
    return (
      <label className="space-y-1.5">
        <span className="block text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={hex}
            onChange={e => onChange(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded-lg border border-[var(--app-border)] bg-transparent p-0.5"
          />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs text-[var(--text-input)] outline-none focus:border-[var(--app-accent)]"
          />
        </div>
      </label>
    );
  };

  return (
    <>
      {/* Hover Bounding Box */}
      {hoverRect && tool === 'select' && !inspectorOpen && (
        <div
          data-painter-hud-ignore
          className="pointer-events-none fixed z-[99995] rounded border-2 border-cyan-400 bg-cyan-400/15 shadow-[0_0_15px_rgba(34,211,238,0.7)] transition-all duration-75"
          style={{
            top: hoverRect.top,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height
          }}
        >
          <span className="absolute -top-7 left-0 whitespace-nowrap rounded-md bg-slate-950/90 px-2 py-0.5 text-[11px] font-bold text-cyan-200 border border-cyan-500/40 shadow-lg">
            🎨 Click to edit: {hoverLabel}
          </span>
        </div>
      )}

      {/* ═══ FLOATING PAINTER HUD ═══ */}
      <div
        id="painter-hud"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[99998] flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-cyan-300/40 bg-slate-950/90 p-2 text-white shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        {/* Brand & Badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300">
          <Brush className="h-4 w-4 animate-bounce" />
          <span className="text-xs font-black tracking-wider uppercase">Painter Studio</span>
        </div>

        <span className="h-6 w-px bg-white/20" />

        {/* Sector Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveSector('app')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeSector === 'app'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            🌐 Live App
          </button>
          <button
            type="button"
            onClick={() => setActiveSector('dummy-chat')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeSector === 'dummy-chat'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            💬 Dummy Chat Studio
          </button>
        </div>

        <span className="h-6 w-px bg-white/20" />

        {/* Tool Mode */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTool('select')}
            title="Inspect & Paint any element"
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              tool === 'select' ? 'bg-cyan-300 text-slate-950 font-bold shadow' : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            Select & Paint
          </button>
          <button
            type="button"
            onClick={() => setTool('navigate')}
            title="Browse without selecting"
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              tool === 'navigate' ? 'bg-cyan-300 text-slate-950 font-bold shadow' : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            <Hand className="h-3.5 w-3.5" />
            Browse
          </button>
        </div>

        <span className="h-6 w-px bg-white/20" />

        {/* Reset Edits */}
        <button
          type="button"
          disabled={editedElementCount === 0}
          onClick={() => {
            if (window.confirm(`Reset all ${editedElementCount} customized element styles?`)) {
              clearAllElementStyles();
              setInspectorOpen(false);
            }
          }}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-40 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset ({editedElementCount})
        </button>

        {/* Exit Button */}
        <button
          type="button"
          onClick={() => {
            setInspectorOpen(false);
            setIsPainterMode(false);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-1.5 text-xs font-black shadow-lg transition active:scale-95"
        >
          <Check className="h-3.5 w-3.5" />
          Done / Save
        </button>
      </div>

      {/* ═══ DUMMY CHAT SECTOR (INTERACTIVE PREVIEW DOCK) ═══ */}
      {activeSector === 'dummy-chat' && (
        <div className="fixed bottom-6 right-6 z-[99996] w-full max-w-md sm:max-w-lg rounded-3xl border-2 border-cyan-400/40 bg-[var(--app-panel)]/95 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl overflow-hidden flex flex-col max-h-[80vh]">
          {/* Dummy Chat Header */}
          <div className="px-5 py-3.5 border-b border-[var(--app-border)] bg-[var(--app-surface)]/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white font-black text-sm shadow-md">
                  M
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--app-surface)]" />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowFontModal(true)}
                  className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--app-accent)] flex items-center gap-1.5 transition-colors group cursor-pointer"
                  title="Click to customize sender font and name color!"
                >
                  <span
                    style={{
                      fontFamily: senderFont ? `'${senderFont}', sans-serif` : 'inherit',
                      color: senderColor || 'inherit'
                    }}
                  >
                    Mika
                  </span>
                  <Type className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
                </button>
                <p className="text-[11px] text-[var(--text-secondary)]">Dummy Chat Preview · Click any item to paint</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFontModal(true)}
                className="px-2.5 py-1 rounded-lg bg-[var(--app-surface-hover)] text-xs font-semibold text-[var(--app-accent)] flex items-center gap-1"
              >
                <Palette className="w-3.5 h-3.5" />
                Name Font
              </button>
              <button
                type="button"
                onClick={() => setActiveSector('app')}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"
                title="Close dummy chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dummy Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
            <p className="text-center text-[11px] text-[var(--text-secondary)] font-medium mb-2">
              💡 Tip: Click Mika's name to change font or sender color! Click bubbles or buttons to paint them.
            </p>

            {demoMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${msg.own ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white shadow-sm ${
                  msg.own ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)]'
                }`}>
                  {msg.author[0]}
                </div>

                <div className={`flex flex-col ${msg.own ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  <button
                    type="button"
                    onClick={() => setShowFontModal(true)}
                    className="text-[11px] font-bold mb-1 hover:underline cursor-pointer"
                    style={{
                      fontFamily: senderFont ? `'${senderFont}', sans-serif` : 'inherit',
                      color: senderColor || 'var(--text-secondary)'
                    }}
                  >
                    {msg.author}
                  </button>
                  <div
                    data-paint-id={`dummy-bubble-${msg.own ? 'own' : 'other'}`}
                    className={`p-3 rounded-2xl text-sm shadow-sm transition-all cursor-pointer ${
                      msg.own
                        ? 'bg-[var(--app-accent)] text-white'
                        : 'bg-[var(--app-surface)] text-[var(--text-primary)] border border-[var(--app-border)]'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dummy Chat Input */}
          <div className="p-3 border-t border-[var(--app-border)] bg-[var(--app-surface)]/90 shrink-0">
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!demoInput.trim()) return;
                setDemoMessages(prev => [...prev, { id: String(Date.now()), author: 'You', text: demoInput.trim(), own: true }]);
                setDemoInput('');
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                data-paint-id="chat-attach-btn"
                aria-label="Attach file"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent)] transition"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-paint-id="chat-camera-btn"
                aria-label="Open camera"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent)] transition"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={demoInput}
                onChange={e => setDemoInput(e.target.value)}
                placeholder="Type dummy message... (e.g. 'HOW ARE YOU')"
                className="flex-1 bg-[var(--bg-input)] text-[var(--text-input)] border border-[var(--border-input)] rounded-xl px-3 py-2 text-xs outline-none focus:border-[var(--app-accent)]"
              />
              <button
                type="submit"
                data-paint-id="chat-send-btn"
                aria-label="Send message"
                className="px-4 py-2 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white font-bold text-xs shadow-md transition"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ SENDER FONT & COLOR MODAL ═══ */}
      <AnimatePresence>
        {showFontModal && (
          <div
            id="painter-font-modal"
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-5 text-[var(--text-primary)] shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
                <div className="flex items-center gap-2">
                  <Type className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-base">Chat Sender Name Typography</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFontModal(false)}
                  className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {fontNotice && (
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">
                  ✓ {fontNotice}
                </div>
              )}

              {/* Sender Name Color */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1.5">
                  Sender Name Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={senderColor || '#0288d1'}
                    onChange={e => setSenderColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-[var(--app-border)] bg-transparent cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={senderColor}
                    placeholder="#0288d1"
                    onChange={e => setSenderColor(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[var(--bg-input)] text-[var(--text-input)] border border-[var(--border-input)] outline-none"
                  />
                  {senderColor && (
                    <button
                      type="button"
                      onClick={() => setSenderColor('')}
                      className="px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Custom Google Font / Link Input */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1.5">
                  Custom Font Name or Google Font Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fontInputValue}
                    onChange={e => setFontInputValue(e.target.value)}
                    placeholder="e.g. Orbitron, or paste Google Font URL"
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[var(--bg-input)] text-[var(--text-input)] border border-[var(--border-input)] outline-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyFont(fontInputValue);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyFont(fontInputValue)}
                    className="px-3.5 py-2 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white font-bold text-xs transition"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  You can paste any Google Font link or type a font name like "Press Start 2P" or "VT323".
                </p>
              </div>

              {/* Preset Quick Fonts */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">
                  Quick Font Presets
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_FONTS.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyFont(preset.name)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        senderFont.toLowerCase() === preset.name.toLowerCase()
                          ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/15 text-[var(--app-accent)] font-bold'
                          : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--text-primary)] hover:border-[var(--app-accent)]/50'
                      }`}
                    >
                      <span className="text-xs truncate" style={{ fontFamily: `'${preset.name}', sans-serif` }}>
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">{preset.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {senderFont && (
                <div className="pt-2 border-t border-[var(--app-border)] flex justify-between items-center">
                  <span className="text-xs text-[var(--text-secondary)]">Current font: <strong>{senderFont}</strong></span>
                  <button
                    type="button"
                    onClick={() => setSenderFont('')}
                    className="text-xs font-semibold text-rose-400 hover:underline"
                  >
                    Reset Font
                  </button>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowFontModal(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--app-accent)] text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ ELEMENT STYLE INSPECTOR MODAL ═══ */}
      <AnimatePresence>
        {inspectorOpen && (
          <div
            id="painter-inspector"
            className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="painter-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="my-auto flex max-h-[min(90vh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--text-primary)] shadow-2xl"
            >
              <header className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
                <div className="min-w-0">
                  <h2 id="painter-title" className="flex items-center gap-2 text-sm font-bold">
                    <Brush className="h-4 w-4 text-[var(--app-accent)]" />
                    Customize Target: <span className="text-cyan-400 font-mono text-xs">{selectedSelector}</span>
                  </h2>
                  <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{hoverLabel}</p>
                </div>
                <button type="button" onClick={cancelEditing} className="rounded-lg p-2 hover:bg-[var(--app-surface-hover)]" aria-label="Close editor">
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="space-y-6 overflow-y-auto p-5">
                <p className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs leading-relaxed text-cyan-200">
                  ✨ <strong>Independent Edit</strong>: This style applies exclusively to this target (<code className="font-mono text-cyan-300">{selectedSelector}</code>). It will NOT affect any other buttons or elements.
                </p>

                {/* Colors & Gradient */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">Colors & Background</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {colorField('Background Color', draft.backgroundColor || computed?.backgroundColor || '#ffffff', color => updateStyle({ backgroundColor: color }))}
                    {colorField('Text / Icon Color', draft.textColor || computed?.color || '#1a1a2e', color => updateStyle({ textColor: color }))}
                    {colorField('Border Color', draft.borderColor || computed?.borderColor || '#0288d1', color => updateStyle({ borderColor: color }))}
                    <label className="space-y-1.5">
                      <span className="block text-xs font-semibold text-[var(--text-secondary)]">Background Effect</span>
                      <select
                        value={draft.backgroundGradient || ''}
                        onChange={event => updateStyle({ backgroundGradient: event.target.value })}
                        className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-2.5 py-2 text-xs text-[var(--text-input)]"
                      >
                        {gradients.map(gradient => <option key={gradient.label} value={gradient.value}>{gradient.label}</option>)}
                      </select>
                    </label>
                  </div>

                  {/* Swatches */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {swatches.map(color => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Set background to ${color}`}
                        title={color}
                        onClick={() => updateStyle({ backgroundColor: color })}
                        className="h-7 w-7 rounded-lg border border-black/15 ring-offset-2 ring-offset-[var(--app-panel)] hover:ring-2 hover:ring-[var(--app-accent)] shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  {/* Background Image Upload */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <input
                      ref={backgroundInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={handleBackgroundUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => backgroundInputRef.current?.click()}
                      className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface-hover)]"
                    >
                      Upload Background Image
                    </button>
                    {draft.backgroundImage && (
                      <button type="button" onClick={() => updateStyle({ backgroundImage: '' })} className="text-xs font-medium text-rose-500 hover:underline">
                        Remove image
                      </button>
                    )}
                    <span className="text-[11px] text-[var(--text-secondary)]">PNG, JPG, GIF, WebP up to 3MB</span>
                  </div>
                  {uploadError && <p role="alert" className="text-xs font-medium text-rose-500">{uploadError}</p>}
                </section>

                {/* Shape & Sliders */}
                <section className="space-y-4 border-t border-[var(--app-border)] pt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wide">Shape & Roundness</h3>
                  {([
                    ['Corner Roundness', 'borderRadius', 0, 36, 'px'],
                    ['Border Thickness', 'borderWidth', 0, 10, 'px'],
                    ['Opacity', 'opacity', 10, 100, '%'],
                    ['Font Size', 'fontSize', 10, 36, 'px'],
                    ['Inner Spacing', 'padding', 0, 40, 'px'],
                    ['Letter Spacing', 'letterSpacing', 0, 10, 'px']
                  ] as const).map(([label, property, min, max, unit]) => {
                    const current = property === 'opacity'
                      ? Math.round((draft.opacity ?? Number(computed?.opacity || 1)) * 100)
                      : parseInt(draft[property] || computed?.getPropertyValue(property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)) || (property === 'fontSize' ? '14px' : '0px'), 10) || 0;
                    return (
                      <label key={property} className="flex items-center gap-3 text-xs">
                        <span className="w-32 shrink-0 text-[var(--text-secondary)]">{label}</span>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={Math.min(max, Math.max(min, current))}
                          onChange={event => {
                            const value = Number(event.target.value);
                            updateStyle(property === 'opacity' ? { opacity: value / 100 } : { [property]: `${value}${unit}` });
                          }}
                          className="min-w-0 flex-1 accent-[var(--app-accent)]"
                        />
                        <span className="w-12 text-right font-mono text-[var(--text-secondary)]">{current}{unit}</span>
                      </label>
                    );
                  })}

                  <label className="flex items-center gap-3 text-xs">
                    <span className="w-32 shrink-0 text-[var(--text-secondary)]">Shadow</span>
                    <select
                      value={draft.boxShadow || ''}
                      onChange={event => updateStyle({ boxShadow: event.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-2.5 py-2 text-xs text-[var(--text-input)]"
                    >
                      <option value="">Keep original</option>
                      <option value="none">None</option>
                      <option value="0 4px 14px rgba(0,0,0,.25)">Soft Glass Shadow</option>
                      <option value="0 8px 24px rgba(0,0,0,.4)">Deep Elevation</option>
                      <option value="0 0 20px var(--app-accent)">Neon Accent Glow</option>
                      <option value="0 0 15px rgba(34,211,238,0.8)">Cyan High-Tech Glow</option>
                    </select>
                  </label>
                </section>

                {/* Button Custom Icon Upload */}
                {isButtonTarget && (
                  <section className="space-y-3 border-t border-[var(--app-border)] pt-5">
                    <h3 className="text-xs font-bold uppercase tracking-wide">Custom Button Icon Image</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      {draft.iconUrl && (
                        <img
                          src={draft.iconUrl}
                          alt="Custom icon"
                          className="h-10 w-10 rounded-xl border border-[var(--app-border)] object-contain p-1 bg-black/20"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-xs font-bold hover:bg-[var(--app-surface-hover)] shadow-sm"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Custom Icon
                      </button>
                      {draft.iconUrl && (
                        <button
                          type="button"
                          onClick={() => updateStyle({ iconUrl: '' })}
                          className="text-xs font-medium text-rose-500 hover:underline"
                        >
                          Remove Custom Icon
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                        onChange={handleIconUpload}
                        className="hidden"
                      />
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Upload an image icon (PNG, JPG, SVG, WebP) to replace the default icon on this button only!
                    </p>
                  </section>
                )}
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-3">
                <button
                  type="button"
                  onClick={resetSelectedElement}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset this item
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={cancelEditing} className="rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]">
                    Cancel
                  </button>
                  <button type="button" onClick={applyStyle} className="flex items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-bold text-white hover:opacity-90 shadow-md">
                    <Check className="h-3.5 w-3.5" />
                    Keep changes
                  </button>
                </div>
              </footer>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
