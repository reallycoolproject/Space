import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paintbrush,
  Sparkles,
  Type,
  Image as ImageIcon,
  Plus,
  Trash2,
  Check,
  Palette,
  Layers,
  ChevronRight,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { useThemeCustomization, type WallpaperConfig } from '../../contexts/ThemeContext';
import { ImageCropModal, type CropResult } from '../common/ImageCropModal';

const PRESET_FONTS = [
  { name: 'Press Start 2P', tag: '8-bit Pixel' },
  { name: 'VT323', tag: 'Retro Terminal' },
  { name: 'Silkscreen', tag: 'Arcade Display' },
  { name: 'Orbitron', tag: 'Y2K Sci-Fi' },
  { name: 'Comic Neue', tag: 'Y2K Casual' },
  { name: 'Trebuchet MS', tag: 'Frutiger Classic' }
];

const THEME_COLOR_FIELDS = [
  { key: '--app-bg', label: 'Page background', fallback: '#d6f0ff' },
  { key: '--app-surface', label: 'Surface', fallback: '#ffffff' },
  { key: '--app-surface-hover', label: 'Surface hover', fallback: '#f4fcff' },
  { key: '--app-panel', label: 'Panels', fallback: '#edf8ff' },
  { key: '--app-border', label: 'Borders', fallback: '#9dcce8' },
  { key: '--app-accent', label: 'Primary accent', fallback: '#0288d1' },
  { key: '--app-accent-hover', label: 'Accent hover', fallback: '#0277bd' },
  { key: '--app-accent-secondary', label: 'Secondary accent', fallback: '#76c442' },
  { key: '--text-primary', label: 'Main text', fallback: '#0a2540' },
  { key: '--text-secondary', label: 'Muted text', fallback: '#2979b5' }
] as const;

const THEME_PALETTES = [
  { name: 'Aero Glass', colors: ['#d6f0ff', '#ffffff', '#f4fcff', '#edf8ff', '#9dcce8', '#0288d1', '#0277bd', '#76c442', '#0a2540', '#2979b5'] },
  { name: 'Frutiger Eco', colors: ['#e8f5e2', '#ffffff', '#f4fbef', '#f0faeb', '#b6d2a5', '#558b2f', '#477629', '#f9a825', '#1b3a0e', '#558b2f'] },
  { name: 'Frutiger Aqua', colors: ['#eef4fb', '#ffffff', '#f5faff', '#f0f6fc', '#a0cbe8', '#3b9eda', '#2585c0', '#72b93e', '#10243d', '#245780'] },
  { name: 'Frutiger Glacier', colors: ['#e6f4fa', '#ffffff', '#f0f9fd', '#ebf6fc', '#93d1f0', '#0ea5e9', '#0284c7', '#67e8f9', '#0c2838', '#1d5a7a'] },
  { name: 'Frutiger Solar', colors: ['#fef7e6', '#ffffff', '#fffaf0', '#fdf6e7', '#f4ce83', '#d97706', '#b45309', '#10b981', '#351f03', '#78490a'] },
  { name: 'Frutiger Technozen', colors: ['#edf2f0', '#ffffff', '#f3f7f5', '#edf3f0', '#9ec6b5', '#2d7a5b', '#205c44', '#5c9c82', '#142921', '#325749'] },
  { name: 'Frutiger Aurora', colors: ['#0a0e2a', '#17234b', '#202c56', '#10183a', '#41527d', '#00e5cc', '#00bfae', '#a855f7', '#e8f4ff', '#91b5d5'] },
  { name: 'Frutiger Metro', colors: ['#1a1a2e', '#0f3460', '#1a4a7a', '#16213e', '#1c558c', '#0099ff', '#33aeff', '#e91e8c', '#f0f4ff', '#90b8e2'] },
  { name: 'Emo / Rawr XD', colors: ['#0d0d0f', '#18181e', '#22222a', '#121218', '#63153c', '#ff1493', '#ff40a8', '#00f5ff', '#ffffff', '#f096c8'] },
  { name: 'Cyber Goth', colors: ['#09080c', '#14101a', '#1d1726', '#0f0c14', '#5e1017', '#e50914', '#ff2e3a', '#a855f7', '#ffffff', '#e0a0b8'] },
  { name: 'Vaporwave', colors: ['#1a102a', '#26183a', '#34224e', '#1a102a', '#542d7a', '#00f0ff', '#38f5ff', '#ff7a90', '#fdf9ff', '#cbb8e8'] },
  { name: 'Scene Queen', colors: ['#0a0d0a', '#101a10', '#182618', '#0c140c', '#205c14', '#39ff14', '#5fff3d', '#ff007f', '#ffffff', '#8cf77e'] },
  { name: 'Y2K Chrome', colors: ['#10091c', '#21122f', '#301a42', '#180d27', '#583366', '#ff4fd8', '#e638c1', '#00e5ff', '#fff0ff', '#d2a8eb'] },
  { name: 'Dormant Dark', colors: ['#0c1220', '#121c34', '#1a284a', '#0e162a', '#274578', '#388bfd', '#58a6ff', '#bc8cff', '#e2ecfa', '#7e9ec7'] },
  { name: 'Vector Bloom', colors: ['#fff0f8', '#ffffff', '#fff5fa', '#fef2f8', '#e8a5cc', '#e0529c', '#c93e88', '#a78bfa', '#2b0821', '#872864'] },
  { name: 'Superflat Pop', colors: ['#ffe8f5', '#ffe0f0', '#ffd0e8', '#fff0fa', '#ff99cc', '#ff0080', '#e6006d', '#ffe600', '#1f0214', '#9e0050'] }
];

