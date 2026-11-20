import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User as UserIcon, Palette, Bell, LogOut, Shield, Lock, Eye, Trash2, Download, UserMinus, Check, Sparkles, Zap, Leaf, Moon, Globe, Layers, Flower2, Star, Sliders, Type, Sun, Flame, Copy, Key, LifeBuoy, MessageSquareQuote, Compass, Crown, Link2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { deriveKeyFromPassword, encryptPrivateKey } from '../utils/crypto'
import { API_BASE } from '../config'
import { UserBadgesList } from './common/ProfileBadge'
import { ThemeStudio } from './theme/ThemeStudio'
import { ImageCropModal, type CropResult } from './common/ImageCropModal'
import { AvatarChooserModal } from './common/AvatarChooserModal'
import { useThemeCustomization } from '../contexts/ThemeContext'
import { ConnectionsSettingsTab } from './connections/ConnectionsSettingsTab'

export const SPACE_GRADIENT_PRESETS = [
  { name: 'Cosmic Ocean', color1: '#0099ff', color2: '#7928ca', angle: 135 },
  { name: 'Solar Flare', color1: '#ff512f', color2: '#f09819', angle: 135 },
  { name: 'Emerald Aurora', color1: '#059669', color2: '#10b981', angle: 135 },
  { name: 'Neon Cyber', color1: '#00f0ff', color2: '#ff007f', angle: 135 },
  { name: 'Deep Midnight', color1: '#0f172a', color2: '#334155', angle: 135 },
  { name: 'Pastel Dream', color1: '#f472b6', color2: '#a78bfa', angle: 135 },
  { name: 'Y2K Aqua', color1: '#38bdf8', color2: '#2dd4bf', angle: 135 },
  { name: 'Royal Velvet', color1: '#4f46e5', color2: '#9333ea', angle: 135 },
]

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  user?: any
  token?: string
  onProfileUpdate?: (user: any) => void
}

type Tab = 'profile' | 'connections' | 'appearance' | 'theme-studio' | 'notifications' | 'privacy' | 'account'
type NotificationPreferences = { messages: boolean; sound: boolean; desktop: boolean; friendRequests: boolean }
const NOTIFICATION_STORAGE_KEYS: Record<keyof NotificationPreferences, string> = {
  messages: 'messageNotifications',
  sound: 'soundEnabled',
  desktop: 'desktopNotifications',
  friendRequests: 'friendRequestNotifications'
}

type Theme =
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
  | 'superflat-pop'

interface ThemeConfig {
  id: Theme
  name: string
  description: string
  icon: React.ReactNode
  preview: { bg: string; panel: string; accent: string; text: string }
  category: 'frutiger' | 'retro' | 'specialty' | 'studio'
  tag?: string
}

