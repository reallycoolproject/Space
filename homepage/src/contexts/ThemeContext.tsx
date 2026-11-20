import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type BuiltInTheme =
  | 'frutiger-aero'
  | 'frutiger-eco'
  | 'frutiger-aurora'
  | 'frutiger-metro'
  | 'frutiger-aqua'
  | 'frutiger-glacier'
  | 'frutiger-solar'
  | 'frutiger-technozen'
  | 'emo-rawr'
  | 'cyber-goth'
  | 'vaporwave'
  | 'scene-queen'
  | 'y2k'
  | 'dormant'
  | 'vector-bloom'
  | 'superflat-pop';

export interface CustomTheme {
  id: string;
  name: string;
  description?: string;
  vars: Record<string, string>;
  elementStyles?: Record<string, ElementStyleRule>;
  wallpapers?: Record<string, WallpaperConfig>;
  senderFont?: string;
  senderColor?: string;
  buttonIcons?: Record<string, string>;
  createdAt: number;
}

export interface WallpaperConfig {
  url: string;
  zoom: number;       // 1.0 to 3.0
  panX: number;       // -50% to 50%
  panY: number;       // -50% to 50%
  dim: number;        // 0 to 80 (percentage)
  blur: number;       // 0 to 25 (px)
  texture: boolean;   // subtle glass / dot texture overlay
}

export interface ElementStyleRule {
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  boxShadow?: string;
  fontFamily?: string;
  fontSize?: string;
  padding?: string;
  letterSpacing?: string;
  textTransform?: string;
  iconUrl?: string;
  opacity?: number;
}

export interface ThemeContextType {
  currentTheme: string;
  isCustomTheme: boolean;
  setTheme: (themeId: string) => void;
  customThemes: CustomTheme[];
  saveCustomTheme: (name: string, vars: Record<string, string>, description?: string) => void;
  deleteCustomTheme: (id: string) => void;
  
  // Custom CSS variables overrides
  customOverrides: Record<string, string>;
  setCustomOverride: (key: string, value: string) => void;
  clearCustomOverrides: () => void;
  
  // Chat Typography & Sender Style
  senderFont: string;
  setSenderFont: (font: string) => void;
  senderColor: string;
  setSenderColor: (color: string) => void;
  loadGoogleFont: (input: string) => string;
  
  // Wallpapers (Global and Per-Chat)
  wallpapers: Record<string, WallpaperConfig>;
  setWallpaper: (chatId: string, config: WallpaperConfig | null) => void;
  getWallpaper: (chatId?: string) => WallpaperConfig | null;
  
  // Painter Mode & Independent Element Styles
  isPainterMode: boolean;
  setIsPainterMode: (active: boolean) => void;
  elementStyles: Record<string, ElementStyleRule>;
  setElementStyle: (elementId: string, rule: ElementStyleRule) => void;
  removeElementStyle: (elementId: string) => void;
  clearAllElementStyles: () => void;
  getElementStyle: (elementId: string) => ElementStyleRule | undefined;
  chatStyles: Record<string, Record<string, ElementStyleRule>>;
  setChatStyle: (chatId: string, role: string, rule: ElementStyleRule) => void;
  clearChatStyles: (chatId: string) => void;
  buttonIcons: Record<string, string>;
  setButtonIcon: (buttonKey: string, iconUrl: string) => void;
  removeButtonIcon: (buttonKey: string) => void;
}

