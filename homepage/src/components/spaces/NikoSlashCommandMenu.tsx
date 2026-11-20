import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Sparkles,
  Ticket,
  BarChart2,
  Gift,
  Target,
  AlertTriangle,
  ClipboardList,
  Trash2,
  Lock,
  Unlock,
  Clock,
  Info,
  User,
  Image,
  Bell
} from 'lucide-react';

export interface SlashCommandDef {
  command: string;
  syntax: string;
  description: string;
  icon: any;
  category: 'Utility' | 'Moderation' | 'Fun & Leveling';
}

export const NIKO_SLASH_COMMANDS: SlashCommandDef[] = [
  {
    command: 'rank',
    syntax: '/rank [user]',
    description: 'Display your or a member’s level, total XP, and server rank card',
    icon: Trophy,
    category: 'Fun & Leveling'
  },
  {
    command: 'leaderboard',
    syntax: '/leaderboard',
    description: 'Show the top 10 most active members ranked by XP',
    icon: Trophy,
    category: 'Fun & Leveling'
  },
  {
    command: 'embed',
    syntax: '/embed',
    description: 'Launch the interactive Sapphire / Discohook grade visual embed studio',
    icon: Sparkles,
    category: 'Utility'
  },
  {
    command: 'ticket',
    syntax: '/ticket [category]',
    description: 'Create an encrypted private support ticket channel with staff',
    icon: Ticket,
    category: 'Utility'
  },
  {
    command: 'poll',
    syntax: '/poll "Question" "Option 1" "Option 2"',
    description: 'Launch a community poll with interactive voting buttons',
    icon: BarChart2,
    category: 'Utility'
  },
  {
    command: 'gstart',
    syntax: '/gstart [minutes] [winners] [prize]',
    description: 'Host an automated giveaway with 🎉 entry button and timer',
    icon: Gift,
    category: 'Fun & Leveling'
  },
  {
    command: 'snipe',
    syntax: '/snipe',
    description: 'Recover and reveal the last deleted message in this channel',
    icon: Target,
    category: 'Utility'
  },
  {
    command: 'serverinfo',
    syntax: '/serverinfo',
    description: 'Show detailed stats, owner, role count, and channels for this Space',
    icon: Info,
    category: 'Utility'
  },
  {
    command: 'userinfo',
    syntax: '/userinfo [user]',
    description: 'View a member’s join date, roles, badges, and server permissions',
    icon: User,
    category: 'Utility'
  },
  {
    command: 'av',
    syntax: '/av [user]',
    description: 'View full-resolution avatar of a member',
    icon: Image,
    category: 'Utility'
  },
  {
    command: 'warn',
    syntax: '/warn [user] [reason]',
    description: 'Issue a formal moderation warning recorded in audit logs',
    icon: AlertTriangle,
    category: 'Moderation'
  },
  {
    command: 'warnings',
    syntax: '/warnings [user]',
    description: 'View all active warnings for a member',
    icon: ClipboardList,
    category: 'Moderation'
  },
  {
    command: 'purge',
    syntax: '/purge [amount]',
    description: 'Bulk delete the last N messages in this channel (1–100)',
    icon: Trash2,
    category: 'Moderation'
  },
  {
    command: 'lock',
    syntax: '/lock',
    description: 'Lock this channel, preventing regular members from sending messages',
    icon: Lock,
    category: 'Moderation'
  },
  {
    command: 'unlock',
    syntax: '/unlock',
    description: 'Unlock this channel, restoring normal chatting permissions',
    icon: Unlock,
    category: 'Moderation'
  },
  {
    command: 'slowmode',
    syntax: '/slowmode [seconds]',
    description: 'Set channel slowmode cooldown between messages',
    icon: Clock,
    category: 'Moderation'
  },
  {
    command: 'remindme',
    syntax: '/remindme [minutes] [note]',
    description: 'Set a reminder ping from Niko',
    icon: Bell,
    category: 'Utility'
  }
];

interface NikoSlashCommandMenuProps {
  query: string;
  onSelect: (cmd: SlashCommandDef) => void;
  onClose: () => void;
}

export function NikoSlashCommandMenu({ query, onSelect, onClose }: NikoSlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands
  const cleanQuery = query.replace(/^\//, '').toLowerCase().trim();
  const filtered = NIKO_SLASH_COMMANDS.filter(c =>
    c.command.toLowerCase().includes(cleanQuery) || c.description.toLowerCase().includes(cleanQuery)
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [cleanQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-4 mb-3 w-[min(30rem,calc(100vw-2rem))] max-h-72 overflow-y-auto rounded-2xl border border-white/20 bg-[#16171a]/95 backdrop-blur-2xl shadow-2xl z-50 p-2 text-white custom-scrollbar"
      style={{
        boxShadow: '0 20px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.1)'
      }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--app-accent)]" />
          Niko Slash Commands
        </span>
        <span className="text-[10px] text-white/40">Use ↑ ↓ and Enter</span>
      </div>

      <div className="space-y-0.5">
        {filtered.map((item, idx) => {
          const Icon = item.icon;
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.command}
              type="button"
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                isSelected
                  ? 'bg-[var(--app-accent)] text-white shadow-md'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-black/40 text-[var(--app-accent)]'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">/{item.command}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-white/40'}`}>
                    {item.syntax}
                  </span>
                </div>
                <div className={`text-[11px] truncate ${isSelected ? 'text-white/90' : 'text-white/60'}`}>
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