const colorToHex = (value: string, fallback: string) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) return `#${hex[1]}`;
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
  if (!rgb) return fallback;
  return `#${rgb.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('')}`;
};

export function ThemeStudio({ onLaunchPainter }: { onLaunchPainter?: () => void }) {
  const {
    currentTheme,
    setTheme,
    customThemes,
    saveCustomTheme,
    deleteCustomTheme,
    customOverrides,
    setCustomOverride,
    clearCustomOverrides,
    senderFont,
    setSenderFont,
    senderColor,
    setSenderColor,
    loadGoogleFont,
    wallpapers,
    setWallpaper,
    getWallpaper,
    setIsPainterMode
  } = useThemeCustomization();

  // Font Popover state in dummy chat
  const [showFontPopover, setShowFontPopover] = useState(false);
  const [fontInput, setFontInput] = useState('');
  const [fontAppliedMsg, setFontAppliedMsg] = useState(false);

  // New Theme modal
  const [showSaveThemeModal, setShowSaveThemeModal] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeDescription, setNewThemeDescription] = useState('');

  // Wallpaper Cropper modal for Global chat wallpaper
  const [showWallpaperCropper, setShowWallpaperCropper] = useState(false);

  // Quick color edit state
  const primaryAccent = customOverrides['--app-accent'] || '#0288d1';
  const secondaryAccent = customOverrides['--app-accent-secondary'] || '#76c442';
  const panelBlur = customOverrides['--panel-blur'] || '20px';

  const globalWallpaper = getWallpaper();
  const readThemeColor = (key: string, fallback: string) =>
    colorToHex(customOverrides[key] || getComputedStyle(document.documentElement).getPropertyValue(key).trim() || fallback, fallback);

  const handleApplyFont = (fontName: string) => {
    setSenderFont(fontName);
    setFontAppliedMsg(true);
    setTimeout(() => setFontAppliedMsg(false), 2000);
  };

  const handleCustomThemeSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeName.trim()) return;

    // Build vars from current state + overrides
    const rootStyles = getComputedStyle(document.documentElement);
    const readVariable = (name: string, fallback: string) => rootStyles.getPropertyValue(name).trim() || customOverrides[name] || fallback;
    const vars: Record<string, string> = {
      '--app-bg': readVariable('--app-bg', '#d6f0ff'),
      '--app-surface': readVariable('--app-surface', 'rgba(255,255,255,0.55)'),
      '--app-surface-hover': readVariable('--app-surface-hover', 'rgba(255,255,255,0.78)'),
      '--app-panel': readVariable('--app-panel', 'rgba(255,255,255,0.72)'),
      '--app-border': readVariable('--app-border', 'rgba(100,181,246,0.35)'),
      '--app-accent': primaryAccent,
      '--app-accent-hover': readVariable('--app-accent-hover', primaryAccent),
      '--app-accent-secondary': secondaryAccent,
      '--text-primary': readVariable('--text-primary', '#0a2540'),
      '--text-secondary': readVariable('--text-secondary', '#2979b5'),
      '--bg-input': readVariable('--bg-input', 'rgba(255,255,255,0.65)'),
      '--text-input': readVariable('--text-input', '#0a2540'),
      '--border-input': readVariable('--border-input', 'rgba(100,181,246,0.5)'),
      '--glass-bg': readVariable('--glass-bg', 'rgba(255,255,255,0.38)'),
      '--glass-border': readVariable('--glass-border', 'rgba(255,255,255,0.65)'),
      '--glass-bg-strong': readVariable('--glass-bg-strong', 'rgba(255,255,255,0.55)'),
      '--panel-blur': readVariable('--panel-blur', panelBlur),
      '--app-panel-backdrop': readVariable('--app-panel-backdrop', `blur(${panelBlur}) saturate(1.6)`)
    };

    saveCustomTheme(newThemeName.trim(), vars, newThemeDescription.trim());
    setNewThemeName('');
    setNewThemeDescription('');
    setShowSaveThemeModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Enter Painter Mode Card (Disabled / Upcoming Feature) */}
        <div 
          className="p-5 rounded-2xl border border-[var(--app-border)] relative overflow-hidden flex flex-col justify-between bg-[var(--app-surface)]/40 opacity-80 backdrop-blur-md"
        >
          {/* Upcoming Feature Badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider shadow-xs">
            <span>🚧 Upcoming Feature</span>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-gray-500/20 text-gray-400">
                <Paintbrush className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-base text-[var(--text-primary)]">Painter Mode</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Painter Mode allows direct point-and-click styling for buttons, cards, and custom CSS variables across the app.
            </p>
            <div className="mt-3 p-2.5 rounded-xl bg-[var(--app-panel)]/80 border border-[var(--app-border)] text-[11px] text-[var(--text-secondary)]">
              ℹ️ <strong>Under Maintenance:</strong> We are rebuilding Painter Mode with an advanced live CSS inspector and real-time element canvas. It will be re-enabled in an upcoming release.
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              disabled
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--text-secondary)] cursor-not-allowed flex items-center justify-center gap-2 opacity-60"
            >
              <Paintbrush className="w-4 h-4" />
              Painter Mode (Coming Soon)
            </button>
          </div>
        </div>

        {/* Global Chat Wallpaper Card */}
        <div 
          className="p-5 rounded-2xl border border-[var(--app-border)] relative overflow-hidden flex flex-col justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(118, 196, 66, 0.15) 0%, rgba(2, 136, 209, 0.08) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 15px rgba(118, 196, 66, 0.12)'
          }}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-[var(--app-accent-secondary)]/20 text-[var(--app-accent-secondary)]">
                <ImageIcon className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-base text-[var(--text-primary)]">Chat wallpaper</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Choose a wallpaper for every chat, or set one for a single conversation from its header.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setShowWallpaperCropper(true)}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] flex items-center justify-center gap-2 shadow-sm"
            >
              <ImageIcon className="w-4 h-4 text-[var(--app-accent)]" />
              {globalWallpaper ? 'Customize Wallpaper' : 'Choose Wallpaper'}
            </button>
            {globalWallpaper && (
              <button
                onClick={() => setWallpaper('global', null)}
                className="py-2.5 px-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                title="Remove global wallpaper"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sample conversation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--app-accent)]" />
              Try your chat style
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Change a name's font and color here, then see how it looks in a conversation.
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-[var(--app-surface)] text-[11px] font-bold text-[var(--app-accent)] border border-[var(--app-border)]">
            Preview
          </span>
        </div>

        {/* Dummy Chat Box */}
        <div 
          className="relative rounded-2xl border border-[var(--app-border)] overflow-hidden p-4 space-y-3 min-h-[220px]"
          style={{
            background: 'var(--app-surface)',
            boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)'
          }}
        >
          {/* Active Global Wallpaper in Preview if set */}
          {globalWallpaper && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              <div 
                className="w-full h-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${globalWallpaper.url})`,
                  filter: `blur(${globalWallpaper.blur || 0}px)`,
                  transform: `scale(${globalWallpaper.zoom || 1}) translate(${globalWallpaper.panX || 0}%, ${globalWallpaper.panY || 0}%)`,
                  opacity: 1 - ((globalWallpaper.dim || 0) / 100),
                }}
              />
              {globalWallpaper.texture && (
                <div 
                  className="absolute inset-0 bg-repeat opacity-15"
                  style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
                    backgroundSize: '16px 16px'
                  }}
                />
              )}
            </div>
          )}

          {/* Dummy Message 1 */}
          <div className="relative z-10 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] text-white font-bold flex items-center justify-center shrink-0 shadow-sm text-xs">
              S
            </div>
            <div className="flex-1">
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setShowFontPopover(v => !v)}
                  className="group px-2 py-0.5 rounded-lg border border-transparent hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Click to customize sender font & color"
                >
                  <span
                    className="text-xs font-bold transition-all"
                    style={{
                      color: senderColor || 'var(--text-secondary)',
                      fontFamily: senderFont ? `'${senderFont}', sans-serif` : 'inherit'
                    }}
                  >
                    soly [OG Creator]
                  </span>
                  <span className="text-[10px] text-[var(--app-accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                    (Click to edit font)
                  </span>
                </button>

                {/* Sender Font & Color Popover */}
                <AnimatePresence>
                  {showFontPopover && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      className="absolute left-0 top-full mt-2 z-50 w-72 p-3.5 rounded-2xl bg-[var(--app-panel)] border border-[var(--app-border)] shadow-2xl space-y-3"
                      style={{
                        boxShadow: '0 15px 35px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.5)'
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                          <Type className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                          Sender Font & Color
                        </span>
                        <button
                          onClick={() => setShowFontPopover(false)}
                          className="w-5 h-5 rounded-full hover:bg-[var(--app-surface-hover)] flex items-center justify-center text-[var(--text-secondary)]"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Presets */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Retro Presets:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PRESET_FONTS.map(f => (
                            <button
                              key={f.name}
                              type="button"
                              onClick={() => handleApplyFont(f.name)}
                              className={`p-1.5 text-left rounded-lg border text-[11px] font-medium truncate transition-colors ${
                                senderFont === f.name ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/15 text-[var(--app-accent)]' : 'border-[var(--app-border)] hover:bg-[var(--app-surface-hover)] text-[var(--text-primary)]'
                              }`}
                            >
                              <div className="font-bold truncate">{f.name}</div>
                              <div className="text-[9px] text-[var(--text-secondary)]">{f.tag}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Google Font URL or Name input */}
                      <div className="space-y-1 pt-1 border-t border-[var(--app-border)]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Google Font Name or Link:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="e.g. VT323 or font link..."
                            value={fontInput}
                            onChange={(e) => setFontInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && fontInput.trim()) {
                                handleApplyFont(fontInput.trim());
                                setFontInput('');
                              }
                            }}
                            className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-[var(--bg-input)] text-[var(--text-input)] border border-[var(--border-input)]"
                          />
                          <button
                            onClick={() => {
                              if (fontInput.trim()) {
                                handleApplyFont(fontInput.trim());
                                setFontInput('');
                              }
                            }}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--app-accent)] text-white"
                          >
                            Apply
                          </button>
                        </div>
                      </div>

                      {/* Sender Color Picker */}
                      <div className="space-y-1 pt-1 border-t border-[var(--app-border)]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Sender Name Color:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={senderColor || '#0288d1'}
                            onChange={(e) => setSenderColor(e.target.value)}
                            className="w-8 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                          />
                          <input
                            type="text"
                            value={senderColor}
                            placeholder="#0288d1"
                            onChange={(e) => setSenderColor(e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-[var(--bg-input)] text-[var(--text-input)] border border-[var(--border-input)]"
                          />
                          {senderColor && (
                            <button
                              onClick={() => setSenderColor('')}
                              className="text-[10px] text-red-400 hover:underline"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>

                      {fontAppliedMsg && (
                        <div className="text-[11px] text-green-400 font-bold text-center">
                          ✓ Applied to all chats!
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div 
                className="mt-1 p-3 rounded-xl max-w-md text-xs text-[var(--text-primary)] border border-[var(--app-border)] shadow-sm"
                style={{ background: 'var(--app-panel)' }}
              >
                Try a different name color or font and see it here.
              </div>
            </div>
          </div>

          {/* Dummy Message 2 (Outgoing) */}
          <div className="relative z-10 flex flex-row-reverse items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--app-accent-secondary)] to-[var(--app-accent)] text-white font-bold flex items-center justify-center shrink-0 shadow-sm text-xs">
              You
            </div>
            <div className="flex flex-col items-end">
              <span 
                className="text-xs font-bold mb-1"
                style={{
                  color: senderColor || 'var(--text-secondary)',
                  fontFamily: senderFont ? `'${senderFont}', sans-serif` : 'inherit'
                }}
              >
                You
              </span>
              <div 
                className="p-3 rounded-xl max-w-md text-xs text-white border border-[var(--app-border)] shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, var(--app-accent), var(--app-accent-hover))'
                }}
              >
                Your changes show up here as you make them.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Palette Color Sliders */}
      <div className="p-5 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[var(--app-accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Theme colors</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearCustomOverrides}
              className="text-xs text-[var(--text-secondary)] hover:text-red-400 transition-colors"
            >
              Reset Overrides
            </button>
            <button
              onClick={() => setShowSaveThemeModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold frutiger-btn frutiger-btn-primary text-white flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Save As Custom Theme
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">Start with a palette</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Pick a base, then tune each color below.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {THEME_PALETTES.map(palette => <button key={palette.name} type="button" onClick={() => THEME_COLOR_FIELDS.forEach((field, index) => setCustomOverride(field.key, palette.colors[index]))} className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-2 text-left text-xs font-semibold hover:border-[var(--app-accent)]">
              <span className="flex shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">{palette.colors.slice(0, 4).map(color => <span key={color} className="h-4 w-2.5" style={{ backgroundColor: color }} />)}</span>{palette.name}
            </button>)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEME_COLOR_FIELDS.map(field => {
            const value = readThemeColor(field.key, field.fallback);
            return <label key={field.key} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-2.5">
              <input type="color" value={value} onChange={event => setCustomOverride(field.key, event.target.value)} aria-label={field.label} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-[var(--app-border)] bg-transparent p-0.5" />
              <span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-[var(--text-primary)]">{field.label}</span><span className="block font-mono text-[10px] text-[var(--text-secondary)]">{value}</span></span>
            </label>;
          })}
        </div>

        <div className="grid gap-3 border-t border-[var(--app-border)] pt-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="flex justify-between text-xs font-semibold text-[var(--text-primary)]"><span>Glass blur</span><span className="font-mono text-[var(--text-secondary)]">{panelBlur}</span></span>
            <input type="range" min="0" max="30" value={parseInt(panelBlur, 10) || 0} onChange={event => setCustomOverride('--panel-blur', `${event.target.value}px`)} className="w-full accent-[var(--app-accent)]" />
          </label>
          <label className="space-y-1.5">
            <span className="flex justify-between text-xs font-semibold text-[var(--text-primary)]"><span>Sender name color</span><span className="font-mono text-[var(--text-secondary)]">{senderColor || 'Theme accent'}</span></span>
            <input type="color" value={colorToHex(senderColor || primaryAccent, primaryAccent)} onChange={event => setSenderColor(event.target.value)} aria-label="Sender name color" className="h-9 w-full cursor-pointer rounded-lg border border-[var(--app-border)] bg-transparent p-0.5" />
          </label>
        </div>
      </div>

      {/* User Custom Themes List */}
      {customThemes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--app-accent)]" />
            Your Saved Custom Themes ({customThemes.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {customThemes.map((ct) => (
              <div
                key={ct.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  currentTheme === ct.id ? 'border-[var(--app-accent)] ring-2 ring-[var(--app-accent)]/50 bg-[var(--app-accent)]/10' : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setTheme(ct.id)}
                  className="flex-1 text-left"
                >
                  <p className="font-bold text-xs text-[var(--text-primary)] truncate">{ct.name}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] truncate">{ct.description || 'Custom theme'}</p>
                </button>
                <button
                  type="button"
                  onClick={() => deleteCustomTheme(ct.id)}
                  className="w-7 h-7 rounded-lg hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors ml-2"
                  title="Delete theme"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Custom Theme Modal */}
      <AnimatePresence>
        {showSaveThemeModal && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[var(--app-panel)] rounded-2xl border border-[var(--app-border)] shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-[var(--text-primary)]">Save Custom Theme</h3>
                <button
                  onClick={() => setShowSaveThemeModal(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCustomThemeSave} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                    Theme Name:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Neon Frutiger, Cyber Sunset..."
                    value={newThemeName}
                    onChange={(e) => setNewThemeName(e.target.value)}
                    required
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[var(--bg-input)] text-[var(--text-input)] border border-[var(--border-input)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                    Description:
                  </label>
                  <textarea
                    placeholder="Describe the look and feel of this theme..."
                    value={newThemeDescription}
                    onChange={(e) => setNewThemeDescription(e.target.value)}
                    maxLength={240}
                    rows={3}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[var(--bg-input)] text-[var(--text-input)] border border-[var(--border-input)] focus:outline-none resize-y"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveThemeModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold frutiger-btn frutiger-btn-primary text-white shadow-md"
                  >
                    Save Theme
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Wallpaper Cropper Modal */}
      <ImageCropModal
        isOpen={showWallpaperCropper}
        onClose={() => setShowWallpaperCropper(false)}
        mode="wallpaper"
        initialImage={globalWallpaper?.url || ''}
        targetTitle="Global Chat Wallpaper Studio"
        onApply={(result: CropResult) => {
          setWallpaper('global', {
            url: result.url,
            zoom: result.zoom,
            panX: result.panX,
            panY: result.panY,
            dim: result.dim || 0,
            blur: result.blur || 0,
            texture: !!result.texture
          });
        }}
      />
    </div>
  );
}