const BUILTIN_THEME_VARS: Record<BuiltInTheme, Record<string, string>> = {
  'frutiger-aero': {
    '--app-bg': '#d6f0ff',
    '--app-surface': 'rgba(255,255,255,0.55)',
    '--app-surface-hover': 'rgba(255,255,255,0.78)',
    '--app-panel': 'rgba(255,255,255,0.72)',
    '--app-border': 'rgba(100,181,246,0.35)',
    '--app-accent': '#0288d1',
    '--app-accent-hover': '#0277bd',
    '--app-accent-secondary': '#76c442',
    '--text-primary': '#0a2540',
    '--text-secondary': '#1b5e91',
    '--bg-input': 'rgba(255,255,255,0.65)',
    '--text-input': '#0a2540',
    '--border-input': 'rgba(100,181,246,0.5)',
    '--glass-bg': 'rgba(255,255,255,0.38)',
    '--glass-border': 'rgba(255,255,255,0.65)',
    '--glass-bg-strong': 'rgba(255,255,255,0.55)',
    '--panel-blur': '20px',
    '--app-panel-backdrop': 'blur(20px) saturate(1.6)',
  },
  'frutiger-eco': {
    '--app-bg': '#e8f5e2',
    '--app-surface': 'rgba(255,255,255,0.58)',
    '--app-surface-hover': 'rgba(255,255,255,0.82)',
    '--app-panel': 'rgba(255,255,255,0.75)',
    '--app-border': 'rgba(104,159,56,0.25)',
    '--app-accent': '#558b2f',
    '--app-accent-hover': '#689f38',
    '--app-accent-secondary': '#f9a825',
    '--text-primary': '#1b3a0e',
    '--text-secondary': '#33691e',
    '--bg-input': 'rgba(255,255,255,0.65)',
    '--text-input': '#1b3a0e',
    '--border-input': 'rgba(104,159,56,0.4)',
    '--glass-bg': 'rgba(255,255,255,0.42)',
    '--glass-border': 'rgba(255,255,255,0.62)',
    '--glass-bg-strong': 'rgba(255,255,255,0.58)',
    '--panel-blur': '20px',
    '--app-panel-backdrop': 'blur(20px) saturate(1.5)',
  },
  'frutiger-aurora': {
    '--app-bg': '#0a0e2a',
    '--app-surface': 'rgba(20,30,70,0.75)',
    '--app-surface-hover': 'rgba(30,45,90,0.85)',
    '--app-panel': 'rgba(15,20,55,0.88)',
    '--app-border': 'rgba(0,255,200,0.18)',
    '--app-accent': '#00e5cc',
    '--app-accent-hover': '#00bfa5',
    '--app-accent-secondary': '#a855f7',
    '--text-primary': '#e8f4ff',
    '--text-secondary': '#82c9e6',
    '--bg-input': 'rgba(20,30,70,0.8)',
    '--text-input': '#e8f4ff',
    '--border-input': 'rgba(0,255,200,0.25)',
    '--glass-bg': 'rgba(0,229,204,0.06)',
    '--glass-border': 'rgba(0,229,204,0.20)',
    '--glass-bg-strong': 'rgba(0,229,204,0.10)',
    '--panel-blur': '24px',
    '--app-panel-backdrop': 'blur(24px) saturate(1.8)',
  },
  'frutiger-metro': {
    '--app-bg': '#1a1a2e',
    '--app-surface': '#0f3460',
    '--app-surface-hover': '#1a4a7a',
    '--app-panel': '#16213e',
    '--app-border': 'rgba(0,153,255,0.18)',
    '--app-accent': '#0099ff',
    '--app-accent-hover': '#33aeff',
    '--app-accent-secondary': '#e91e8c',
    '--text-primary': '#f0f4ff',
    '--text-secondary': '#90b8e2',
    '--bg-input': '#0f3460',
    '--text-input': '#f0f4ff',
    '--border-input': 'rgba(0,153,255,0.3)',
    '--glass-bg': 'rgba(0,153,255,0.06)',
    '--glass-border': 'rgba(0,153,255,0.2)',
    '--glass-bg-strong': 'rgba(0,153,255,0.10)',
    '--panel-blur': '0px',
    '--app-panel-backdrop': 'blur(0px)',
  },
  'frutiger-aqua': {
    '--app-bg': '#eef4fb',
    '--app-surface': 'rgba(255,255,255,0.65)',
    '--app-surface-hover': 'rgba(255,255,255,0.88)',
    '--app-panel': 'rgba(248,252,255,0.82)',
    '--app-border': 'rgba(70,160,220,0.22)',
    '--app-accent': '#3b9eda',
    '--app-accent-hover': '#2585c0',
    '--app-accent-secondary': '#72b93e',
    '--text-primary': '#10243d',
    '--text-secondary': '#245780',
    '--bg-input': 'rgba(255,255,255,0.75)',
    '--text-input': '#10243d',
    '--border-input': 'rgba(70,160,220,0.35)',
    '--glass-bg': 'rgba(255,255,255,0.50)',
    '--glass-border': 'rgba(255,255,255,0.72)',
    '--glass-bg-strong': 'rgba(255,255,255,0.68)',
    '--panel-blur': '16px',
    '--app-panel-backdrop': 'blur(16px) saturate(1.4)',
  },
  'frutiger-glacier': {
    '--app-bg': '#e6f4fa',
    '--app-surface': 'rgba(255,255,255,0.72)',
    '--app-surface-hover': 'rgba(255,255,255,0.92)',
    '--app-panel': 'rgba(240,250,255,0.85)',
    '--app-border': 'rgba(140,210,245,0.4)',
    '--app-accent': '#0ea5e9',
    '--app-accent-hover': '#0284c7',
    '--app-accent-secondary': '#67e8f9',
    '--text-primary': '#0c2838',
    '--text-secondary': '#1d5a7a',
    '--bg-input': 'rgba(255,255,255,0.8)',
    '--text-input': '#0c2838',
    '--border-input': 'rgba(140,210,245,0.5)',
    '--glass-bg': 'rgba(255,255,255,0.55)',
    '--glass-border': 'rgba(255,255,255,0.8)',
    '--glass-bg-strong': 'rgba(255,255,255,0.75)',
    '--panel-blur': '20px',
    '--app-panel-backdrop': 'blur(20px) saturate(1.6)',
  },
  'frutiger-solar': {
    '--app-bg': '#fef7e6',
    '--app-surface': 'rgba(255,255,255,0.75)',
    '--app-surface-hover': 'rgba(255,255,255,0.92)',
    '--app-panel': 'rgba(255,250,238,0.85)',
    '--app-border': 'rgba(245,158,11,0.3)',
    '--app-accent': '#d97706',
    '--app-accent-hover': '#b45309',
    '--app-accent-secondary': '#10b981',
    '--text-primary': '#351f03',
    '--text-secondary': '#78490a',
    '--bg-input': 'rgba(255,255,255,0.82)',
    '--text-input': '#351f03',
    '--border-input': 'rgba(245,158,11,0.45)',
    '--glass-bg': 'rgba(255,255,255,0.55)',
    '--glass-border': 'rgba(255,255,255,0.8)',
    '--glass-bg-strong': 'rgba(255,255,255,0.72)',
    '--panel-blur': '18px',
    '--app-panel-backdrop': 'blur(18px) saturate(1.5)',
  },
  'frutiger-technozen': {
    '--app-bg': '#edf2f0',
    '--app-surface': 'rgba(255,255,255,0.72)',
    '--app-surface-hover': 'rgba(255,255,255,0.90)',
    '--app-panel': 'rgba(244,248,246,0.85)',
    '--app-border': 'rgba(74,133,109,0.28)',
    '--app-accent': '#2d7a5b',
    '--app-accent-hover': '#205c44',
    '--app-accent-secondary': '#5c9c82',
    '--text-primary': '#142921',
    '--text-secondary': '#325749',
    '--bg-input': 'rgba(255,255,255,0.8)',
    '--text-input': '#142921',
    '--border-input': 'rgba(74,133,109,0.38)',
    '--glass-bg': 'rgba(255,255,255,0.52)',
    '--glass-border': 'rgba(255,255,255,0.75)',
    '--glass-bg-strong': 'rgba(255,255,255,0.7)',
    '--panel-blur': '16px',
    '--app-panel-backdrop': 'blur(16px) saturate(1.4)',
  },
  'emo-rawr': {
    '--app-bg': '#0d0d0f',
    '--app-surface': 'rgba(24, 24, 30, 0.92)',
    '--app-surface-hover': 'rgba(36, 36, 45, 0.95)',
    '--app-panel': 'rgba(18, 18, 24, 0.95)',
    '--app-border': 'rgba(255, 20, 147, 0.35)',
    '--app-accent': '#ff1493',
    '--app-accent-hover': '#ff40a8',
    '--app-accent-secondary': '#00f5ff',
    '--text-primary': '#ffffff',
    '--text-secondary': '#f096c8',
    '--bg-input': 'rgba(20, 20, 28, 0.95)',
    '--text-input': '#ffffff',
    '--border-input': 'rgba(255, 20, 147, 0.5)',
    '--glass-bg': 'rgba(255, 20, 147, 0.08)',
    '--glass-border': 'rgba(255, 20, 147, 0.3)',
    '--glass-bg-strong': 'rgba(255, 20, 147, 0.15)',
    '--panel-blur': '16px',
    '--app-panel-backdrop': 'blur(16px) saturate(1.8)',
  },
  'cyber-goth': {
    '--app-bg': '#09080c',
    '--app-surface': 'rgba(20, 16, 26, 0.92)',
    '--app-surface-hover': 'rgba(32, 25, 42, 0.95)',
    '--app-panel': 'rgba(15, 12, 20, 0.95)',
    '--app-border': 'rgba(229, 9, 20, 0.35)',
    '--app-accent': '#e50914',
    '--app-accent-hover': '#ff2e3a',
    '--app-accent-secondary': '#a855f7',
    '--text-primary': '#ffffff',
    '--text-secondary': '#e0a0b8',
    '--bg-input': 'rgba(18, 14, 24, 0.95)',
    '--text-input': '#ffffff',
    '--border-input': 'rgba(229, 9, 20, 0.45)',
    '--glass-bg': 'rgba(229, 9, 20, 0.08)',
    '--glass-border': 'rgba(229, 9, 20, 0.28)',
    '--glass-bg-strong': 'rgba(229, 9, 20, 0.14)',
    '--panel-blur': '16px',
    '--app-panel-backdrop': 'blur(16px) saturate(1.8)',
  },
  'vaporwave': {
    '--app-bg': '#1a102a',
    '--app-surface': 'rgba(38, 24, 58, 0.90)',
    '--app-surface-hover': 'rgba(52, 34, 78, 0.94)',
    '--app-panel': 'rgba(26, 16, 42, 0.94)',
    '--app-border': 'rgba(0, 240, 255, 0.25)',
    '--app-accent': '#00f0ff',
    '--app-accent-hover': '#38f5ff',
    '--app-accent-secondary': '#ff7a90',
    '--text-primary': '#fdf9ff',
    '--text-secondary': '#cbb8e8',
    '--bg-input': 'rgba(32, 20, 50, 0.92)',
    '--text-input': '#fdf9ff',
    '--border-input': 'rgba(0, 240, 255, 0.4)',
    '--glass-bg': 'rgba(0, 240, 255, 0.06)',
    '--glass-border': 'rgba(0, 240, 255, 0.22)',
    '--glass-bg-strong': 'rgba(0, 240, 255, 0.12)',
    '--panel-blur': '18px',
    '--app-panel-backdrop': 'blur(18px) saturate(1.8)',
  },
  'scene-queen': {
    '--app-bg': '#0a0d0a',
    '--app-surface': 'rgba(16, 26, 16, 0.92)',
    '--app-surface-hover': 'rgba(24, 38, 24, 0.95)',
    '--app-panel': 'rgba(12, 20, 12, 0.95)',
    '--app-border': 'rgba(57, 255, 20, 0.35)',
    '--app-accent': '#39ff14',
    '--app-accent-hover': '#5fff3d',
    '--app-accent-secondary': '#ff007f',
    '--text-primary': '#ffffff',
    '--text-secondary': '#8cf77e',
    '--bg-input': 'rgba(14, 22, 14, 0.95)',
    '--text-input': '#ffffff',
    '--border-input': 'rgba(57, 255, 20, 0.45)',
    '--glass-bg': 'rgba(57, 255, 20, 0.08)',
    '--glass-border': 'rgba(57, 255, 20, 0.28)',
    '--glass-bg-strong': 'rgba(57, 255, 20, 0.14)',
    '--panel-blur': '16px',
    '--app-panel-backdrop': 'blur(16px) saturate(1.8)',
  },
  'y2k': {
    '--app-bg': '#08080f',
    '--app-surface': '#0a0a18',
    '--app-surface-hover': '#111128',
    '--app-panel': '#0d0d1a',
    '--app-border': 'rgba(0,240,255,0.25)',
    '--app-accent': '#00f0ff',
    '--app-accent-hover': '#00d4e8',
    '--app-accent-secondary': '#ff00c8',
    '--text-primary': '#f0fbff',
    '--text-secondary': '#4de3ff',
    '--bg-input': '#0a0a16',
    '--text-input': '#f0fbff',
    '--border-input': 'rgba(0,240,255,0.35)',
    '--glass-bg': 'rgba(0,240,255,0.04)',
    '--glass-border': 'rgba(0,240,255,0.25)',
    '--glass-bg-strong': 'rgba(0,240,255,0.08)',
    '--panel-blur': '12px',
    '--app-panel-backdrop': 'blur(12px) saturate(1.8)',
  },
  'dormant': {
    '--app-bg': '#0c1220',
    '--app-surface': 'rgba(18,28,52,0.85)',
    '--app-surface-hover': 'rgba(26,40,74,0.92)',
    '--app-panel': 'rgba(14,22,42,0.92)',
    '--app-border': 'rgba(56,139,253,0.18)',
    '--app-accent': '#388bfd',
    '--app-accent-hover': '#58a6ff',
    '--app-accent-secondary': '#bc8cff',
    '--text-primary': '#e2ecfa',
    '--text-secondary': '#7e9ec7',
    '--bg-input': 'rgba(18,30,58,0.88)',
    '--text-input': '#e2ecfa',
    '--border-input': 'rgba(56,139,253,0.22)',
    '--glass-bg': 'rgba(56,139,253,0.05)',
    '--glass-border': 'rgba(56,139,253,0.18)',
    '--glass-bg-strong': 'rgba(56,139,253,0.09)',
    '--panel-blur': '20px',
    '--app-panel-backdrop': 'blur(20px) saturate(1.5)',
  },
  'vector-bloom': {
    '--app-bg': '#fff0f8',
    '--app-surface': 'rgba(255,255,255,0.60)',
    '--app-surface-hover': 'rgba(255,255,255,0.86)',
    '--app-panel': 'rgba(255,255,255,0.78)',
    '--app-border': 'rgba(240,100,180,0.20)',
    '--app-accent': '#e0529c',
    '--app-accent-hover': '#c93e88',
    '--app-accent-secondary': '#a78bfa',
    '--text-primary': '#2b0821',
    '--text-secondary': '#872864',
    '--bg-input': 'rgba(255,255,255,0.68)',
    '--text-input': '#2b0821',
    '--border-input': 'rgba(240,100,180,0.32)',
    '--glass-bg': 'rgba(255,255,255,0.45)',
    '--glass-border': 'rgba(255,255,255,0.68)',
    '--glass-bg-strong': 'rgba(255,255,255,0.62)',
    '--panel-blur': '20px',
    '--app-panel-backdrop': 'blur(20px) saturate(1.5)',
  },
  'superflat-pop': {
    '--app-bg': '#ffe8f5',
    '--app-surface': '#ffe0f0',
    '--app-surface-hover': '#ffd0e8',
    '--app-panel': '#fff0fa',
    '--app-border': 'rgba(255,0,128,0.22)',
    '--app-accent': '#ff0080',
    '--app-accent-hover': '#e6006d',
    '--app-accent-secondary': '#ffe600',
    '--text-primary': '#1f0214',
    '--text-secondary': '#9e0050',
    '--bg-input': '#fff5fb',
    '--text-input': '#1f0214',
    '--border-input': 'rgba(255,0,128,0.35)',
    '--glass-bg': 'rgba(255,0,128,0.06)',
    '--glass-border': 'rgba(255,0,128,0.22)',
    '--glass-bg-strong': 'rgba(255,0,128,0.10)',
    '--panel-blur': '0px',
    '--app-panel-backdrop': 'blur(0px)',
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => {
    const cleanupKey = 'space_custom_theme_cleanup_v1';
    if (localStorage.getItem(cleanupKey) !== 'complete') {
      localStorage.setItem('space_custom_themes', '[]');
      localStorage.setItem('space_theme_overrides', '{}');
      localStorage.setItem('space_element_styles', '{}');
      localStorage.setItem('space_button_icons', '{}');
      if (localStorage.getItem('theme')?.startsWith('custom-')) {
        localStorage.setItem('theme', 'frutiger-metro');
      }
      localStorage.setItem(cleanupKey, 'complete');
      return [];
    }

    try {
      const stored = localStorage.getItem('space_custom_themes');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [currentTheme, setCurrentThemeState] = useState<string>(() => {
    return localStorage.getItem('theme') || 'frutiger-metro';
  });

  const [customOverrides, setCustomOverrides] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('space_theme_overrides');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [senderFont, setSenderFontState] = useState<string>(() => {
    return localStorage.getItem('space_chat_sender_font') || '';
  });

  const [senderColor, setSenderColorState] = useState<string>(() => {
    return localStorage.getItem('space_chat_sender_color') || '';
  });

  const [wallpapers, setWallpapers] = useState<Record<string, WallpaperConfig>>(() => {
    try {
      const stored = localStorage.getItem('space_chat_wallpapers');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [isPainterMode, setIsPainterMode] = useState<boolean>(false);

  const [elementStyles, setElementStyles] = useState<Record<string, ElementStyleRule>>(() => {
    try {
      const stored = localStorage.getItem('space_element_styles');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [chatStyles, setChatStyles] = useState<Record<string, Record<string, ElementStyleRule>>>(() => {
    try {
      const stored = localStorage.getItem('space_chat_styles');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [buttonIcons, setButtonIcons] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('space_button_icons');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Extract and load Google Font dynamically
  const loadGoogleFont = useCallback((input: string): string => {
    if (!input || !input.trim()) return '';
    let fontName = input.trim();
    let urlToLoad = '';

    // If full HTML link or import
    if (input.includes('fonts.googleapis.com')) {
      const hrefMatch = input.match(/href=["']([^"']+)["']/);
      const urlMatch = input.match(/url\(['"]?([^'"\)]+)['"]?\)/);
      if (hrefMatch) urlToLoad = hrefMatch[1];
      else if (urlMatch) urlToLoad = urlMatch[1];
      else if (input.startsWith('http')) urlToLoad = input;

      const familyMatch = input.match(/family=([^&:]+)/);
      if (familyMatch) {
        fontName = decodeURIComponent(familyMatch[1]).replace(/\+/g, ' ');
      }
    } else {
      // Just a font name like "Press Start 2P" or "VT323"
      urlToLoad = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName.replace(/['"]/g, ''))}:wght@400;700&display=swap`;
    }

    if (urlToLoad && typeof document !== 'undefined') {
      const linkId = `google-font-${fontName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = urlToLoad;
        document.head.appendChild(link);
      }
    }

    return fontName;
  }, []);

  // Synchronize CSS custom properties whenever theme, overrides, typography changes
  const applyAllStyles = useCallback(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // 1. Determine base variables
    let baseVars: Record<string, string> = {};
    if (currentTheme in BUILTIN_THEME_VARS) {
      baseVars = BUILTIN_THEME_VARS[currentTheme as BuiltInTheme];
      root.setAttribute('data-theme', currentTheme);
    } else {
      const custom = customThemes.find(ct => ct.id === currentTheme);
      if (custom) {
        baseVars = custom.vars;
        root.setAttribute('data-theme', 'custom');
      } else {
        baseVars = BUILTIN_THEME_VARS['frutiger-metro'];
        root.setAttribute('data-theme', 'frutiger-metro');
      }
    }

    // Apply base vars
    Object.entries(baseVars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });

    // 2. Apply live overrides
    Object.entries(customOverrides).forEach(([key, val]) => {
      if (val) root.style.setProperty(key, val);
    });

    // 3. Apply sender font & color
    if (senderFont) {
      const cleanFont = senderFont.includes(',') ? senderFont : `'${senderFont}', sans-serif`;
      root.style.setProperty('--chat-sender-font', cleanFont);
    } else {
      root.style.removeProperty('--chat-sender-font');
    }

    if (senderColor) {
      root.style.setProperty('--chat-sender-color', senderColor);
    } else {
      root.style.removeProperty('--chat-sender-color');
    }
  }, [currentTheme, customThemes, customOverrides, senderFont, senderColor]);

  useEffect(() => {
    applyAllStyles();
  }, [applyAllStyles]);

  // Load active sender font if saved
  useEffect(() => {
    if (senderFont) {
      loadGoogleFont(senderFont);
    }
  }, [senderFont, loadGoogleFont]);

  useEffect(() => {
    const styleId = 'space-element-custom-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    const declarations: Record<keyof ElementStyleRule, string> = {
      backgroundColor: 'background-color',
      backgroundGradient: 'background-image',
      backgroundImage: 'background-image',
      textColor: 'color',
      borderColor: 'border-color',
      borderWidth: 'border-width',
      borderRadius: 'border-radius',
      boxShadow: 'box-shadow',
      fontFamily: 'font-family',
      fontSize: 'font-size',
      padding: 'padding',
      letterSpacing: 'letter-spacing',
      textTransform: 'text-transform',
      iconUrl: 'background-image',
      opacity: 'opacity'
    };

    styleElement.textContent = Object.entries(elementStyles).map(([selector, rule]) => {
      const probe = document.createElement('span').style;
      const properties: string[] = [];

      Object.entries(rule).forEach(([key, rawValue]) => {
        if (key === 'iconUrl') return;
        if (key === 'backgroundGradient' && rule.backgroundImage) return;
        if (key === 'backgroundImage') return;
        const property = declarations[key as keyof ElementStyleRule];
        if (!property || rawValue === undefined || rawValue === '') return;
        const value = String(rawValue);
        if (typeof CSS !== 'undefined' && CSS.supports(property, value)) {
          probe.setProperty(property, value);
          properties.push(`${property}:${probe.getPropertyValue(property)} !important`);
        }
      });

      const backgroundImage = rule.backgroundImage && /^(https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(rule.backgroundImage)
        ? `url(${JSON.stringify(rule.backgroundImage)})`
        : '';
      const gradient = rule.backgroundGradient && typeof CSS !== 'undefined' && CSS.supports('background-image', rule.backgroundGradient)
        ? rule.backgroundGradient
        : '';
      if (backgroundImage || gradient) {
        properties.push(`background-image:${[gradient, backgroundImage].filter(Boolean).join(',')} !important`);
      }

      if (rule.iconUrl && /^(https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(rule.iconUrl)) {
        const safeUrl = JSON.stringify(rule.iconUrl);
        properties.push(`${selector} svg{display:none !important}`);
        properties.push(`${selector}::after{content:"";display:inline-block;width:1em;height:1em;margin-inline-start:.35em;vertical-align:middle;background-image:url(${safeUrl});background-position:center;background-repeat:no-repeat;background-size:contain}`);
      }

      const elementProperties = properties.filter(property => !property.startsWith(`${selector} `) && !property.startsWith(`${selector}::`));
      const iconRules = properties.filter(property => property.startsWith(`${selector} `) || property.startsWith(`${selector}::`));
      return properties.length ? `${selector}{${elementProperties.join(';')}}${iconRules.join('')}` : '';
    }).join('\n');

    return () => {
      if (styleElement?.textContent === '') styleElement.remove();
    };
  }, [elementStyles]);

  useEffect(() => {
    const styleId = 'space-chat-custom-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = Object.entries(chatStyles).flatMap(([chatId, roles]) =>
      Object.entries(roles).map(([role, rule]) => {
        const selector = `[data-chat-room="${CSS.escape(chatId)}"] [data-painter-role="${CSS.escape(role)}"]`;
        const probe = document.createElement('span').style;
        const properties: string[] = [];
        const values: Array<[keyof ElementStyleRule, string, string | number | undefined]> = [
          ['backgroundColor', 'background-color', rule.backgroundColor],
          ['textColor', 'color', rule.textColor],
          ['borderColor', 'border-color', rule.borderColor],
          ['borderWidth', 'border-width', rule.borderWidth],
          ['borderRadius', 'border-radius', rule.borderRadius],
          ['boxShadow', 'box-shadow', rule.boxShadow],
          ['opacity', 'opacity', rule.opacity]
        ];
        values.forEach(([key, property, rawValue]) => {
          if (rawValue === undefined || rawValue === '') return;
          if (key === 'backgroundColor' && rule.backgroundGradient) return;
          const value = String(rawValue);
          if (CSS.supports(property, value)) {
            probe.setProperty(property, value);
            properties.push(`${property}:${probe.getPropertyValue(property)} !important`);
          }
        });
        if (rule.backgroundGradient && CSS.supports('background-image', rule.backgroundGradient)) {
          properties.push(`background-image:${rule.backgroundGradient} !important`);
        }
        return properties.length ? `${selector}{${properties.join(';')}}` : '';
      })
    ).join('\n');

    return () => {
      if (styleElement?.textContent === '') styleElement.remove();
    };
  }, [chatStyles]);

  const setTheme = useCallback((themeId: string) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      Object.keys(customOverrides).forEach(key => root.style.removeProperty(key));
    }
    setCurrentThemeState(themeId);
    localStorage.setItem('theme', themeId);
    setCustomOverrides({});
    localStorage.setItem('space_theme_overrides', '{}');
    const savedTheme = customThemes.find(theme => theme.id === themeId);
    if (savedTheme) {
      const nextElementStyles = savedTheme.elementStyles || {};
      const nextWallpapers = { ...wallpapers };
      if (savedTheme.wallpapers?.global) nextWallpapers.global = savedTheme.wallpapers.global;
      else delete nextWallpapers.global;
      const nextSenderFont = savedTheme.senderFont || '';
      const nextSenderColor = savedTheme.senderColor || '';
      const nextButtonIcons = savedTheme.buttonIcons || {};
      setElementStyles(nextElementStyles);
      setWallpapers(nextWallpapers);
      setSenderFontState(nextSenderFont);
      setSenderColorState(nextSenderColor);
      setButtonIcons(nextButtonIcons);
      localStorage.setItem('space_element_styles', JSON.stringify(nextElementStyles));
      localStorage.setItem('space_chat_wallpapers', JSON.stringify(nextWallpapers));
      localStorage.setItem('space_chat_sender_font', nextSenderFont);
      localStorage.setItem('space_chat_sender_color', nextSenderColor);
      localStorage.setItem('space_button_icons', JSON.stringify(nextButtonIcons));
    }
  }, [customOverrides, customThemes, wallpapers]);

  const saveCustomTheme = useCallback((name: string, vars: Record<string, string>, description = '') => {
    const newTheme: CustomTheme = {
      id: `custom-${Date.now()}`,
      name,
      description,
      vars: { ...vars, ...customOverrides },
      elementStyles: { ...elementStyles },
      wallpapers: wallpapers.global ? { global: wallpapers.global } : {},
      senderFont,
      senderColor,
      buttonIcons: { ...buttonIcons },
      createdAt: Date.now()
    };
    setCustomThemes(prev => {
      const updated = [...prev, newTheme];
      localStorage.setItem('space_custom_themes', JSON.stringify(updated));
      return updated;
    });
    setTheme(newTheme.id);
  }, [buttonIcons, customOverrides, elementStyles, senderColor, senderFont, setTheme, wallpapers]);

  const deleteCustomTheme = useCallback((id: string) => {
    setCustomThemes(prev => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem('space_custom_themes', JSON.stringify(updated));
      return updated;
    });
    if (currentTheme === id) {
      setTheme('frutiger-aero');
    }
  }, [currentTheme, setTheme]);

  const setCustomOverride = useCallback((key: string, value: string) => {
    setCustomOverrides(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('space_theme_overrides', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearCustomOverrides = useCallback(() => {
    setCustomOverrides({});
    localStorage.removeItem('space_theme_overrides');
    // Clear inline style properties on root
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      Object.keys(customOverrides).forEach(key => root.style.removeProperty(key));
    }
  }, [customOverrides]);

  const setSenderFont = useCallback((font: string) => {
    const loadedFont = loadGoogleFont(font);
    setSenderFontState(loadedFont);
    localStorage.setItem('space_chat_sender_font', loadedFont);
  }, [loadGoogleFont]);

  const setSenderColor = useCallback((color: string) => {
    setSenderColorState(color);
    localStorage.setItem('space_chat_sender_color', color);
  }, []);

  const setWallpaper = useCallback((chatId: string, config: WallpaperConfig | null) => {
    setWallpapers(prev => {
      const next = { ...prev };
      if (!config) {
        delete next[chatId];
      } else {
        next[chatId] = config;
      }
      localStorage.setItem('space_chat_wallpapers', JSON.stringify(next));
      return next;
    });
  }, []);

  const getWallpaper = useCallback((chatId?: string): WallpaperConfig | null => {
    if (chatId && wallpapers[chatId]) {
      return wallpapers[chatId];
    }
    return wallpapers['global'] || null;
  }, [wallpapers]);

  const setButtonIcon = useCallback((buttonKey: string, iconUrl: string) => {
    setButtonIcons(prev => {
      const next = { ...prev, [buttonKey]: iconUrl };
      localStorage.setItem('space_button_icons', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeButtonIcon = useCallback((buttonKey: string) => {
    setButtonIcons(prev => {
      const next = { ...prev };
      delete next[buttonKey];
      localStorage.setItem('space_button_icons', JSON.stringify(next));
      return next;
    });
  }, []);

  const setElementStyle = useCallback((elementId: string, rule: ElementStyleRule) => {
    setElementStyles(prev => {
      const next = { ...prev, [elementId]: rule };
      localStorage.setItem('space_element_styles', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeElementStyle = useCallback((elementId: string) => {
    setElementStyles(prev => {
      const next = { ...prev };
      delete next[elementId];
      localStorage.setItem('space_element_styles', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAllElementStyles = useCallback(() => {
    setElementStyles({});
    localStorage.removeItem('space_element_styles');
  }, []);

  const getElementStyle = useCallback((elementId: string) => elementStyles[elementId], [elementStyles]);

  const setChatStyle = useCallback((chatId: string, role: string, rule: ElementStyleRule) => {
    setChatStyles(prev => {
      const next = { ...prev, [chatId]: { ...prev[chatId], [role]: rule } };
      localStorage.setItem('space_chat_styles', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearChatStyles = useCallback((chatId: string) => {
    setChatStyles(prev => {
      const next = { ...prev };
      delete next[chatId];
      localStorage.setItem('space_chat_styles', JSON.stringify(next));
      return next;
    });
  }, []);

  const isCustomTheme = !BUILTIN_THEME_VARS[currentTheme as BuiltInTheme];

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        isCustomTheme,
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
        isPainterMode,
        setIsPainterMode,
        elementStyles,
        setElementStyle,
        removeElementStyle,
        clearAllElementStyles,
        getElementStyle,
        chatStyles,
        setChatStyle,
        clearChatStyles,
        buttonIcons,
        setButtonIcon,
        removeButtonIcon
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeCustomization() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeCustomization must be used within a ThemeProvider');
  }
  return context;
}