const THEMES: ThemeConfig[] = [
  {
    id: 'frutiger-aero',
    name: 'Frutiger Aero',
    description: 'Lush cyan skies, liquid droplets, and glossy glass panels inspired by Windows Vista & 7.',
    icon: <Sparkles className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #b3e5fc, #e1f5fe)', panel: 'rgba(255,255,255,0.7)', accent: '#0288d1', text: '#0a2540' },
    category: 'frutiger',
    tag: 'Glass'
  },
  {
    id: 'frutiger-eco',
    name: 'Frutiger Eco',
    description: 'Breezy grassy hills, solar greens, and organic glass from late-2000s eco-tech.',
    icon: <Leaf className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #c8e6c9, #dcedc8)', panel: 'rgba(255,255,255,0.7)', accent: '#558b2f', text: '#1b3a0e' },
    category: 'frutiger',
    tag: 'Nature'
  },
  {
    id: 'frutiger-aurora',
    name: 'Frutiger Aurora',
    description: 'Deep midnight indigo with glowing emerald and cyan auroras shimmering across glass.',
    icon: <Compass className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #0a0e2a, #1a0533)', panel: 'rgba(15,20,55,0.88)', accent: '#00e5cc', text: '#e8f4ff' },
    category: 'frutiger',
    tag: 'Dark'
  },
  {
    id: 'frutiger-metro',
    name: 'Frutiger Metro',
    description: 'High-contrast cobalt tiles and sharp electric cyan accents inspired by Windows Phone and Metro UI.',
    icon: <Layers className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #1a1a2e, #0f3460)', panel: '#16213e', accent: '#0099ff', text: '#f0f4ff' },
    category: 'frutiger',
    tag: 'Default'
  },
  {
    id: 'frutiger-aqua',
    name: 'Frutiger Aqua',
    description: 'Glossy jelly buttons, crystal glass panels, and brushed platinum from classic OS X Aqua.',
    icon: <Globe className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(160deg, #ddeeff, #eef4fb)', panel: 'rgba(248,252,255,0.82)', accent: '#3b9eda', text: '#10243d' },
    category: 'frutiger',
    tag: 'Gloss'
  },
  {
    id: 'frutiger-glacier',
    name: 'Frutiger Glacier',
    description: 'Frost crystals, crisp arctic ice glass, and clean diamond whites.',
    icon: <Sparkles className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #e6f4fa, #cceeff)', panel: 'rgba(240,250,255,0.85)', accent: '#0ea5e9', text: '#0c2838' },
    category: 'frutiger',
    tag: 'Frost'
  },
  {
    id: 'frutiger-solar',
    name: 'Frutiger Solar',
    description: 'Solarpunk optimism, citrus sunlight, amber glass, and bright meadow green.',
    icon: <Sun className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #fef7e6, #fff3cc)', panel: 'rgba(255,250,238,0.85)', accent: '#d97706', text: '#351f03' },
    category: 'frutiger',
    tag: 'Solar'
  },
  {
    id: 'frutiger-technozen',
    name: 'Frutiger Technozen',
    description: 'Zen garden serenity: smooth river pebbles, tranquil bamboo slate, and rain glass.',
    icon: <Leaf className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #edf2f0, #dce8e3)', panel: 'rgba(244,248,246,0.85)', accent: '#2d7a5b', text: '#142921' },
    category: 'frutiger',
    tag: 'Zen'
  },
  {
    id: 'emo-rawr',
    name: 'Emo / Rawr XD',
    description: 'Mid-2000s MySpace era: obsidian black, neon hot pink, electric blue, and rawr nostalgia.',
    icon: <Flame className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #0d0d0f, #220818)', panel: 'rgba(18, 18, 24, 0.95)', accent: '#ff1493', text: '#ffffff' },
    category: 'retro',
    tag: 'Scene'
  },
  {
    id: 'cyber-goth',
    name: 'Cyber Goth',
    description: 'Obsidian midnight, industrial blood crimson, and glowing ultraviolet cyber-luminescence.',
    icon: <Moon className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #09080c, #1a0508)', panel: 'rgba(15, 12, 20, 0.95)', accent: '#e50914', text: '#ffffff' },
    category: 'retro',
    tag: 'Goth'
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave Mallsoft',
    description: '90s mall nostalgia, dusty violet sunset, pastel peach, and vintage Arizona iced-tea teal.',
    icon: <Zap className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #1a102a, #281442)', panel: 'rgba(26, 16, 42, 0.94)', accent: '#00f0ff', text: '#fdf9ff' },
    category: 'retro',
    tag: 'Vapor'
  },
  {
    id: 'scene-queen',
    name: 'Scene Queen 2008',
    description: 'Neon electric lime, radioactive magenta, and loud early-web cyber sparkles.',
    icon: <Crown className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #0a0d0a, #1a0a1a)', panel: 'rgba(12, 20, 12, 0.95)', accent: '#39ff14', text: '#ffffff' },
    category: 'specialty',
    tag: 'Neon'
  },
  {
    id: 'y2k',
    name: 'Y2K / Techno',
    description: 'Late 90s cyber-glow, liquid metallic chrome, and electric cyan lines inspired by year 2000 tech.',
    icon: <Zap className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #08080f, #0d0d2a)', panel: '#0d0d1a', accent: '#00f0ff', text: '#f0fbff' },
    category: 'retro',
    tag: 'Neon'
  },
  {
    id: 'dormant',
    name: 'Dormant',
    description: 'Dark Frutiger Aero — deep navy glass with subtle luminescent blue edges for easy nighttime reading.',
    icon: <Moon className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #0c1220, #0e1a34)', panel: 'rgba(14,22,42,0.92)', accent: '#388bfd', text: '#e2ecfa' },
    category: 'retro',
    tag: 'Dark'
  },
  {
    id: 'vector-bloom',
    name: 'Vector Bloom',
    description: 'Soft vector pastels, blooming coral petals, and dreamy lavender gradients.',
    icon: <Flower2 className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #ffe0f4, #f5e6ff)', panel: 'rgba(255,255,255,0.78)', accent: '#e0529c', text: '#2b0821' },
    category: 'specialty',
    tag: 'Pastel'
  },
  {
    id: 'superflat-pop',
    name: 'Superflat Pop',
    description: 'Bold superflat pop art with vibrant magenta surfaces and hyper-saturated accents.',
    icon: <Palette className="w-4 h-4" />,
    preview: { bg: 'linear-gradient(135deg, #ffe8f5, #fff0d0)', panel: '#fff0fa', accent: '#ff0080', text: '#1f0214' },
    category: 'specialty',
    tag: 'Pop Art'
  },
]

const THEME_VARS: Record<Theme, Record<string, string>> = {
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
    '--app-surface': 'rgba(18,28,54,0.82)',
    '--app-surface-hover': 'rgba(26,40,72,0.90)',
    '--app-panel': 'rgba(14,22,42,0.92)',
    '--app-border': 'rgba(56,139,253,0.15)',
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
}

const CATEGORY_LABELS = {
  frutiger: 'Frutiger Family',
  retro: 'Y2K & Retro',
  specialty: 'Specialty',
}

export default function SettingsModal({ isOpen, onClose, user, token, onProfileUpdate }: SettingsModalProps) {
  const { logout, setUser, privateKey } = useAuth()
  const { customThemes, setTheme: applySavedTheme } = useThemeCustomization()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [developerMode, setDeveloperMode] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('developerMode') === 'true')
  const [theme, setTheme] = useState<Theme>('frutiger-aero')
  const [hoveredTheme, setHoveredTheme] = useState<Theme | null>(null)
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(() => {
    return typeof window !== 'undefined' && window.localStorage.getItem('show_formatting_toolbar') === 'true'
  })

  const toggleFormattingToolbar = (enabled: boolean) => {
    setShowFormattingToolbar(enabled)
    window.localStorage.setItem('show_formatting_toolbar', String(enabled))
    window.dispatchEvent(new Event('formatting_toolbar_toggle'))
  }

  const initialDisplayName = user?.displayName || ''
  const initialBio = user?.bio || ''
  const initialAvatar = user?.avatar || ''
  const initialBanner = user?.banner || ''
  const initialColor1 = user?.themeGradient?.color1 || '#0099ff'
  const initialColor2 = user?.themeGradient?.color2 || '#7928ca'
  const initialAngle = user?.themeGradient?.angle ?? 135
  const initialUseCustomBanner = !!user?.banner
  const initialPronouns = user?.pronouns || ''
  const initialCustomActivity = user?.customActivity || ''

  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [bio, setBio] = useState(initialBio)
  const [avatar, setAvatar] = useState(initialAvatar)
  const [banner, setBanner] = useState(initialBanner)
  const [gradientColor1, setGradientColor1] = useState(initialColor1)
  const [gradientColor2, setGradientColor2] = useState(initialColor2)
  const [gradientAngle, setGradientAngle] = useState(initialAngle)
  const [useCustomBanner, setUseCustomBanner] = useState(initialUseCustomBanner)
  const [pronouns, setPronouns] = useState(initialPronouns)
  const [customActivity, setCustomActivity] = useState(initialCustomActivity)
  const [showBannerCropModal, setShowBannerCropModal] = useState(false)
  const [showAvatarCropModal, setShowAvatarCropModal] = useState(false)
  const [showAvatarChooser, setShowAvatarChooser] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [copiedUserId, setCopiedUserId] = useState(false)

  const handleCopyUserId = () => {
    if (user?.userId) {
      navigator.clipboard.writeText(user.userId)
      setCopiedUserId(true)
      setTimeout(() => setCopiedUserId(false), 2000)
    }
  }

  const updateDeveloperMode = (enabled: boolean) => {
    try {
      window.localStorage.setItem('developerMode', String(enabled))
      setDeveloperMode(enabled)
      window.dispatchEvent(new Event('developer-mode-changed'))
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save Developer Mode.')
    }
  }

  const initialSnapshotRef = useRef<{
    displayName: string
    bio: string
    avatar: string
    banner: string
    useCustomBanner: boolean
    gradientColor1: string
    gradientColor2: string
    gradientAngle: number
    pronouns: string
    customActivity: string
  } | null>(null)

  useEffect(() => {
    if (isOpen && user) {
      const snap = {
        displayName: user.displayName || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
        banner: user.banner || '',
        useCustomBanner: !!user.banner,
        gradientColor1: (user.themeGradient?.color1 || '#0099ff').toLowerCase(),
        gradientColor2: (user.themeGradient?.color2 || '#7928ca').toLowerCase(),
        gradientAngle: user.themeGradient?.angle ?? 135,
        pronouns: user.pronouns || '',
        customActivity: user.customActivity || ''
      }
      initialSnapshotRef.current = snap
      setDisplayName(snap.displayName)
      setBio(snap.bio)
      setAvatar(snap.avatar)
      setBanner(snap.banner)
      setGradientColor1(snap.gradientColor1)
      setGradientColor2(snap.gradientColor2)
      setGradientAngle(snap.gradientAngle)
      setUseCustomBanner(snap.useCustomBanner)
      setPronouns(snap.pronouns)
      setCustomActivity(snap.customActivity)
      setSaveSuccess(false)
      setSaveError('')
    }
  }, [isOpen, user])

  const hasProfileChanges = useMemo(() => {
    const snap = initialSnapshotRef.current
    if (!snap) return false
    if (displayName.trim() !== snap.displayName.trim()) return true
    if (bio.trim() !== snap.bio.trim()) return true
    if (avatar !== snap.avatar) return true
    if (pronouns.trim() !== snap.pronouns.trim()) return true
    if (customActivity.trim() !== snap.customActivity.trim()) return true
    if (banner !== snap.banner) return true
    if (
      gradientColor1.toLowerCase() !== snap.gradientColor1 ||
      gradientColor2.toLowerCase() !== snap.gradientColor2 ||
      gradientAngle !== snap.gradientAngle
    ) return true
    return false
  }, [displayName, bio, avatar, banner, gradientColor1, gradientColor2, gradientAngle, pronouns, customActivity])
  const [blockedUsers, setBlockedUsers] = useState<any[]>([])
  const [showBlockedUsers, setShowBlockedUsers] = useState(false)
  const [allowGroupAdds, setAllowGroupAdds] = useState(user?.allowGroupAdds !== false)
  const [groupAddExceptions, setGroupAddExceptions] = useState<string[]>(user?.groupAddExceptions || [])
  const [groupAddFriends, setGroupAddFriends] = useState<any[]>([])
  const [groupAddFeedback, setGroupAddFeedback] = useState('')
  const [isSavingGroupAddSettings, setIsSavingGroupAddSettings] = useState(false)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => ({
    messages: localStorage.getItem('messageNotifications') !== 'false',
    sound: localStorage.getItem('soundEnabled') !== 'false',
    desktop: localStorage.getItem('desktopNotifications') === 'true',
    friendRequests: localStorage.getItem('friendRequestNotifications') !== 'false'
  }))
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(() => localStorage.getItem('readReceipts') !== 'false')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme && THEME_VARS[savedTheme]) {
      setTheme(savedTheme)
    } else if (savedTheme && customThemes.some(customTheme => customTheme.id === savedTheme)) {
      setTheme(savedTheme)
    }
  }, [customThemes])

  // Load blocked users when privacy tab is opened
  useEffect(() => {
    if (activeTab === 'privacy' && user) {
      loadBlockedUsers()
      loadGroupAddSettings()
    }
  }, [activeTab, user])

  const loadBlockedUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.ok && data.user.blockedUsers) {
        const users = await Promise.all(
          data.user.blockedUsers.map((userId: string) =>
            fetch(`${API_BASE}/api/auth/search?q=${userId}`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(res => res.json())
          )
        )
        const blockedUsersList = users
          .filter((u: any) => u.ok && u.users.length > 0)
          .map((u: any) => u.users[0])
        setBlockedUsers(blockedUsersList)
      }
    } catch (e) {
      console.error('Failed to load blocked users:', e)
    }
  }

  const loadGroupAddSettings = async () => {
    try {
      const [settingsResponse, friendsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/auth/privacy/group-adds`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/auth/friends`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      const [settings, friendsData] = await Promise.all([settingsResponse.json(), friendsResponse.json()])
      if (settings.ok) {
        setAllowGroupAdds(settings.allowGroupAdds !== false)
        setGroupAddExceptions(settings.groupAddExceptions || [])
      }
      if (friendsData.ok) setGroupAddFriends(friendsData.friends || [])
    } catch (error) {
      console.error('Failed to load group-add settings:', error)
    }
  }

  const saveGroupAddSettings = async (allow = allowGroupAdds, exceptions = groupAddExceptions) => {
    setIsSavingGroupAddSettings(true)
    setGroupAddFeedback('')
    try {
      const response = await fetch(`${API_BASE}/api/auth/privacy/group-adds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ allow, exceptions })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not save group-add settings.')
      setAllowGroupAdds(data.allowGroupAdds)
      setGroupAddExceptions(data.groupAddExceptions)
      setUser({ ...user, allowGroupAdds: data.allowGroupAdds, groupAddExceptions: data.groupAddExceptions })
      setGroupAddFeedback('Group invitation preferences saved.')
    } catch (error) {
      setGroupAddFeedback(error instanceof Error ? error.message : 'Could not save group-add settings.')
    } finally {
      setIsSavingGroupAddSettings(false)
    }
  }

  const handleUnblockUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/friends/unblock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: userId })
      })
      const data = await response.json()
      if (data.ok) {
        setBlockedUsers(prev => prev.filter(u => u.userId !== userId))
        setUser({ ...user, blockedUsers: user.blockedUsers.filter((id: string) => id !== userId) })
      }
    } catch (e) {
      console.error('Failed to unblock user:', e)
    }
  }

  // Apply theme
  const applyTheme = (t: Theme) => {
    const root = document.documentElement
    const vars = THEME_VARS[t]
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
    root.setAttribute('data-theme', t)
    localStorage.setItem('theme', t)
    localStorage.setItem('themeVersion', '2')
    setTheme(t)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0]
    if (file) {
      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        if (type === 'avatar') {
          setAvatar(result)
          if (!isGif) {
            setShowAvatarCropModal(true)
          }
        } else {
          setBanner(result)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    if (!hasProfileChanges || isSaving) return
    setIsSaving(true)
    setSaveSuccess(false)
    setSaveError('')
    try {
      const profileData = {
        displayName,
        bio,
        avatar,
        banner: banner || null,
        themeGradient: { color1: gradientColor1, color2: gradientColor2, angle: gradientAngle },
        pronouns,
        customActivity
      }
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileData)
      })
      const data = await res.json()
      if (data.ok && data.user) {
        setUser(data.user)
        initialSnapshotRef.current = {
          displayName: data.user.displayName || '',
          bio: data.user.bio || '',
          avatar: data.user.avatar || '',
          banner: data.user.banner || '',
          useCustomBanner: !!data.user.banner,
          gradientColor1: (data.user.themeGradient?.color1 || '#0099ff').toLowerCase(),
          gradientColor2: (data.user.themeGradient?.color2 || '#7928ca').toLowerCase(),
          gradientAngle: data.user.themeGradient?.angle ?? 135,
          pronouns: data.user.pronouns || '',
          customActivity: data.user.customActivity || ''
        }
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        if (onProfileUpdate) onProfileUpdate(data.user)
      } else {
        setSaveError(data.message || 'Failed to save profile.')
      }
    } catch (e: any) {
      console.error('Failed to save profile', e)
      setSaveError(e.message || 'Network error saving profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    onClose()
  }

  const toggleNotificationPreference = async (key: keyof NotificationPreferences) => {
    const nextValue = !notificationPreferences[key]
    if (key === 'desktop' && nextValue) {
      if (typeof Notification === 'undefined' || await Notification.requestPermission() !== 'granted') return
    }
    setNotificationPreferences(prev => ({ ...prev, [key]: nextValue }))
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS[key], String(nextValue))
  }

  const handleExportData = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: {
        userId: user?.userId,
        username: user?.username,
        email: user?.email,
        displayName: user?.displayName,
        bio: user?.bio,
        pronouns: user?.pronouns,
        avatar: user?.avatar,
        banner: user?.banner
      },
      preferences: {
        theme: localStorage.getItem('theme'),
        notifications: notificationPreferences,
        readReceipts: readReceiptsEnabled
      }
    }
    const fileUrl = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = `space-account-${user?.userId || 'export'}.json`
    link.click()
    URL.revokeObjectURL(fileUrl)
  }

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordFeedback(null)
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'Use at least 8 characters for your new password.' })
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ type: 'error', message: 'The new passwords do not match.' })
      return
    }
    if (!privateKey) {
      setPasswordFeedback({ type: 'error', message: 'Your encryption key is not ready. Refresh the app and try again.' })
      return
    }

    setIsChangingPassword(true)
    try {
      const saltBytes = window.crypto.getRandomValues(new Uint8Array(16))
      const keySalt = Array.from(saltBytes, value => value.toString(16).padStart(2, '0')).join('')
      const wrappingKey = await deriveKeyFromPassword(newPassword, keySalt)
      const encryptedPrivateKey = await encryptPrivateKey(privateKey, wrappingKey)
      const response = await fetch(`${API_BASE}/api/auth/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword, encryptedPrivateKey, keySalt })
      })
      const data = await response.json()
      if (!data.ok) throw new Error(data.message || 'Password update failed.')
      setPasswordFeedback({ type: 'success', message: 'Password and encryption-key recovery updated.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (error) {
      setPasswordFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Password update failed.' })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'My Account', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'connections', label: 'Connections & Rich Presence', icon: <Link2 className="w-4 h-4" /> },
    { id: 'appearance', label: 'Themes & Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'theme-studio', label: 'Theme Studio (Painter Upcoming)', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy & Safety', icon: <Shield className="w-4 h-4" /> },
    { id: 'account', label: 'Account', icon: <Lock className="w-4 h-4" /> },
  ]

  const categorized = (cat: 'frutiger' | 'retro' | 'specialty') =>
    THEMES.filter(t => t.category === cat)

  if (!isOpen) return null

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-5xl h-[min(92dvh,760px)] min-h-0 rounded-xl shadow-2xl border border-[var(--app-border)] overflow-hidden flex"
          style={{ background: 'var(--app-panel)', backdropFilter: 'var(--app-panel-backdrop)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Left Navigation ── */}
          <div
            className="w-14 sm:w-60 border-r border-[var(--app-border)] flex flex-col shrink-0"
            style={{ background: 'var(--app-surface)', backdropFilter: 'var(--app-panel-backdrop)' }}
          >
            <div className="px-2 sm:px-4 pt-5 pb-3">
              <p className="hidden sm:block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">User Settings</p>
            </div>

            <nav className="flex-1 px-2 space-y-0.5">
              {NAV_ITEMS.map((item, i) => (
                <motion.button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                  title={item.label}
                  className={`w-full flex items-center justify-center sm:justify-start gap-3 px-2 sm:px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative
                    ${activeTab === item.id
                      ? 'text-[var(--text-primary)] sidebar-active-bar'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'
                    }`}
                  style={activeTab === item.id ? {
                    background: 'color-mix(in srgb, var(--app-accent) 12%, var(--app-surface-hover))',
                    boxShadow: 'inset 3px 0 0 var(--app-accent)'
                  } : {}}
                >
                  <span style={{ color: activeTab === item.id ? 'var(--app-accent)' : undefined }}>
                    {item.icon}
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                  {activeTab === item.id && (
                    <motion.div
                      layoutId="settings-active-pill"
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{ background: 'color-mix(in srgb, var(--app-accent) 8%, transparent)' }}
                    />
                  )}
                </motion.button>
              ))}
            </nav>

            <div className="mt-auto px-1 sm:px-2 pb-3 border-t border-[var(--app-border)] pt-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center sm:justify-start gap-3 px-2 sm:px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          </div>

          {/* ── Right Content ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div
              className="h-14 px-3 sm:px-6 flex items-center justify-between border-b border-[var(--app-border)] shrink-0"
              style={{ background: 'var(--app-surface)' }}
            >
              <h3 className="text-base font-bold text-[var(--text-primary)] capitalize tracking-wide">
                {NAV_ITEMS.find(n => n.id === activeTab)?.label}
              </h3>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                aria-label="Close settings"
                data-paint-id="settings-close-btn"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6">

              {/* ═══ PROFILE TAB ═══ */}
              <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-6"
                  >
                    {/* Header Intro */}
                    <div className="p-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🎨</span>
                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                          Profile Customization
                        </h3>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Personalize how your profile card looks across Space. Blend your two-color gradient to match your vibe, drop a status note so people know what you're up to, or upload an animated GIF as your avatar or banner.
                      </p>
                    </div>

                    {/* Live Profile Card Preview */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                        Live Profile Identity Preview
                      </label>
                      <div 
                        className="rounded-2xl overflow-hidden shadow-2xl max-w-md mx-auto relative transition-all"
                        style={{
                          background: `linear-gradient(${gradientAngle}deg, ${gradientColor1} 0%, ${gradientColor2} 100%)`,
                          boxShadow: `0 18px 45px rgba(0, 0, 0, 0.55), 0 0 35px ${gradientColor1}45`,
                          border: '1.5px solid rgba(255,255,255,0.3)'
                        }}
                      >
                        {/* Banner */}
                        <div
                          className="h-28 w-full relative transition-all overflow-hidden"
                          style={
                            banner
                              ? { backgroundImage: `url(${banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                              : { background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.32) 100%)' }
                          }
                        >
                          {/* Badges in top-right corner if member has OG badge */}
                          {user?.memberNumber && user.memberNumber <= 100 && (
                            <div className="absolute top-3 right-3 flex items-center p-1 px-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                              <span className="text-[10px] font-black bg-cyan-500/30 text-cyan-300 border border-cyan-400/50 px-1.5 py-0.5 rounded">
                                #{user.memberNumber} OG
                              </span>
                            </div>
                          )}

                          {/* Avatar with Y2K Frutiger Note Bubble */}
                          <div className="absolute -bottom-8 left-4">
                            {/* Y2K Frutiger Glossy Note Bubble */}
                            {customActivity ? (
                              <div 
                                className="absolute -top-7 left-1 max-w-[210px] px-3 py-1 rounded-2xl text-slate-900 text-xs font-bold shadow-lg truncate backdrop-blur-md z-30 select-none"
                                style={{
                                  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(225, 245, 255, 0.92) 55%, rgba(190, 230, 255, 0.95) 100%)',
                                  border: '1.5px solid rgba(255, 255, 255, 0.9)',
                                  boxShadow: '0 4px 15px rgba(0, 140, 255, 0.3), inset 0 1px 1px #ffffff'
                                }}
                              >
                                💭 {customActivity}
                                <div 
                                  className="absolute -bottom-1 left-4 w-2 h-2 rotate-45"
                                  style={{
                                    background: 'rgba(190, 230, 255, 0.95)',
                                    borderRight: '1.5px solid rgba(255, 255, 255, 0.9)',
                                    borderBottom: '1.5px solid rgba(255, 255, 255, 0.9)'
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="absolute -top-6 left-1 px-2 py-0.5 rounded-xl bg-white/80 text-slate-700 text-[10px] font-semibold italic shadow-sm border border-white/80">
                                💭 Click bubble on profile to set
                              </div>
                            )}

                            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-white text-xl font-bold overflow-hidden border-4 border-white/80 shadow-2xl">
                              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (displayName || user?.username || 'U')[0].toUpperCase()}
                            </div>
                          </div>
                        </div>

                        {/* Card Info Body */}
                        <div className="pt-10 px-4 pb-4 bg-slate-950/45 backdrop-blur-md text-white border-t border-white/15">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-bold text-white drop-shadow-sm">
                              {displayName || user?.username || 'Username'}
                            </h4>
                            {pronouns && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/25 font-semibold">
                                {pronouns}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/70">@{user?.username || 'username'}</p>

                          {bio && (
                            <div className="mt-3 p-2.5 rounded-xl bg-black/25 border border-white/15 text-xs text-white/90 whitespace-pre-wrap">
                              {bio}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Note Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                          <span>💭</span> Status Note
                        </label>
                        <span className="text-xs text-[var(--text-secondary)]">{customActivity.length}/100</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mb-2">
                        Your personal thought bubble that floats right over your profile picture for everyone to see. Say whatever you want!
                      </p>
                      <div className="relative">
                        <input
                          type="text"
                          value={customActivity}
                          onChange={e => setCustomActivity(e.target.value)}
                          placeholder="What's on your mind? (e.g. listening to music, chilling, afk...)"
                          maxLength={100}
                          className="w-full matte-input px-4 py-2.5 rounded-xl focus:outline-none transition-all text-sm font-medium"
                        />
                        {customActivity && (
                          <button
                            type="button"
                            onClick={() => setCustomActivity('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Identity Card Dual-Color Gradient */}
                    <div>
                      <div className="mb-2">
                        <label className="text-sm font-semibold text-[var(--text-primary)]">
                          Identity Card Colors (Dual Gradient)
                        </label>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Choose Color 1 and Color 2 to style your Identity Card. When other members view your profile, they will see your card with your chosen gradient, completely separate from their app theme.
                        </p>
                      </div>

                      <div className="space-y-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                        {/* Space Aesthetic Gradient Presets */}
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                            Aesthetic Presets
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {SPACE_GRADIENT_PRESETS.map((preset) => (
                              <button
                                key={preset.name}
                                type="button"
                                onClick={() => {
                                  setGradientColor1(preset.color1)
                                  setGradientColor2(preset.color2)
                                  setGradientAngle(preset.angle)
                                }}
                                className={`p-2 rounded-xl text-left border transition-all flex items-center gap-2 group ${
                                  gradientColor1.toLowerCase() === preset.color1.toLowerCase() &&
                                  gradientColor2.toLowerCase() === preset.color2.toLowerCase()
                                    ? 'border-[var(--app-accent)] ring-2 ring-[var(--app-accent)]/30'
                                    : 'border-[var(--app-border)] hover:border-[var(--app-accent)]/60'
                                }`}
                              >
                                <div
                                  className="w-6 h-6 rounded-lg shrink-0 shadow-sm border border-white/20"
                                  style={{ background: `linear-gradient(${preset.angle}deg, ${preset.color1}, ${preset.color2})` }}
                                />
                                <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                  {preset.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Color Pickers */}
                        <div className="flex gap-4 pt-2 border-t border-[var(--app-border)]">
                          <div className="flex-1">
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">Color 1 (Primary)</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={gradientColor1}
                                onChange={e => setGradientColor1(e.target.value)}
                                className="w-10 h-10 rounded-lg cursor-pointer border border-[var(--app-border)]"
                              />
                              <input
                                type="text"
                                value={gradientColor1}
                                onChange={e => setGradientColor1(e.target.value)}
                                className="flex-1 matte-input px-3 py-2 rounded-lg text-sm font-mono"
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">Color 2 (Secondary)</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={gradientColor2}
                                onChange={e => setGradientColor2(e.target.value)}
                                className="w-10 h-10 rounded-lg cursor-pointer border border-[var(--app-border)]"
                              />
                              <input
                                type="text"
                                value={gradientColor2}
                                onChange={e => setGradientColor2(e.target.value)}
                                className="flex-1 matte-input px-3 py-2 rounded-lg text-sm font-mono"
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
                            <span>Gradient Angle</span>
                            <span className="font-mono">{gradientAngle}°</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={gradientAngle}
                            onChange={e => setGradientAngle(Number(e.target.value))}
                            className="w-full accent-[var(--app-accent)]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Profile Banner (Image or GIF) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <label className="text-sm font-semibold text-[var(--text-primary)]">
                            Profile Banner (Image or GIF)
                          </label>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Optional header banner. Animated GIFs and static images are fully supported!
                          </p>
                        </div>
                        {banner && (
                          <button
                            type="button"
                            onClick={() => setBanner('')}
                            className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                          >
                            Remove Banner
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div
                          className="h-28 rounded-xl bg-cover bg-center border-2 border-dashed border-[var(--app-border)] flex items-center justify-center cursor-pointer hover:border-[var(--app-accent)] transition-colors relative group overflow-hidden"
                          style={banner ? { backgroundImage: `url(${banner})`, backgroundSize: 'cover' } : {}}
                          onClick={() => bannerInputRef.current?.click()}
                        >
                          {!banner && (
                            <div className="text-center">
                              <Palette className="w-7 h-7 text-[var(--text-secondary)] mx-auto mb-1.5" />
                              <p className="text-xs font-semibold text-[var(--text-secondary)]">Click to upload banner (GIFs & images supported)</p>
                            </div>
                          )}
                          {banner && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-xs font-bold text-white">
                              Click to replace banner image / GIF
                            </div>
                          )}
                        </div>

                        {banner && (
                          <button
                            type="button"
                            onClick={() => setShowBannerCropModal(true)}
                            className="w-full py-2 rounded-xl text-xs font-bold frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] flex items-center justify-center gap-2 shadow-xs"
                          >
                            <Sliders className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                            Crop & Re-position Banner Image
                          </button>
                        )}
                      </div>

                      <input ref={bannerInputRef} type="file" accept="image/*,image/gif,.gif" onChange={e => handleImageUpload(e, 'banner')} className="hidden" />
                    </div>

                    {/* Avatar Upload (with Klipy animated GIF & upload options) */}
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div 
                          onClick={() => setShowAvatarChooser(true)}
                          className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white text-2xl font-bold overflow-hidden shadow-lg ring-2 ring-[var(--app-border)] cursor-pointer hover:ring-[var(--app-accent)] transition-all"
                        >
                          {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (displayName || user?.username || 'U')[0].toUpperCase()}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center text-white text-xs font-bold">
                            Change
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setShowAvatarChooser(true)}
                          className="absolute bottom-0 right-0 w-7 h-7 bg-[var(--app-accent)] rounded-full flex items-center justify-center border-2 border-[var(--app-panel)] shadow-md z-30"
                          title="Change profile picture or GIF"
                        >
                          <Palette className="w-3 h-3 text-white" />
                        </motion.button>
                        <input ref={avatarInputRef} type="file" accept="image/*,image/gif,.gif" onChange={e => handleImageUpload(e, 'avatar')} className="hidden" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Profile Picture</p>
                        <p className="text-xs text-[var(--text-secondary)] mb-2">Upload your own file or search millions of animated GIFs.</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAvatarChooser(true)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] flex items-center gap-1.5 shadow-xs"
                          >
                            <Palette className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                            Change Avatar...
                          </button>
                          {avatar && !avatar.includes('.gif') && !avatar.startsWith('data:image/gif') && (
                            <button
                              type="button"
                              onClick={() => setShowAvatarCropModal(true)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
                            >
                              Crop & Zoom
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Profile Badges */}
                    {((user?.badges && user.badges.length > 0) || (user?.memberNumber && user.memberNumber <= 100)) && (
                      <div className="py-1">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                          Profile Badges
                        </label>
                        <UserBadgesList 
                          badges={user.badges} 
                          memberNumber={user.memberNumber} 
                          size="md" 
                        />
                      </div>
                    )}

                    {/* Display Name, Pronouns & Bio */}
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="w-full matte-input px-4 py-3 rounded-xl focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                        Pronouns
                      </label>
                      <input
                        type="text"
                        value={pronouns}
                        onChange={e => setPronouns(e.target.value)}
                        placeholder="e.g. he/him, they/them"
                        maxLength={40}
                        className="w-full matte-input px-4 py-2.5 rounded-xl focus:outline-none transition-all text-sm mb-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Bio / About Me</label>
                      <textarea
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        rows={3}
                        maxLength={300}
                        className="w-full matte-input px-4 py-3 rounded-xl focus:outline-none resize-none transition-all"
                      />
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{bio.length}/300</p>
                    </div>

                    {saveSuccess && (
                      <div className="p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold text-center">
                        ✓ Profile changes saved!
                      </div>
                    )}
                    {saveError && (
                      <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold text-center">
                        {saveError}
                      </div>
                    )}

                    <motion.button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSaving || !hasProfileChanges}
                      whileHover={hasProfileChanges && !isSaving ? { scale: 1.02 } : {}}
                      whileTap={hasProfileChanges && !isSaving ? { scale: 0.98 } : {}}
                      className={`w-full py-3 frutiger-btn frutiger-btn-primary text-white rounded-xl font-semibold transition-all shadow-md ${
                        !hasProfileChanges || isSaving ? 'opacity-40 cursor-not-allowed filter grayscale-[30%]' : ''
                      }`}
                    >
                      {isSaving ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving…
                        </span>
                      ) : 'Save Changes'}
                    </motion.button>
                  </motion.div>
                )}

                {/* ═══ CONNECTIONS TAB ═══ */}
                {activeTab === 'connections' && (
                  <motion.div
                    key="connections"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <ConnectionsSettingsTab
                      token={token || null}
                      currentUser={user}
                      onUserUpdated={(updatedUser) => {
                        setUser(updatedUser);
                        onProfileUpdate?.(updatedUser);
                      }}
                    />
                  </motion.div>
                )}

                {/* ═══ APPEARANCE TAB ═══ */}
                {activeTab === 'appearance' && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-8"
                  >
                    <div>
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-[var(--app-accent)]/15 to-[var(--app-accent-secondary)]/15 border border-[var(--app-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 shadow-xs">
                        <div>
                          <h5 className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-[var(--app-accent)]" />
                            Smart Theme Studio & Painter Mode
                          </h5>
                          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            Design custom palettes, click and paint any UI element, customize chat typography with Google Fonts, and set wallpapers!
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('theme-studio')}
                          className="px-4 py-2 rounded-xl text-xs font-bold frutiger-btn frutiger-btn-primary text-white shrink-0 shadow-sm"
                        >
                          Open Theme Studio
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <Palette className="w-4 h-4 text-[var(--app-accent)]" />
                        <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Presets & Styles</h4>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mb-5">Choose your visual style. Changes apply instantly.</p>

                      {(['frutiger', 'retro', 'specialty'] as const).map((cat, ci) => (
                        <div key={cat} className="mb-6">
                          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">
                            {CATEGORY_LABELS[cat]}
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            {categorized(cat).map((t, i) => {
                              const isActive = theme === t.id
                              return (
                                <motion.button
                                  key={t.id}
                                  onClick={() => applyTheme(t.id)}
                                  onHoverStart={() => setHoveredTheme(t.id)}
                                  onHoverEnd={() => setHoveredTheme(null)}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: ci * 0.06 + i * 0.05 }}
                                  whileHover={{ scale: 1.03, y: -2 }}
                                  whileTap={{ scale: 0.97 }}
                                  className={`relative p-3 rounded-xl border-2 text-left overflow-hidden transition-all ${
                                    isActive
                                      ? 'border-[var(--app-accent)] shadow-lg'
                                      : 'border-[var(--app-border)] hover:border-[var(--app-accent)]/60'
                                  }`}
                                  style={isActive ? { boxShadow: `0 0 0 3px color-mix(in srgb, var(--app-accent) 20%, transparent), 0 4px 16px rgba(0,0,0,0.2)` } : {}}
                                >
                                  {/* Preview swatch */}
                                  <div
                                    className="w-full h-10 rounded-lg mb-2.5 relative overflow-hidden"
                                    style={{ background: t.preview.bg }}
                                  >
                                    {/* mini panel */}
                                    <div
                                      className="absolute top-1 left-1 bottom-1 w-6 rounded-md"
                                      style={{ background: t.preview.panel }}
                                    />
                                    {/* mini accent dot */}
                                    <div
                                      className="absolute top-2 right-2 w-5 h-1.5 rounded-full"
                                      style={{ background: t.preview.accent }}
                                    />
                                    <div
                                      className="absolute bottom-2 right-2 w-3 h-1.5 rounded-full opacity-60"
                                      style={{ background: t.preview.accent }}
                                    />
                                    {/* shimmer on hover */}
                                    <AnimatePresence>
                                      {hoveredTheme === t.id && (
                                        <motion.div
                                          initial={{ x: '-100%', opacity: 0 }}
                                          animate={{ x: '200%', opacity: 0.5 }}
                                          exit={{ opacity: 0 }}
                                          transition={{ duration: 0.6 }}
                                          className="absolute inset-y-0 w-1/3"
                                          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
                                        />
                                      )}
                                    </AnimatePresence>
                                  </div>

                                  {/* Tag badge */}
                                  {t.tag && (
                                    <span
                                      className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                      style={{ background: isActive ? t.preview.accent : 'var(--app-surface-hover)', color: isActive ? '#fff' : 'var(--text-secondary)' }}
                                    >
                                      {t.tag}
                                    </span>
                                  )}

                                  {/* Active check */}
                                  {isActive && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center"
                                      style={{ background: t.preview.accent }}
                                    >
                                      <Check className="w-3 h-3 text-white" />
                                    </motion.div>
                                  )}

                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span style={{ color: 'var(--app-accent)' }}>{t.icon}</span>
                                    <p className="text-sm font-bold text-[var(--text-primary)]">{t.name}</p>
                                  </div>
                                  <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{t.description}</p>
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                      {customThemes.length > 0 && (
                        <div className="mb-6">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Your saved themes</p>
                          <div className="grid grid-cols-2 gap-3">
                            {customThemes.map((savedTheme) => (
                              <button
                                key={savedTheme.id}
                                type="button"
                                onClick={() => {
                                  applySavedTheme(savedTheme.id)
                                  setTheme(savedTheme.id as Theme)
                                }}
                                className={`rounded-xl border-2 p-3 text-left transition-all ${theme === savedTheme.id ? 'border-[var(--app-accent)] shadow-lg' : 'border-[var(--app-border)] hover:border-[var(--app-accent)]/60'}`}
                              >
                                <span className="mb-2 flex h-10 items-center gap-1 rounded-lg p-2" style={{ background: savedTheme.vars['--app-bg'] || 'var(--app-bg)' }}>
                                  <span className="h-full w-1/3 rounded-md" style={{ background: savedTheme.vars['--app-panel'] || 'var(--app-panel)' }} />
                                  <span className="h-2 w-1/3 rounded-full" style={{ background: savedTheme.vars['--app-accent'] || 'var(--app-accent)' }} />
                                </span>
                                <span className="block truncate text-xs font-bold text-[var(--text-primary)]">{savedTheme.name}</span>
                                <span className="mt-1 block line-clamp-2 min-h-8 text-[10px] text-[var(--text-secondary)]">{savedTheme.description || 'Custom theme'}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chat Formatting Bar Setting & Guide */}
                      <div className="mt-8 pt-6 border-t border-[var(--app-border)] space-y-6">
                        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--app-panel)]/60 border border-[var(--app-border)] backdrop-blur-md">
                          <div className="space-y-0.5">
                            <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                              <Type className="w-4 h-4 text-[var(--app-accent)]" />
                              Quick Text Formatting Bar
                            </span>
                            <p className="text-xs text-[var(--text-secondary)]">
                              Display the shortcut toolbar (Bold, Italic, Code, Spoiler) right above the chat input box.
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={showFormattingToolbar}
                            onClick={() => toggleFormattingToolbar(!showFormattingToolbar)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              showFormattingToolbar ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)]'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                showFormattingToolbar ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Markdown Guide Tutorial */}
                        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)]/40 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[var(--app-accent)]" /> Formatting Cheat Sheet
                            </h5>
                            <span className="text-[10px] text-[var(--text-secondary)] font-medium">Type anytime in chat</span>
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            You don't need any toolbars to format your messages! Type these Markdown characters directly around your text:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--app-surface)]/70 border border-[var(--app-border)]/60">
                              <span className="text-[var(--text-secondary)] font-mono text-[11px]">**text**</span>
                              <span className="font-bold text-[var(--text-primary)]">Bold text</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--app-surface)]/70 border border-[var(--app-border)]/60">
                              <span className="text-[var(--text-secondary)] font-mono text-[11px]">*text*</span>
                              <span className="italic text-[var(--text-primary)]">Italic text</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--app-surface)]/70 border border-[var(--app-border)]/60">
                              <span className="text-[var(--text-secondary)] font-mono text-[11px]">__text__</span>
                              <span className="underline text-[var(--text-primary)]">Underlined</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--app-surface)]/70 border border-[var(--app-border)]/60">
                              <span className="text-[var(--text-secondary)] font-mono text-[11px]">~~text~~</span>
                              <span className="line-through text-[var(--text-primary)]">Strikethrough</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--app-surface)]/70 border border-[var(--app-border)]/60">
                              <span className="text-[var(--text-secondary)] font-mono text-[11px]">`code`</span>
                              <code className="text-[11px] px-1 py-0.5 rounded bg-[var(--app-panel)] text-[var(--app-accent)]">inline code</code>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--app-surface)]/70 border border-[var(--app-border)]/60">
                              <span className="text-[var(--text-secondary)] font-mono text-[11px]">||secret||</span>
                              <span className="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white/80">Spoiler text</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--app-surface)]/70 border border-[var(--app-border)]/60 sm:col-span-2">
                              <span className="text-[var(--text-secondary)] font-mono text-[11px]">&gt; your text</span>
                              <span className="border-l-2 border-[var(--app-accent)] pl-2 text-[var(--text-secondary)] text-[11px]">Blockquote quote</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ═══ THEME STUDIO & PAINTER TAB ═══ */}
                {activeTab === 'theme-studio' && (
                  <motion.div
                    key="theme-studio"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-6"
                  >
                    <ThemeStudio onLaunchPainter={onClose} />
                  </motion.div>
                )}

                {/* ═══ NOTIFICATIONS TAB ═══ */}
                {activeTab === 'notifications' && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    {([
                      { key: 'messages', label: 'Message Notifications', desc: 'Show alerts for incoming messages' },
                      { key: 'sound', label: 'Sound Effects', desc: 'Play a sound for incoming messages' },
                      { key: 'desktop', label: 'Desktop Notifications', desc: typeof Notification === 'undefined' ? 'Not available in this browser' : 'Show browser notifications when Space is in the background' },
                      { key: 'friendRequests', label: 'Friend Requests', desc: 'Alert when someone sends you a friend request' },
                    ] as { key: keyof NotificationPreferences; label: string; desc: string }[]).map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="flex items-center justify-between p-4 rounded-xl border border-[var(--app-border)] transition-colors"
                        style={{ background: 'var(--app-surface)' }}
                      >
                        <div>
                          <p className="font-semibold text-sm text-[var(--text-primary)]">{item.label}</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={notificationPreferences[item.key]}
                          aria-label={item.label}
                          disabled={item.key === 'desktop' && typeof Notification === 'undefined'}
                          onClick={() => void toggleNotificationPreference(item.key)}
                          className={`w-11 h-6 rounded-full relative disabled:opacity-50 ${notificationPreferences[item.key] ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)]'}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${notificationPreferences[item.key] ? 'right-1' : 'left-1'}`} />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {/* ═══ PRIVACY TAB ═══ */}
                {activeTab === 'privacy' && (
                  <motion.div
                    key="privacy"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--app-border)] p-4" style={{ background: 'var(--app-surface)' }}>
                      <div>
                        <p className="font-semibold text-sm text-[var(--text-primary)]">Developer Mode</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">Enable right-click Copy ID actions for Spaces, channels, categories, and roles.</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={developerMode}
                        aria-label="Developer Mode"
                        onClick={() => updateDeveloperMode(!developerMode)}
                        className={`w-11 h-6 shrink-0 rounded-full relative transition-colors ${developerMode ? 'bg-[var(--app-accent)]' : 'bg-gray-500'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${developerMode ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                    <div
                      className="flex items-center justify-between p-4 rounded-xl border border-[var(--app-border)]"
                      style={{ background: 'var(--app-surface)' }}
                    >
                      <div>
                        <p className="font-semibold text-sm text-[var(--text-primary)]">Allow One-Time Messages</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">Let unfriended users send you one-time messages</p>
                      </div>
                      <button
                        onClick={async () => {
                          const newValue = !user?.allowOneTimeMessages
                          try {
                            const response = await fetch(`${API_BASE}/api/auth/privacy/one-time-messages`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ allow: newValue })
                            })
                            const data = await response.json()
                            if (data.ok) setUser({ ...user, allowOneTimeMessages: newValue })
                          } catch (e) { console.error(e) }
                        }}
                        className={`w-11 h-6 rounded-full relative transition-colors ${user?.allowOneTimeMessages !== false ? 'bg-[var(--app-accent)]' : 'bg-gray-500'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${user?.allowOneTimeMessages !== false ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 rounded-xl border border-[var(--app-border)] space-y-3" style={{ background: 'var(--app-surface)' }}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-sm text-[var(--text-primary)]">Allow Group Adds</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Friends can add you directly to their group chats.</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={allowGroupAdds}
                          aria-label="Allow Group Adds"
                          onClick={() => void saveGroupAddSettings(!allowGroupAdds)}
                          disabled={isSavingGroupAddSettings}
                          className={`w-11 h-6 shrink-0 rounded-full relative disabled:opacity-60 ${allowGroupAdds ? 'bg-[var(--app-accent)]' : 'bg-gray-500'}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm ${allowGroupAdds ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>
                      {!allowGroupAdds && (
                        <div className="border-t border-[var(--app-border)] pt-3">
                          <p className="text-xs font-medium text-[var(--text-primary)] mb-2">Allow these friends to add you</p>
                          {groupAddFriends.length ? (
                            <div className="max-h-36 overflow-y-auto flex flex-wrap gap-2">
                              {groupAddFriends.map(friend => {
                                const isAllowed = groupAddExceptions.includes(friend.userId)
                                return (
                                  <button
                                    key={friend.userId}
                                    type="button"
                                    aria-pressed={isAllowed}
                                    onClick={() => setGroupAddExceptions(prev => isAllowed ? prev.filter(id => id !== friend.userId) : [...prev, friend.userId])}
                                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${isAllowed ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/10 text-[var(--app-accent)]' : 'border-[var(--app-border)] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]'}`}
                                  >
                                    {isAllowed && <Check className="w-3 h-3" />}
                                    {friend.displayName || friend.username}
                                  </button>
                                )
                              })}
                            </div>
                          ) : <p className="text-xs text-[var(--text-secondary)]">Add friends before creating exceptions.</p>}
                          <button type="button" onClick={() => void saveGroupAddSettings()} disabled={isSavingGroupAddSettings} className="mt-3 rounded-md frutiger-btn frutiger-btn-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                            {isSavingGroupAddSettings ? 'Saving...' : 'Save allowed friends'}
                          </button>
                        </div>
                      )}
                      {groupAddFeedback && <p role="status" className="text-xs text-[var(--text-secondary)]">{groupAddFeedback}</p>}
                    </div>

                    <div
                      className="flex items-center justify-between p-4 rounded-xl border border-[var(--app-border)]"
                      style={{ background: 'var(--app-surface)' }}
                    >
                      <div>
                        <p className="font-semibold text-sm text-[var(--text-primary)]">Read Receipts</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">Let others see when you've read their messages</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={readReceiptsEnabled}
                        aria-label="Read Receipts"
                        onClick={() => {
                          const nextValue = !readReceiptsEnabled
                          setReadReceiptsEnabled(nextValue)
                          localStorage.setItem('readReceipts', String(nextValue))
                        }}
                        className={`w-11 h-6 rounded-full relative ${readReceiptsEnabled ? 'bg-[var(--app-accent)]' : 'bg-gray-500'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm ${readReceiptsEnabled ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>

                    <motion.div
                      onClick={() => setShowBlockedUsers(true)}
                      className="flex items-center justify-between p-4 rounded-xl border border-[var(--app-border)] cursor-pointer hover:border-[var(--app-accent)]/50 transition-all"
                      style={{ background: 'var(--app-surface)' }}
                      whileHover={{ scale: 1.01 }}
                    >
                      <div>
                        <p className="font-semibold text-sm text-[var(--text-primary)]">Blocked Users</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">Manage users you've blocked ({blockedUsers.length})</p>
                      </div>
                      <Shield className="w-5 h-5 text-[var(--text-secondary)]" />
                    </motion.div>
                  </motion.div>
                )}

                {/* ═══ ACCOUNT TAB ═══ */}
                {activeTab === 'account' && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    {/* User ID & Support Key Card */}
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-xl border border-[var(--app-border)] space-y-3"
                      style={{ background: 'var(--app-surface)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Key className="w-5 h-5 text-[var(--app-accent)]" />
                          <div>
                            <p className="font-semibold text-sm text-[var(--text-primary)]">Account User ID</p>
                            <p className="text-xs text-[var(--text-secondary)]">Your unique cryptographic account identifier</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyUserId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] hover:scale-105 transition-all shadow-xs"
                        >
                          {copiedUserId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-500">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                              <span>Copy ID</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="p-3 rounded-lg bg-[var(--app-panel)] border border-[var(--app-border)] flex items-center justify-between">
                        <code className="text-xs font-mono font-bold text-[var(--text-primary)] select-all tracking-wide">
                          {user?.userId || 'Not available'}
                        </code>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Verified
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs text-[var(--text-secondary)]">
                        <p className="max-w-[70%] text-[11px] leading-relaxed">
                          Tickets and moderation inquiries submitted from your session are automatically signed and connected to this User ID.
                        </p>
                        <a
                          href="/support"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--app-accent)] hover:underline"
                        >
                          <LifeBuoy className="w-3.5 h-3.5" /> Support Center
                        </a>
                      </div>
                    </motion.div>

                    <motion.form onSubmit={handleChangePassword} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0 }} className="p-4 rounded-xl border border-[var(--app-border)] space-y-3" style={{ background: 'var(--app-surface)' }}>
                      <div className="flex items-center gap-3 mb-3">
                        <Eye className="w-5 h-5 text-[var(--app-accent)]" />
                        <p className="font-semibold text-sm text-[var(--text-primary)]">Change Password</p>
                      </div>
                      <input type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder="Current password" className="w-full matte-input px-3 py-2 rounded-lg text-sm" />
                      <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="New password" className="w-full matte-input px-3 py-2 rounded-lg text-sm" />
                      <input type="password" autoComplete="new-password" minLength={8} required value={confirmNewPassword} onChange={event => setConfirmNewPassword(event.target.value)} placeholder="Confirm new password" className="w-full matte-input px-3 py-2 rounded-lg text-sm" />
                      {passwordFeedback && <p role="status" className={`text-xs ${passwordFeedback.type === 'error' ? 'text-red-400' : 'text-green-500'}`}>{passwordFeedback.message}</p>}
                      <button type="submit" disabled={isChangingPassword} className="w-full py-2.5 frutiger-btn frutiger-btn-primary text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60">
                        {isChangingPassword ? 'Updating…' : 'Update Password'}
                      </button>
                    </motion.form>

                    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.07 }} className="p-4 rounded-xl border border-[var(--app-border)]" style={{ background: 'var(--app-surface)' }}>
                      <div className="flex items-center gap-3 mb-3">
                        <Download className="w-5 h-5 text-[var(--app-accent)]" />
                        <p className="font-semibold text-sm text-[var(--text-primary)]">Export Data</p>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mb-3">Download your profile and local preferences as a JSON file.</p>
                      <button type="button" onClick={handleExportData} className="w-full py-2.5 rounded-xl text-sm font-semibold frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] transition-all">
                        Export Data
                      </button>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.14 }} className="p-4 bg-red-500/8 border border-red-500/20 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <Trash2 className="w-5 h-5 text-red-400" />
                        <p className="font-semibold text-sm text-red-400">Delete Account</p>
                      </div>
                      <p className="text-xs text-red-400/70 mb-3">Permanently delete your account and all data. This cannot be undone.</p>
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                            try {
                              const response = await fetch(`${API_BASE}/api/auth/account`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` }
                              })
                              const data = await response.json()
                              if (data.ok) { logout(); onClose() }
                              else alert(data.message || 'Failed to delete account')
                            } catch (e) {
                              console.error('Failed to delete account:', e)
                              alert('Failed to delete account')
                            }
                          }
                        }}
                        className="w-full py-2.5 frutiger-btn frutiger-btn-danger text-white rounded-xl text-sm font-semibold transition-all"
                      >
                        Delete Account
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>

    {/* Blocked Users Modal */}
    <AnimatePresence>
      {showBlockedUsers && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowBlockedUsers(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full max-w-md rounded-2xl shadow-2xl border border-[var(--app-border)]"
            style={{ background: 'var(--app-panel)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Blocked Users</h2>
                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowBlockedUsers(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {blockedUsers.length === 0 ? (
                  <p className="text-center text-[var(--text-secondary)] py-8">No blocked users</p>
                ) : (
                  blockedUsers.map((blockedUser, i) => (
                    <motion.div key={blockedUser.userId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--app-border)]" style={{ background: 'var(--app-surface)' }}>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white font-bold">
                        {blockedUser.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-[var(--text-primary)]">{blockedUser.displayName || blockedUser.username}</p>
                        <p className="text-xs text-[var(--text-secondary)]">@{blockedUser.username}</p>
                      </div>
                      <button onClick={() => handleUnblockUser(blockedUser.userId)} className="px-3 py-1.5 frutiger-btn frutiger-btn-success text-white rounded-lg text-xs font-bold transition-all">
                        Unblock
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      {/* Profile banner editor */}
      <ImageCropModal
        isOpen={showBannerCropModal}
        onClose={() => setShowBannerCropModal(false)}
        mode="banner"
        initialImage={banner}
        targetTitle="Profile banner"
        onApply={(result: CropResult) => {
          setBanner(result.url)
          setUseCustomBanner(true)
        }}
      />

      {/* Avatar Image Crop editor */}
      <ImageCropModal
        isOpen={showAvatarCropModal}
        onClose={() => setShowAvatarCropModal(false)}
        mode="avatar"
        initialImage={avatar}
        targetTitle="Profile picture"
        onApply={(result: CropResult) => {
          setAvatar(result.url)
        }}
      />

      {/* Avatar Chooser Modal (Upload Device vs Klipy Search) */}
      <AvatarChooserModal
        isOpen={showAvatarChooser}
        onClose={() => setShowAvatarChooser(false)}
        currentAvatar={avatar}
        onUploadFile={() => avatarInputRef.current?.click()}
        onSelectKlipyGif={(url) => setAvatar(url)}
        onRemoveAvatar={() => setAvatar('')}
      />
    </AnimatePresence>
    </>
  )
}
