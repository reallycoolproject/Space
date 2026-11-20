import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Shield,
  ShieldAlert,
  Trophy,
  Ticket,
  Layers,
  Palette,
  Send,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Check,
  AlertCircle,
  ExternalLink,
  Save,
  RefreshCw,
  Eye,
  Sliders,
  Users,
  MessageSquare,
  Hash,
  UserPlus,
  Zap,
  Award,
  Terminal,
  Volume2,
  Bell,
  X,
  Copy,
  ChevronRight
} from 'lucide-react';
import { API_BASE } from '../../config';
import { NikoEmbedCard, NikoActionRows, type NikoEmbedData, type NikoActionRow } from './NikoEmbedCard';

interface NikoStudioModalProps {
  spaceId: string;
  space: any;
  onClose?: () => void;
  onRefreshSpace?: () => void;
}

export function NikoStudioModal({ spaceId, space, onClose, onRefreshSpace }: NikoStudioModalProps) {
  const [activeTab, setActiveTab] = useState<'embeds' | 'welcome' | 'leveling' | 'tickets' | 'roles' | 'automod' | 'commands' | 'profile'>('embeds');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Niko Config State
  const [config, setConfig] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  // 1. Embed Studio State
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [broadcastMode, setBroadcastMode] = useState<'single' | 'multiple'>('single');
  const [templateName, setTemplateName] = useState('');
  const [embedTitle, setEmbedTitle] = useState('Welcome to our Space!');
  const [embedTitleUrl, setEmbedTitleUrl] = useState('');
  const [embedDescription, setEmbedDescription] = useState('We are thrilled to have you here! Check out the rules and pick your roles below.');
  const [embedColor, setEmbedColor] = useState('#5865F2');
  const [authorName, setAuthorName] = useState(space.name || '');
  const [authorIconUrl, setAuthorIconUrl] = useState(space.icon || '');
  const [authorUrl, setAuthorUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [footerText, setFooterText] = useState(`Official announcement · ${space.name}`);
  const [footerIconUrl, setFooterIconUrl] = useState('');
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [fields, setFields] = useState<Array<{ id: string; name: string; value: string; inline: boolean }>>([
    { id: '1', name: 'Rules', value: 'Be respectful and kind', inline: true },
    { id: '2', name: 'Support', value: 'Open a ticket anytime', inline: true }
  ]);
  const [components, setComponents] = useState<NikoActionRow[]>([]);
  const [webhookUsername, setWebhookUsername] = useState('');
  const [webhookAvatar, setWebhookAvatar] = useState('');
  const [sendSuccessMsg, setSendSuccessMsg] = useState('');

  // 2. Role Automation State
  const [rolePanelTitle, setRolePanelTitle] = useState('Pick Your Roles');
  const [rolePanelChannelId, setRolePanelChannelId] = useState('');
  const [rolePanelMode, setRolePanelMode] = useState<'toggle' | 'verify' | 'unique' | 'dropdown'>('toggle');
  const [selectedPanelRoles, setSelectedPanelRoles] = useState<Array<{ roleId: string; label: string; emoji: string; style: string }>>([]);

  // 3. Leveling Milestone State
  const [newRewardLevel, setNewRewardLevel] = useState<number>(5);
  const [newRewardRoleId, setNewRewardRoleId] = useState<string>('');

  // 4. Custom Command State
  const [newCmdTrigger, setNewCmdTrigger] = useState('');
  const [newCmdResponse, setNewCmdResponse] = useState('');
  const [newCmdDelete, setNewCmdDelete] = useState(false);

  // 5. Bad Word Filter State
  const [badWordInput, setBadWordInput] = useState('');

  // Fetch Niko Config on mount
  useEffect(() => {
    loadNiko();
  }, [spaceId]);

  const loadNiko = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Failed to load Niko');
      setConfig(data.config);
      setStats(data.stats);
      if (space.channels?.length > 0) {
        if (!selectedChannelId) {
          const firstText = space.channels.find((c: any) => c.type === 'text') || space.channels[0];
          setSelectedChannelId(firstText.id);
          setSelectedChannelIds([firstText.id]);
          setRolePanelChannelId(firstText.id);
        }
      }
      if (space.roles?.length > 0 && !newRewardRoleId) {
        setNewRewardRoleId(space.roles[0].id);
      }
    } catch (e: any) {
      setError(e.message || 'Error loading Niko');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (patch: any) => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Failed to save config');
      setConfig(data.config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onRefreshSpace) onRefreshSpace();
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Embed Dispatcher (Supports Single & Multi-Channel Broadcast)
  const handleDispatchEmbed = async () => {
    const targetIds = broadcastMode === 'multiple' ? selectedChannelIds : (selectedChannelId ? [selectedChannelId] : []);
    if (targetIds.length === 0) {
      setError('Please choose at least one target channel to send this embed');
      return;
    }
    setSaving(true);
    setError(null);
    setSendSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const embedPayload: NikoEmbedData = {
        color: embedColor,
        title: embedTitle,
        titleUrl: embedTitleUrl || undefined,
        description: embedDescription,
        author: authorName ? { name: authorName, iconUrl: authorIconUrl, url: authorUrl } : undefined,
        fields,
        thumbnailUrl: thumbnailUrl || undefined,
        imageUrl: imageUrl || undefined,
        footer: footerText ? { text: footerText, iconUrl: footerIconUrl, timestamp: includeTimestamp } : undefined,
        timestamp: includeTimestamp ? new Date().toISOString() : undefined
      };

      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko/embeds/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          channelIds: targetIds,
          channelId: targetIds[0],
          embed: embedPayload,
          components,
          webhookOverride: webhookUsername ? { username: webhookUsername, avatarUrl: webhookAvatar } : undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Failed to send embed');
      setSendSuccessMsg(`✅ Embed dispatched successfully to ${targetIds.length} channel(s)!`);
      setTimeout(() => setSendSuccessMsg(''), 4000);
    } catch (e: any) {
      setError(e.message || 'Failed to dispatch embed');
    } finally {
      setSaving(false);
    }
  };

  // Save Current as Template
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('Please enter a template name before saving');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const templatePayload = {
        name: templateName.trim(),
        color: embedColor,
        title: embedTitle,
        titleUrl: embedTitleUrl,
        description: embedDescription,
        author: authorName ? { name: authorName, iconUrl: authorIconUrl, url: authorUrl } : undefined,
        fields,
        thumbnailUrl,
        imageUrl,
        footer: footerText ? { text: footerText, iconUrl: footerIconUrl, timestamp: includeTimestamp } : undefined
      };
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko/embed-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ template: templatePayload })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Failed to save template');
      setConfig((prev: any) => ({ ...prev, embedTemplates: data.templates }));
      setTemplateName('');
      setSendSuccessMsg('✅ Embed template saved successfully!');
      setTimeout(() => setSendSuccessMsg(''), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Load Template
  const handleLoadTemplate = (t: any) => {
    setEmbedTitle(t.title || '');
    setEmbedTitleUrl(t.titleUrl || '');
    setEmbedDescription(t.description || '');
    setEmbedColor(t.color || '#5865F2');
    if (t.author) {
      setAuthorName(t.author.name || '');
      setAuthorIconUrl(t.author.iconUrl || '');
      setAuthorUrl(t.author.url || '');
    }
    if (t.footer) {
      setFooterText(t.footer.text || '');
      setFooterIconUrl(t.footer.iconUrl || '');
      setIncludeTimestamp(t.footer.timestamp !== false);
    }
    setThumbnailUrl(t.thumbnailUrl || '');
    setImageUrl(t.imageUrl || '');
    if (Array.isArray(t.fields)) {
      setFields(t.fields);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko/embed-templates/${templateId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message);
      setConfig((prev: any) => ({ ...prev, embedTemplates: data.templates }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Built-in Presets
  const embedPresets = [
    {
      name: 'Server Rules',
      icon: '📜',
      color: '#5865F2',
      title: '📜 Space Rules & Guidelines',
      description: 'Welcome to our Space! Please adhere to the following community guidelines to ensure a welcoming and safe environment for all members.',
      fields: [
        { id: '1', name: '1. Respect Everyone', value: 'Treat all members with courtesy and dignity. Harassment, hate speech, and toxicity will result in an immediate ban.', inline: false },
        { id: '2', name: '2. No Spam or Self-Promotion', value: 'Avoid unsolicited advertising, spamming links, or excessive mentions.', inline: false },
        { id: '3', name: '3. Follow Channel Topics', value: 'Keep discussions relevant to the corresponding text and voice channels.', inline: false }
      ],
      footer: `Community Safety Guidelines · ${space.name}`
    },
    {
      name: 'Welcome Guide',
      icon: '👋',
      color: '#57F287',
      title: '👋 Welcome to the Community!',
      description: 'Hey there! We are thrilled to welcome you to **{space.name}**. Here are a few helpful resources to get you settled in.',
      fields: [
        { id: '1', name: '📢 Announcements', value: 'Check out official news and game updates', inline: true },
        { id: '2', name: '💬 General Chat', value: 'Introduce yourself and meet friends', inline: true },
        { id: '3', name: '🎫 Help Desk', value: 'Open a ticket if you need staff support', inline: true }
      ],
      footer: `New Member Onboarding · Total Members: {member_count}`
    },
    {
      name: 'FAQ & Help',
      icon: '❓',
      color: '#00B0F4',
      title: '❓ Frequently Asked Questions',
      description: 'Have a question? Check out our quick answers below before opening a support ticket.',
      fields: [
        { id: '1', name: 'How do I get roles?', value: 'Visit the role selection channel or use our role menu buttons below.', inline: false },
        { id: '2', name: 'How do level rewards work?', value: 'Chatting in text channels and chilling in voice channels earns XP. Reaching milestones unlocks exclusive roles!', inline: false }
      ],
      footer: `Support Knowledge Base · ${space.name}`
    },
    {
      name: 'Space Perks & VIP',
      icon: '💎',
      color: '#EB459E',
      title: '💎 Space Perks & VIP Tiers',
      description: 'Support our Space to unlock exclusive privileges, custom badges, and VIP lounge access.',
      fields: [
        { id: '1', name: '✨ VIP Supporter', value: 'Colored identity badge, 2x XP booster, and private VIP lounge', inline: true },
        { id: '2', name: '🌟 Server Booster', value: 'Exclusive booster icon, role hoist, and custom emoji access', inline: true }
      ],
      footer: `Community Perks · ${space.name}`
    }
  ];

  // 1-Click Lockdown
  const handleToggleLockdown = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko/automod/lockdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enable: !stats?.isLockedDown })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message);
      await loadNiko();
      if (onRefreshSpace) onRefreshSpace();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Add Field
  const handleAddField = () => {
    if (fields.length >= 25) return;
    setFields([...fields, { id: String(Date.now()), name: 'Field Name', value: 'Field value', inline: true }]);
  };

  // Move Field
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const newFields = [...fields];
    const temp = newFields[index];
    newFields[index] = newFields[targetIndex];
    newFields[targetIndex] = temp;
    setFields(newFields);
  };

  // Remove Field
  const handleRemoveField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  // Add Action Button
  const handleAddButton = () => {
    const newComponent = {
      type: 'button' as const,
      id: `btn_${Date.now()}`,
      label: 'Interactive Button',
      emoji: '⭐',
      style: 'primary' as const,
      actionType: 'role' as const,
      targetId: space.roles?.[0]?.id || ''
    };
    if (components.length === 0) {
      setComponents([{ type: 'action_row', components: [newComponent] }]);
    } else {
      const updated = [...components];
      if (updated[0].components.length < 5) {
        updated[0].components.push(newComponent);
      } else if (updated.length < 5) {
        updated.push({ type: 'action_row', components: [newComponent] });
      }
      setComponents(updated);
    }
  };

  // Deploy Role Panel
  const handleDeployRolePanel = async () => {
    if (!rolePanelChannelId || selectedPanelRoles.length === 0) {
      setError('Please choose a channel and at least one role to deploy');
      return;
    }
    const row: NikoActionRow = {
      type: 'action_row',
      components: selectedPanelRoles.map((r, i) => ({
        type: rolePanelMode === 'dropdown' ? 'select' : 'button',
        id: `role_${r.roleId}_${i}`,
        label: r.label,
        emoji: r.emoji,
        style: r.style as any || 'primary',
        actionType: 'role',
        targetId: r.roleId
      }))
    };

    const embed: NikoEmbedData = {
      color: '#5865F2',
      title: `🎭 ${rolePanelTitle}`,
      description: 'Click the buttons below to assign or remove roles from your profile instantly!\n\n' +
        selectedPanelRoles.map(r => `${r.emoji || '▫️'} **@${r.label}**`).join('\n'),
      footer: { text: 'Niko Role Automation · Self-assign roles', timestamp: true }
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko/embeds/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          channelId: rolePanelChannelId,
          embed,
          components: [row]
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message);
      setSendSuccessMsg('✅ Role Panel deployed to chat!');
      setTimeout(() => setSendSuccessMsg(''), 4000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Deploy Ticket Panel
  const handleDeployTicketPanel = async (channelId: string) => {
    const embed: NikoEmbedData = {
      color: '#5865F2',
      title: '🎫 Support & Help Desk',
      description: 'Need assistance, have a billing question, or want to report a rule violation?\n\nClick the button below to open an encrypted private ticket with staff!',
      fields: [
        { id: '1', name: 'General Support', value: 'Questions about channels, perks, and help', inline: true },
        { id: '2', name: 'Confidential Reports', value: 'Directly handled by moderators', inline: true }
      ],
      footer: { text: 'Niko Ticket Tool · 24/7 Support Desk', timestamp: true }
    };

    const row: NikoActionRow = {
      type: 'action_row',
      components: [
        {
          type: 'button',
          id: 'btn_create_ticket',
          label: 'Create Ticket',
          emoji: '🎫',
          style: 'primary',
          actionType: 'ticket_create',
          targetId: 'general'
        }
      ]
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko/embeds/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          channelId,
          embed,
          components: [row]
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message);
      setSendSuccessMsg('✅ Ticket Panel deployed to support channel!');
      setTimeout(() => setSendSuccessMsg(''), 4000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Add Milestone Reward
  const handleAddMilestoneReward = () => {
    if (!newRewardRoleId) return;
    const existing = config?.levelingConfig?.roleRewards || [];
    const updated = [...existing.filter((r: any) => r.level !== newRewardLevel), { level: newRewardLevel, roleId: newRewardRoleId }];
    updated.sort((a, b) => a.level - b.level);
    setConfig((prev: any) => ({
      ...prev,
      levelingConfig: { ...prev.levelingConfig, roleRewards: updated }
    }));
  };

  // Remove Milestone Reward
  const handleRemoveMilestoneReward = (level: number) => {
    const existing = config?.levelingConfig?.roleRewards || [];
    setConfig((prev: any) => ({
      ...prev,
      levelingConfig: { ...prev.levelingConfig, roleRewards: existing.filter((r: any) => r.level !== level) }
    }));
  };

  // Add Bad Word
  const handleAddBadWord = () => {
    if (!badWordInput.trim()) return;
    const currentWords = config?.automodConfig?.badWords?.words || [];
    const newWords = [...new Set([...currentWords, badWordInput.trim().toLowerCase()])];
    setConfig((prev: any) => ({
      ...prev,
      automodConfig: {
        ...prev.automodConfig,
        badWords: { ...prev.automodConfig?.badWords, words: newWords }
      }
    }));
    setBadWordInput('');
  };

  // Remove Bad Word
  const handleRemoveBadWord = (word: string) => {
    const currentWords = config?.automodConfig?.badWords?.words || [];
    setConfig((prev: any) => ({
      ...prev,
      automodConfig: {
        ...prev.automodConfig,
        badWords: { ...prev.automodConfig?.badWords, words: currentWords.filter((w: string) => w !== word) }
      }
    }));
  };

  // Add Custom Command
  const handleAddCustomCommand = () => {
    if (!newCmdTrigger.trim() || !newCmdResponse.trim()) {
      setError('Please provide both a trigger and a response for the command');
      return;
    }
    const cleanTrigger = newCmdTrigger.trim().replace(/^[/!]/, '');
    const newCmd = {
      id: String(Date.now()),
      trigger: cleanTrigger,
      matchType: 'exact',
      responseText: newCmdResponse.trim(),
      deleteTrigger: newCmdDelete
    };
    const currentCmds = config?.customCommands || [];
    setConfig((prev: any) => ({
      ...prev,
      customCommands: [...currentCmds.filter((c: any) => c.trigger.toLowerCase() !== cleanTrigger.toLowerCase()), newCmd]
    }));
    setNewCmdTrigger('');
    setNewCmdResponse('');
    setNewCmdDelete(false);
  };

  // Remove Custom Command
  const handleRemoveCustomCommand = (id: string) => {
    const currentCmds = config?.customCommands || [];
    setConfig((prev: any) => ({
      ...prev,
      customCommands: currentCmds.filter((c: any) => c.id !== id)
    }));
  };

  const previewEmbed: NikoEmbedData = {
    color: embedColor,
    title: embedTitle,
    titleUrl: embedTitleUrl,
    description: embedDescription,
    author: authorName ? { name: authorName, iconUrl: authorIconUrl, url: authorUrl } : undefined,
    fields,
    thumbnailUrl,
    imageUrl,
    footer: footerText ? { text: footerText, iconUrl: footerIconUrl, timestamp: includeTimestamp } : undefined,
    timestamp: includeTimestamp ? new Date().toISOString() : undefined
  };

  const discordColorPresets = [
    { label: 'Blurple', hex: '#5865F2' },
    { label: 'Green', hex: '#57F287' },
    { label: 'Yellow', hex: '#FEE75C' },
    { label: 'Fuchsia', hex: '#EB459E' },
    { label: 'Red', hex: '#ED4245' },
    { label: 'Cyan', hex: '#00B0F4' },
    { label: 'Dark', hex: '#2B2D31' }
  ];

  const textChannels = space.channels?.filter((c: any) => c.type === 'text') || [];

  return (
    <div className="flex flex-col h-full bg-[#111214] text-white overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      {/* Studio Header */}
      <div className="px-6 py-4 bg-[#1e1f22] border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg flex items-center justify-center">
            <div className="w-full h-full bg-[#111214] rounded-[14px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Niko Studio <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-extrabold uppercase border border-indigo-500/30">Built-in Bot</span>
              </h2>
            </div>
            <p className="text-xs text-white/50">Full Automation, Visual Embeds, Welcome Suite, Leveling Rewards, Tickets & AutoMod</p>
          </div>
        </div>

        {/* Global Anti-Raid Panic Switch & Close */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleLockdown}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              stats?.isLockedDown
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-white/10 hover:bg-red-500/20 text-white/80 hover:text-red-300 border border-white/10'
            }`}
          >
            {stats?.isLockedDown ? <Lock className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4 text-red-400" />}
            <span>{stats?.isLockedDown ? 'LIFT LOCKDOWN' : 'ANTI-RAID LOCKDOWN'}</span>
          </button>

          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center px-6 bg-[#18191c] border-b border-white/10 overflow-x-auto gap-1 py-1.5 shrink-0 custom-scrollbar">
        {[
          { id: 'embeds', label: 'Embed Studio', icon: Sparkles },
          { id: 'welcome', label: 'Welcome & Greeter', icon: UserPlus },
          { id: 'leveling', label: 'Leveling & Role Rewards', icon: Trophy },
          { id: 'tickets', label: 'Support Tickets', icon: Ticket },
          { id: 'roles', label: 'Reaction & Button Roles', icon: Layers },
          { id: 'automod', label: 'AutoMod & Anti-Raid', icon: Shield },
          { id: 'commands', label: 'Custom Commands', icon: Terminal },
          { id: 'profile', label: 'Bot Profile & Mascot', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[var(--app-accent)] text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#111214] custom-scrollbar">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</span>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-white">✕</button>
          </div>
        )}
        {saveSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" /> Settings updated successfully!
          </div>
        )}
        {sendSuccessMsg && (
          <div className="mb-4 p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" /> {sendSuccessMsg}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: VISUAL EMBED STUDIO (Sapphire / Discohook Grade)   */}
        {/* ========================================================= */}
        {activeTab === 'embeds' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Live Controls */}
            <div className="lg:col-span-7 space-y-4">
              {/* Preset Templates Bar */}
              <div className="bg-[#1e1f22] p-4 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Quick-Load Built-in Templates
                  </span>
                  <span className="text-[10px] text-white/40">1-Click Discohook Presets</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {embedPresets.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setEmbedTitle(preset.title);
                        setEmbedDescription(preset.description);
                        setEmbedColor(preset.color);
                        setFields(preset.fields);
                        setFooterText(preset.footer);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-white flex items-center gap-1.5 transition-all"
                    >
                      <span>{preset.icon}</span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Accent & Palette */}
              <div className="bg-[#1e1f22] p-4 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-400" /> Color Accent & Palette
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: embedColor }} />
                    <input
                      type="text"
                      value={embedColor}
                      onChange={e => setEmbedColor(e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg bg-black/40 border border-white/15 text-xs text-white uppercase font-mono"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {discordColorPresets.map(preset => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setEmbedColor(preset.hex)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-white/10 flex items-center gap-1.5 hover:scale-105 transition-all"
                      style={{ backgroundColor: preset.hex }}
                    >
                      <span className="text-white drop-shadow">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Author & Header Block */}
              <div className="bg-[#1e1f22] p-4 rounded-2xl border border-white/10 space-y-3">
                <h3 className="text-sm font-bold text-white">Author Block</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Author Name</label>
                    <input
                      type="text"
                      value={authorName}
                      onChange={e => setAuthorName(e.target.value)}
                      placeholder="e.g. Space Announcements"
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Author Icon URL</label>
                    <input
                      type="text"
                      value={authorIconUrl}
                      onChange={e => setAuthorIconUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="bg-[#1e1f22] p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Body Content & Variables</h3>
                  <div className="flex gap-1 flex-wrap">
                    {['{user}', '{user.mention}', '{space.name}', '{member_count}', '{date}'].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEmbedDescription(prev => prev + ' ' + v)}
                        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-indigo-300 font-mono"
                      >
                        +{v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Title</label>
                  <input
                    type="text"
                    value={embedTitle}
                    onChange={e => setEmbedTitle(e.target.value)}
                    placeholder="Embed title..."
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Description (Markdown Supported)</label>
                  <textarea
                    rows={4}
                    value={embedDescription}
                    onChange={e => setEmbedDescription(e.target.value)}
                    placeholder="Write your markdown description..."
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white custom-scrollbar resize-none"
                  />
                </div>
              </div>

              {/* Dynamic Fields Builder */}
              <div className="bg-[#1e1f22] p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Fields ({fields.length}/25)</h3>
                    <p className="text-[11px] text-white/50">Toggle "Inline" to align fields in horizontal columns</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddField}
                    disabled={fields.length >= 25}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Field
                  </button>
                </div>

                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <button type="button" onClick={() => handleMoveField(index, 'up')} disabled={index === 0} className="p-0.5 rounded text-white/50 hover:text-white disabled:opacity-20"><ArrowUp className="w-3 h-3" /></button>
                        <button type="button" onClick={() => handleMoveField(index, 'down')} disabled={index === fields.length - 1} className="p-0.5 rounded text-white/50 hover:text-white disabled:opacity-20"><ArrowDown className="w-3 h-3" /></button>
                      </div>
                      <input
                        type="text"
                        value={field.name}
                        onChange={e => {
                          const updated = [...fields];
                          updated[index].name = e.target.value;
                          setFields(updated);
                        }}
                        placeholder="Field Title"
                        className="w-1/3 px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={field.value}
                        onChange={e => {
                          const updated = [...fields];
                          updated[index].value = e.target.value;
                          setFields(updated);
                        }}
                        placeholder="Field Value"
                        className="flex-1 px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.inline}
                          onChange={e => {
                            const updated = [...fields];
                            updated[index].inline = e.target.checked;
                            setFields(updated);
                          }}
                          className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                        />
                        Inline
                      </label>
                      <button type="button" onClick={() => handleRemoveField(field.id)} className="p-1 rounded text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Media & Imagery */}
              <div className="bg-[#1e1f22] p-4 rounded-2xl border border-white/10 space-y-3">
                <h3 className="text-sm font-bold text-white">Media URLs</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Thumbnail URL</label>
                    <input
                      type="text"
                      value={thumbnailUrl}
                      onChange={e => setThumbnailUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Main Image URL</label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Block */}
              <div className="bg-[#1e1f22] p-4 rounded-2xl border border-white/10 space-y-3">
                <h3 className="text-sm font-bold text-white">Footer Block</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Footer Text</label>
                    <input
                      type="text"
                      value={footerText}
                      onChange={e => setFooterText(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Footer Icon URL</label>
                    <input
                      type="text"
                      value={footerIconUrl}
                      onChange={e => setFooterIconUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={includeTimestamp}
                    onChange={e => setIncludeTimestamp(e.target.checked)}
                    className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                  />
                  Include Dynamic Live Timestamp
                </label>
              </div>

              {/* Save Template & Manage Templates */}
              <div className="bg-[#1e1f22] p-4 rounded-2xl border border-white/10 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Copy className="w-4 h-4 text-amber-400" /> Save as Reusable Template
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="Enter template name (e.g. Weekly News, Rules)"
                    className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs text-white flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Template
                  </button>
                </div>
                {config?.embedTemplates?.length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-[11px] text-white/50 block mb-2">Saved Custom Templates:</span>
                    <div className="flex flex-wrap gap-2">
                      {config.embedTemplates.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1">
                          <button
                            type="button"
                            onClick={() => handleLoadTemplate(t)}
                            className="text-xs text-indigo-300 hover:text-white font-medium"
                          >
                            {t.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="text-red-400 hover:text-red-300 text-[10px] ml-1.5"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Target Channel(s) & Dispatch */}
              <div className="bg-[#1e1f22] p-4 rounded-2xl border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" /> Target Channel & Delivery
                  </h3>
                  <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setBroadcastMode('single')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${broadcastMode === 'single' ? 'bg-[var(--app-accent)] text-white' : 'text-white/50 hover:text-white'}`}
                    >
                      Single Channel
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastMode('multiple')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${broadcastMode === 'multiple' ? 'bg-[var(--app-accent)] text-white' : 'text-white/50 hover:text-white'}`}
                    >
                      Multi-Channel Broadcast
                    </button>
                  </div>
                </div>

                {broadcastMode === 'single' ? (
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Post to Channel</label>
                    <select
                      value={selectedChannelId}
                      onChange={e => setSelectedChannelId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    >
                      {textChannels.map((c: any) => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-2 block">
                      Select All Target Channels to Broadcast ({selectedChannelIds.length} selected):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-black/30 border border-white/10">
                      {textChannels.map((c: any) => {
                        const checked = selectedChannelIds.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-xs text-white/80 cursor-pointer p-1 rounded hover:bg-white/5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                if (e.target.checked) setSelectedChannelIds(prev => [...prev, c.id]);
                                else setSelectedChannelIds(prev => prev.filter(id => id !== c.id));
                              }}
                              className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                            />
                            <span className="truncate">#{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Webhook Simulation (Custom Identity)</label>
                  <input
                    type="text"
                    value={webhookUsername}
                    onChange={e => setWebhookUsername(e.target.value)}
                    placeholder="Custom Bot / Sender Name (Optional)"
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                  />
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDispatchEmbed}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 font-bold text-xs text-white flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {broadcastMode === 'multiple'
                      ? `Broadcast Embed to ${selectedChannelIds.length} Selected Channels`
                      : `Send Embed to #${textChannels.find((c: any) => c.id === selectedChannelId)?.name || 'Channel'}`}
                  </span>
                </button>
              </div>
            </div>

            {/* Right Column: Live Discord-Grade Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-indigo-400" /> Live Embed Preview
                  </span>
                  <span className="text-[10px] text-white/40">Discohook / Sapphire Accurate</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#2b2d31]/80 border border-white/10 shadow-2xl">
                  {/* Sender identity */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                      <img
                        src={webhookAvatar || config?.botAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Niko'}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{webhookUsername || config?.botName || 'Niko'}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-[#5865F2] text-white">BOT</span>
                      </div>
                      <span className="text-[10px] text-white/40">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Rendered Live Embed */}
                  <NikoEmbedCard embed={previewEmbed} spaceId={spaceId} channelId={selectedChannelId} />
                  <NikoActionRows rows={components} spaceId={spaceId} channelId={selectedChannelId} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: WELCOME & GREETER SUITE (Mee6 / Carl-bot Grade)     */}
        {/* ========================================================= */}
        {activeTab === 'welcome' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-[#1e1f22] p-5 rounded-2xl border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-400" /> Welcome & Greeter Studio
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Automatically greet new joiners with custom markdown embeds, assign auto-roles instantly, send DM greetings, and post goodbye notes.
                </p>
              </div>

              {/* 1. Welcome Channel & Toggle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Send a Welcome Message when a user joins</h4>
                    <p className="text-xs text-white/50">Post an official welcome card to a designated welcome or general channel</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config?.welcomeConfig?.enabled ?? false}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      welcomeConfig: { ...prev.welcomeConfig, enabled: e.target.checked }
                    }))}
                    className="w-5 h-5 rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                  />
                </div>

                {config?.welcomeConfig?.enabled && (
                  <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-4">
                    <div>
                      <label className="text-[11px] font-semibold text-white/60 mb-1 block">Welcome Announcement Channel</label>
                      <select
                        value={config?.welcomeConfig?.channelId || ''}
                        onChange={e => setConfig((prev: any) => ({
                          ...prev,
                          welcomeConfig: { ...prev.welcomeConfig, channelId: e.target.value }
                        }))}
                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                      >
                        <option value="">Select a text channel...</option>
                        {textChannels.map((c: any) => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-white/60">Welcome Message (Markdown & Variables)</label>
                        <div className="flex gap-1 flex-wrap">
                          {['{user}', '{user.mention}', '{space.name}', '{member_count}'].map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setConfig((prev: any) => ({
                                ...prev,
                                welcomeConfig: {
                                  ...prev.welcomeConfig,
                                  message: (prev.welcomeConfig?.message || '') + ' ' + v
                                }
                              }))}
                              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-indigo-300 font-mono"
                            >
                              +{v}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        rows={3}
                        value={config?.welcomeConfig?.message || 'Welcome to **{space.name}**, {user.mention}! 🎉 We are glad to have you here.'}
                        onChange={e => setConfig((prev: any) => ({
                          ...prev,
                          welcomeConfig: { ...prev.welcomeConfig, message: e.target.value }
                        }))}
                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white custom-scrollbar resize-none"
                      />
                    </div>

                    {/* Send DM Greeting */}
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config?.welcomeConfig?.sendDm ?? false}
                          onChange={e => setConfig((prev: any) => ({
                            ...prev,
                            welcomeConfig: { ...prev.welcomeConfig, sendDm: e.target.checked }
                          }))}
                          className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                        />
                        Send a private Direct Message (DM) to new members
                      </label>
                      {config?.welcomeConfig?.sendDm && (
                        <input
                          type="text"
                          value={config?.welcomeConfig?.dmMessage || ''}
                          onChange={e => setConfig((prev: any) => ({
                            ...prev,
                            welcomeConfig: { ...prev.welcomeConfig, dmMessage: e.target.value }
                          }))}
                          placeholder="e.g. Welcome to our server! Make sure to read the rules in #rules!"
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Auto-Roles on Join */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-400" /> Auto-Roles on Join
                  </h4>
                  <p className="text-xs text-white/50">Select roles automatically assigned to every new member upon joining</p>
                </div>

                <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-black/30 border border-white/10">
                  {space.roles?.map((role: any) => {
                    const isSelected = (config?.welcomeConfig?.autoRoleIds || []).includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          const current = config?.welcomeConfig?.autoRoleIds || [];
                          const updated = isSelected ? current.filter((id: string) => id !== role.id) : [...current, role.id];
                          setConfig((prev: any) => ({
                            ...prev,
                            welcomeConfig: { ...prev.welcomeConfig, autoRoleIds: updated }
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-sm'
                            : 'bg-black/40 border-white/10 text-white/50 hover:text-white'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role.color || '#99aab5' }} />
                        <span>@{role.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Goodbye Message */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Send a Goodbye Message when a member leaves</h4>
                    <p className="text-xs text-white/50">Post an announcement when someone departs the Space</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config?.welcomeConfig?.goodbyeEnabled ?? false}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      welcomeConfig: { ...prev.welcomeConfig, goodbyeEnabled: e.target.checked }
                    }))}
                    className="w-5 h-5 rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                  />
                </div>

                {config?.welcomeConfig?.goodbyeEnabled && (
                  <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-white/60 mb-1 block">Goodbye Channel</label>
                      <select
                        value={config?.welcomeConfig?.goodbyeChannelId || ''}
                        onChange={e => setConfig((prev: any) => ({
                          ...prev,
                          welcomeConfig: { ...prev.welcomeConfig, goodbyeChannelId: e.target.value }
                        }))}
                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                      >
                        <option value="">Select a text channel...</option>
                        {textChannels.map((c: any) => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-white/60 mb-1 block">Goodbye Message</label>
                      <input
                        type="text"
                        value={config?.welcomeConfig?.goodbyeMessage || 'Goodbye **{user}**, we will miss you!'}
                        onChange={e => setConfig((prev: any) => ({
                          ...prev,
                          welcomeConfig: { ...prev.welcomeConfig, goodbyeMessage: e.target.value }
                        }))}
                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveConfig({ welcomeConfig: config?.welcomeConfig })}
                  className="px-6 py-2.5 rounded-xl bg-[var(--app-accent)] font-bold text-xs text-white flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" /> Save Greeter Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: LEVELING, XP & ROLE REWARDS (Arcane Grade)         */}
        {/* ========================================================= */}
        {activeTab === 'leveling' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-[#1e1f22] p-5 rounded-2xl border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" /> Leveling, XP Engine & Automated Role Rewards
                  </h3>
                  <p className="text-xs text-white/50 mt-1">
                    Reward members for chatting and speaking in voice channels. Configure level-up announcements, congratulatory embeds, and milestone role rewards.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer bg-black/30 px-3 py-1.5 rounded-xl border border-white/10">
                  <input
                    type="checkbox"
                    checked={config?.levelingConfig?.enabled ?? true}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      levelingConfig: { ...prev.levelingConfig, enabled: e.target.checked }
                    }))}
                    className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                  />
                  Leveling System Enabled
                </label>
              </div>

              {/* 1. XP Engine Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Min XP Per Message</label>
                  <input
                    type="number"
                    value={config?.levelingConfig?.minXp || 15}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      levelingConfig: { ...prev.levelingConfig, minXp: parseInt(e.target.value) || 15 }
                    }))}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Max XP Per Message</label>
                  <input
                    type="number"
                    value={config?.levelingConfig?.maxXp || 25}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      levelingConfig: { ...prev.levelingConfig, maxXp: parseInt(e.target.value) || 25 }
                    }))}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Anti-Spam Cooldown</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={config?.levelingConfig?.cooldownSeconds || 60}
                      onChange={e => setConfig((prev: any) => ({
                        ...prev,
                        levelingConfig: { ...prev.levelingConfig, cooldownSeconds: parseInt(e.target.value) || 60 }
                      }))}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white pr-8"
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-white/40">sec</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Voice XP Rate</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={config?.levelingConfig?.voiceXpPerMin || 10}
                      onChange={e => setConfig((prev: any) => ({
                        ...prev,
                        levelingConfig: { ...prev.levelingConfig, voiceXpPerMin: parseInt(e.target.value) || 10 }
                      }))}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white pr-10"
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-white/40">/min</span>
                  </div>
                </div>
              </div>

              {/* 2. Level-Up Announcement Channel & Custom Message */}
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" /> Level-Up Celebrations & Announcements
                    </h4>
                    <p className="text-xs text-white/50">Where and how Niko celebrates members when they reach a new level</p>
                  </div>
                  <select
                    value={config?.levelingConfig?.alertType || 'channel'}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      levelingConfig: { ...prev.levelingConfig, alertType: e.target.value }
                    }))}
                    className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white font-semibold"
                  >
                    <option value="channel">Specific Channel</option>
                    <option value="current">Current Channel Where Leveled Up</option>
                    <option value="dm">Direct Message (DM)</option>
                    <option value="disabled">Disabled (Silent)</option>
                  </select>
                </div>

                {config?.levelingConfig?.alertType === 'channel' && (
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Announcement Text Channel</label>
                    <select
                      value={config?.levelingConfig?.announcementChannelId || ''}
                      onChange={e => setConfig((prev: any) => ({
                        ...prev,
                        levelingConfig: { ...prev.levelingConfig, announcementChannelId: e.target.value }
                      }))}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    >
                      <option value="">Select announcement channel (e.g. #level-ups)...</option>
                      {textChannels.map((c: any) => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-white/60">Level-Up Congratulations Message</label>
                    <div className="flex gap-1 flex-wrap">
                      {['{user}', '{user.mention}', '{level}', '{role}', '{space.name}'].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setConfig((prev: any) => ({
                            ...prev,
                            levelingConfig: {
                              ...prev.levelingConfig,
                              levelUpMessage: (prev.levelingConfig?.levelUpMessage || '') + ' ' + v
                            }
                          }))}
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-amber-300 font-mono"
                        >
                          +{v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={config?.levelingConfig?.levelUpMessage || '🎉 GG {user.mention}! You just leveled up to **Level {level}**{role}!'}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      levelingConfig: { ...prev.levelingConfig, levelUpMessage: e.target.value }
                    }))}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white custom-scrollbar resize-none font-medium"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={config?.levelingConfig?.sendEmbed ?? true}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      levelingConfig: { ...prev.levelingConfig, sendEmbed: e.target.checked }
                    }))}
                    className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                  />
                  Post full colorful Rank & Level-Up Embed Card with member avatar and rank stats
                </label>
              </div>

              {/* 3. Milestone Role Rewards (Arcane Grade) */}
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-yellow-400" /> Milestone Role Rewards
                    </h4>
                    <p className="text-xs text-white/50">Automatically grant roles when members hit level milestones (e.g. Level 5 $\rightarrow$ @Active)</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config?.levelingConfig?.stackRoles ?? true}
                      onChange={e => setConfig((prev: any) => ({
                        ...prev,
                        levelingConfig: { ...prev.levelingConfig, stackRoles: e.target.checked }
                      }))}
                      className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                    />
                    Stack Roles (Keep previous rewards)
                  </label>
                </div>

                {/* Current Role Rewards List */}
                <div className="space-y-2">
                  {(config?.levelingConfig?.roleRewards || []).length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-white/15 text-center text-xs text-white/40">
                      No milestone role rewards configured yet. Add your first reward below!
                    </div>
                  ) : (
                    config.levelingConfig.roleRewards.map((reward: any) => {
                      const role = space.roles?.find((r: any) => r.id === reward.roleId);
                      return (
                        <div key={reward.level} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-extrabold text-xs border border-amber-500/30">
                              Level {reward.level}
                            </span>
                            <span className="text-white/40">➔</span>
                            <span className="px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5" style={{ backgroundColor: `${role?.color || '#5865F2'}22`, color: role?.color || '#5865F2' }}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: role?.color || '#5865F2' }} />
                              @{role?.name || 'Unknown Role'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMilestoneReward(reward.level)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Milestone Reward Form */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full sm:w-36">
                    <label className="text-[10px] text-white/50 block mb-1">Required Level</label>
                    <input
                      type="number"
                      min={1}
                      value={newRewardLevel}
                      onChange={e => setNewRewardLevel(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                  <div className="w-full sm:flex-1">
                    <label className="text-[10px] text-white/50 block mb-1">Role Reward</label>
                    <select
                      value={newRewardRoleId}
                      onChange={e => setNewRewardRoleId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    >
                      {space.roles?.map((r: any) => (
                        <option key={r.id} value={r.id}>@{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMilestoneReward}
                    className="w-full sm:w-auto mt-4 sm:mt-5 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Milestone
                  </button>
                </div>
              </div>

              {/* 4. Double XP Roles & No-XP Channels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" /> 2x Double XP Roles (Boosters)
                  </h4>
                  <p className="text-[11px] text-white/50">Members with these roles earn double XP per message</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {space.roles?.map((role: any) => {
                      const isDouble = (config?.levelingConfig?.doubleXpRoleIds || []).includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => {
                            const current = config?.levelingConfig?.doubleXpRoleIds || [];
                            const updated = isDouble ? current.filter((id: string) => id !== role.id) : [...current, role.id];
                            setConfig((prev: any) => ({
                              ...prev,
                              levelingConfig: { ...prev.levelingConfig, doubleXpRoleIds: updated }
                            }));
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold border ${
                            isDouble ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300' : 'bg-black/40 border-white/10 text-white/40'
                          }`}
                        >
                          @{role.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-red-400" /> No-XP Channels (Blacklist)
                  </h4>
                  <p className="text-[11px] text-white/50">Messages sent in these channels will not award XP</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {textChannels.map((c: any) => {
                      const isNoXp = (config?.levelingConfig?.noXpChannelIds || []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const current = config?.levelingConfig?.noXpChannelIds || [];
                            const updated = isNoXp ? current.filter((id: string) => id !== c.id) : [...current, c.id];
                            setConfig((prev: any) => ({
                              ...prev,
                              levelingConfig: { ...prev.levelingConfig, noXpChannelIds: updated }
                            }));
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold border ${
                            isNoXp ? 'bg-red-500/20 border-red-400 text-red-300' : 'bg-black/40 border-white/10 text-white/40'
                          }`}
                        >
                          #{c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveConfig({ levelingConfig: config?.levelingConfig })}
                  className="px-6 py-2.5 rounded-xl bg-[var(--app-accent)] font-bold text-xs text-white flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" /> Save Leveling Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: SUPPORT TICKET TOOL (Ticket Tool Grade)             */}
        {/* ========================================================= */}
        {activeTab === 'tickets' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-[#1e1f22] p-5 rounded-2xl border border-white/10 space-y-5">
              <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-indigo-400" /> Enterprise Support Ticket System
                  </h3>
                  <p className="text-xs text-white/50 mt-1">
                    Generate interactive ticket panels, private channel routing, staff claiming, and automatic chat transcripts.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer bg-black/30 px-3 py-1.5 rounded-xl border border-white/10">
                  <input
                    type="checkbox"
                    checked={config?.ticketConfig?.enabled ?? true}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      ticketConfig: { ...prev.ticketConfig, enabled: e.target.checked }
                    }))}
                    className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                  />
                  Ticket Tool Enabled
                </label>
              </div>

              {/* Ticket Routing & Staff Roles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Support Staff Roles (Full Ticket Access)</label>
                  <p className="text-[10px] text-white/40 mb-2">Select staff roles that can view, claim, and close all tickets</p>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-black/30 border border-white/10 max-h-28 overflow-y-auto">
                    {space.roles?.map((role: any) => {
                      const isStaff = (config?.ticketConfig?.supportRoleIds || []).includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => {
                            const current = config?.ticketConfig?.supportRoleIds || [];
                            const updated = isStaff ? current.filter((id: string) => id !== role.id) : [...current, role.id];
                            setConfig((prev: any) => ({
                              ...prev,
                              ticketConfig: { ...prev.ticketConfig, supportRoleIds: updated }
                            }));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            isStaff ? 'bg-indigo-600/30 border-indigo-400 text-white' : 'bg-black/40 border-white/10 text-white/40'
                          }`}
                        >
                          @{role.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Ticket Transcripts Log Channel</label>
                  <p className="text-[10px] text-white/40 mb-2">Where chat logs are uploaded when tickets are closed</p>
                  <select
                    value={config?.ticketConfig?.transcriptChannelId || ''}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      ticketConfig: { ...prev.ticketConfig, transcriptChannelId: e.target.value }
                    }))}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                  >
                    <option value="">No transcripts channel selected</option>
                    {textChannels.map((c: any) => (
                      <option key={c.id} value={c.id}>#{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Deploy Ticket Panel Button */}
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Deploy Ticket Panel to Channel</h4>
                  <p className="text-xs text-white/50">Posts a styled Support Desk embed with a "Create Ticket" button</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={rolePanelChannelId}
                    onChange={e => setRolePanelChannelId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                  >
                    {textChannels.map((c: any) => (
                      <option key={c.id} value={c.id}>#{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleDeployTicketPanel(rolePanelChannelId || textChannels[0]?.id)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white flex items-center gap-1.5 whitespace-nowrap shadow-md"
                  >
                    <Ticket className="w-4 h-4" /> Deploy Panel
                  </button>
                </div>
              </div>

              {/* Active Tickets List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider text-white/60">
                    Active & Open Tickets ({config?.tickets?.filter((t: any) => t.status !== 'closed').length || 0})
                  </h4>
                  <button type="button" onClick={loadNiko} className="text-xs text-indigo-400 hover:text-white flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>

                <div className="space-y-2">
                  {(config?.tickets || []).filter((t: any) => t.status !== 'closed').length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-white/15 text-center text-xs text-white/40">
                      No open tickets right now. The queue is completely clear!
                    </div>
                  ) : (
                    config.tickets.filter((t: any) => t.status !== 'closed').map((ticket: any) => (
                      <div key={ticket.id} className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <div>
                            <span className="text-xs font-bold text-white">Ticket #{ticket.ticketNumber} — {ticket.categoryName}</span>
                            <span className="text-[10px] text-white/40 block">Opened by @{ticket.creatorUsername} · {new Date(ticket.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                          {ticket.status === 'claimed' ? `Claimed by ${ticket.claimedBy?.username}` : 'Unclaimed'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveConfig({ ticketConfig: config?.ticketConfig })}
                  className="px-6 py-2.5 rounded-xl bg-[var(--app-accent)] font-bold text-xs text-white flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" /> Save Ticket Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: REACTION & BUTTON ROLES (Carl-bot Grade)           */}
        {/* ========================================================= */}
        {activeTab === 'roles' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-[#1e1f22] p-5 rounded-2xl border border-white/10 space-y-5">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" /> Reaction & Button Roles Studio
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Deploy interactive role assignment panels directly into chat. Members can click buttons or select menus to self-assign roles.
                </p>
              </div>

              {/* Panel Config */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Panel Title</label>
                  <input
                    type="text"
                    value={rolePanelTitle}
                    onChange={e => setRolePanelTitle(e.target.value)}
                    placeholder="e.g. Choose Your Notification Roles"
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Target Channel</label>
                  <select
                    value={rolePanelChannelId}
                    onChange={e => setRolePanelChannelId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                  >
                    {textChannels.map((c: any) => (
                      <option key={c.id} value={c.id}>#{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Selection Mode</label>
                  <select
                    value={rolePanelMode}
                    onChange={e => setRolePanelMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                  >
                    <option value="toggle">Toggle (Click to Add / Remove)</option>
                    <option value="verify">Verify (One-time click to unlock)</option>
                    <option value="unique">Radio Group (Mutually Exclusive)</option>
                    <option value="dropdown">Dropdown Select Menu</option>
                  </select>
                </div>
              </div>

              {/* Select Roles to Include in Panel */}
              <div className="space-y-3">
                <label className="text-[11px] font-semibold text-white/60 block">Click Space Roles to Add to Panel:</label>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-black/30 border border-white/10">
                  {space.roles?.map((role: any) => {
                    const isAdded = selectedPanelRoles.some(r => r.roleId === role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          if (isAdded) {
                            setSelectedPanelRoles(prev => prev.filter(r => r.roleId !== role.id));
                          } else {
                            setSelectedPanelRoles(prev => [
                              ...prev,
                              { roleId: role.id, label: role.name, emoji: '🏷️', style: 'primary' }
                            ]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                          isAdded
                            ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-sm'
                            : 'bg-black/40 border-white/10 text-white/50 hover:text-white'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role.color || '#99aab5' }} />
                        <span>@{role.name}</span>
                        {isAdded && <Check className="w-3.5 h-3.5 text-indigo-400 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Configured Roles Details */}
              {selectedPanelRoles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-white/60 block">Button Labels & Emojis:</span>
                  {selectedPanelRoles.map((r, i) => (
                    <div key={r.roleId} className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10">
                      <input
                        type="text"
                        value={r.emoji}
                        onChange={e => {
                          const updated = [...selectedPanelRoles];
                          updated[i].emoji = e.target.value;
                          setSelectedPanelRoles(updated);
                        }}
                        className="w-12 px-2 py-1 rounded bg-black/50 border border-white/10 text-center text-xs text-white"
                      />
                      <input
                        type="text"
                        value={r.label}
                        onChange={e => {
                          const updated = [...selectedPanelRoles];
                          updated[i].label = e.target.value;
                          setSelectedPanelRoles(updated);
                        }}
                        className="flex-1 px-3 py-1 rounded bg-black/50 border border-white/10 text-xs text-white font-semibold"
                      />
                      <select
                        value={r.style}
                        onChange={e => {
                          const updated = [...selectedPanelRoles];
                          updated[i].style = e.target.value;
                          setSelectedPanelRoles(updated);
                        }}
                        className="px-2 py-1 rounded bg-black/50 border border-white/10 text-xs text-white"
                      >
                        <option value="primary">Blurple</option>
                        <option value="secondary">Grey</option>
                        <option value="success">Green</option>
                        <option value="danger">Red</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setSelectedPanelRoles(prev => prev.filter((_, idx) => idx !== i))}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  disabled={selectedPanelRoles.length === 0}
                  onClick={handleDeployRolePanel}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-bold text-xs text-white flex items-center gap-2 shadow-lg disabled:opacity-40 active:scale-95 transition-all"
                >
                  <Send className="w-4 h-4" /> Deploy Role Panel to #{textChannels.find((c: any) => c.id === rolePanelChannelId)?.name || 'Channel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: AUTOMOD & ANTI-RAID (Bleed Grade)                  */}
        {/* ========================================================= */}
        {activeTab === 'automod' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-[#1e1f22] p-5 rounded-2xl border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" /> Advanced AutoMod & Anti-Raid Suite
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Proactive defense filters to prevent spam raids, discord invite leaks, mass mentions, and offensive language.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Anti-Spam / Flood */}
                <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Anti-Spam / Flood Filter</span>
                    <input
                      type="checkbox"
                      checked={config?.automodConfig?.antiSpam?.enabled ?? true}
                      onChange={e => setConfig((prev: any) => ({
                        ...prev,
                        automodConfig: {
                          ...prev.automodConfig,
                          antiSpam: { ...prev.automodConfig?.antiSpam, enabled: e.target.checked }
                        }
                      }))}
                      className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/50 block mb-1">Max Msgs / 5 sec</label>
                      <input
                        type="number"
                        value={config?.automodConfig?.antiSpam?.maxMessagesPer5s || 5}
                        onChange={e => setConfig((prev: any) => ({
                          ...prev,
                          automodConfig: {
                            ...prev.automodConfig,
                            antiSpam: { ...prev.automodConfig?.antiSpam, maxMessagesPer5s: parseInt(e.target.value) || 5 }
                          }
                        }))}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 block mb-1">Punishment</label>
                      <select
                        value={config?.automodConfig?.antiSpam?.action || 'delete'}
                        onChange={e => setConfig((prev: any) => ({
                          ...prev,
                          automodConfig: {
                            ...prev.automodConfig,
                            antiSpam: { ...prev.automodConfig?.antiSpam, action: e.target.value }
                          }
                        }))}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                      >
                        <option value="delete">Delete Message</option>
                        <option value="warn">Warn Member</option>
                        <option value="timeout">Timeout 10m</option>
                        <option value="kick">Kick Member</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Anti-Mass Mention */}
                <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Anti-Mass Mention Filter</span>
                    <input
                      type="checkbox"
                      checked={config?.automodConfig?.antiMassMention?.enabled ?? true}
                      onChange={e => setConfig((prev: any) => ({
                        ...prev,
                        automodConfig: {
                          ...prev.automodConfig,
                          antiMassMention: { ...prev.automodConfig?.antiMassMention, enabled: e.target.checked }
                        }
                      }))}
                      className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/50 block mb-1">Max Mentions</label>
                      <input
                        type="number"
                        value={config?.automodConfig?.antiMassMention?.maxMentions || 5}
                        onChange={e => setConfig((prev: any) => ({
                          ...prev,
                          automodConfig: {
                            ...prev.automodConfig,
                            antiMassMention: { ...prev.automodConfig?.antiMassMention, maxMentions: parseInt(e.target.value) || 5 }
                          }
                        }))}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 block mb-1">Punishment</label>
                      <select
                        value={config?.automodConfig?.antiMassMention?.action || 'warn'}
                        onChange={e => setConfig((prev: any) => ({
                          ...prev,
                          automodConfig: {
                            ...prev.automodConfig,
                            antiMassMention: { ...prev.automodConfig?.antiMassMention, action: e.target.value }
                          }
                        }))}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                      >
                        <option value="delete">Delete Message</option>
                        <option value="warn">Warn Member</option>
                        <option value="timeout">Timeout 10m</option>
                        <option value="kick">Kick Member</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Anti-Invite Links */}
                <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Anti-Invite & External Links</span>
                    <input
                      type="checkbox"
                      checked={config?.automodConfig?.antiInvite?.enabled ?? true}
                      onChange={e => setConfig((prev: any) => ({
                        ...prev,
                        automodConfig: {
                          ...prev.automodConfig,
                          antiInvite: { ...prev.automodConfig?.antiInvite, enabled: e.target.checked }
                        }
                      }))}
                      className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Action on Unauthorized Invite</label>
                    <select
                      value={config?.automodConfig?.antiInvite?.action || 'delete'}
                      onChange={e => setConfig((prev: any) => ({
                        ...prev,
                        automodConfig: {
                          ...prev.automodConfig,
                          antiInvite: { ...prev.automodConfig?.antiInvite, action: e.target.value }
                        }
                      }))}
                      className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                    >
                      <option value="delete">Delete Message</option>
                      <option value="warn">Delete + Warn</option>
                      <option value="timeout">Delete + Timeout 10m</option>
                    </select>
                  </div>
                </div>

                {/* Audit Logging Channel */}
                <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                  <span className="text-xs font-bold text-white block">AutoMod Audit Log Channel</span>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Send Incident Reports To</label>
                    <select
                      value={config?.automodConfig?.logChannelId || ''}
                      onChange={e => setConfig((prev: any) => ({
                        ...prev,
                        automodConfig: { ...prev.automodConfig, logChannelId: e.target.value }
                      }))}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    >
                      <option value="">No logging channel selected</option>
                      {textChannels.map((c: any) => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Bad Words Blacklist */}
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Bad Word & Slur Blacklist</span>
                  <input
                    type="checkbox"
                    checked={config?.automodConfig?.badWords?.enabled ?? false}
                    onChange={e => setConfig((prev: any) => ({
                      ...prev,
                      automodConfig: {
                        ...prev.automodConfig,
                        badWords: { ...prev.automodConfig?.badWords, enabled: e.target.checked }
                      }
                    }))}
                    className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={badWordInput}
                    onChange={e => setBadWordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddBadWord(); } }}
                    placeholder="Type prohibited word and press Add..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddBadWord}
                    className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(config?.automodConfig?.badWords?.words || []).map((word: string) => (
                    <span key={word} className="px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 text-xs flex items-center gap-1 border border-red-500/30">
                      <span>{word}</span>
                      <button type="button" onClick={() => handleRemoveBadWord(word)} className="hover:text-white">✕</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveConfig({ automodConfig: config?.automodConfig })}
                  className="px-6 py-2.5 rounded-xl bg-[var(--app-accent)] font-bold text-xs text-white flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" /> Save AutoMod Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 7: CUSTOM COMMANDS & TRIGGERS                         */}
        {/* ========================================================= */}
        {activeTab === 'commands' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-[#1e1f22] p-5 rounded-2xl border border-white/10 space-y-5">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-400" /> Custom Commands & Auto-Responders
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Create custom triggers like `!rules`, `!socials`, or `/info` with automated bot replies and rich embeds.
                </p>
              </div>

              {/* Add Custom Command Form */}
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider text-white/70">Create New Command</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Command Trigger</label>
                    <input
                      type="text"
                      value={newCmdTrigger}
                      onChange={e => setNewCmdTrigger(e.target.value)}
                      placeholder="e.g. socials, discord, rules"
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Response Markdown</label>
                    <input
                      type="text"
                      value={newCmdResponse}
                      onChange={e => setNewCmdResponse(e.target.value)}
                      placeholder="Follow our socials here: https://..."
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCmdDelete}
                      onChange={e => setNewCmdDelete(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-indigo-600 focus:ring-0"
                    />
                    Delete trigger message after replying
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCustomCommand}
                    className="px-4 py-2 rounded-xl bg-[var(--app-accent)] font-bold text-xs text-white flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Command
                  </button>
                </div>
              </div>

              {/* Existing Commands List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-white/60 block">Configured Commands:</span>
                {(config?.customCommands || []).length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-white/15 text-center text-xs text-white/40">
                    No custom commands created yet.
                  </div>
                ) : (
                  config.customCommands.map((cmd: any) => (
                    <div key={cmd.id} className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                          !{cmd.trigger}
                        </span>
                        <p className="text-xs text-white/70">{cmd.responseText}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomCommand(cmd.id)}
                        className="p-1.5 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveConfig({ customCommands: config?.customCommands })}
                  className="px-6 py-2.5 rounded-xl bg-[var(--app-accent)] font-bold text-xs text-white flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" /> Save Commands
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 8: BOT PROFILE & MASCOT SETTINGS                      */}
        {/* ========================================================= */}
        {activeTab === 'profile' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-[#1e1f22] p-5 rounded-2xl border border-white/10 space-y-5">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" /> Bot Mascot & Branding Customization
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Personalize your bot's name, avatar icon, bio description, accent color, and command prefix.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-black/30 border border-white/10">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-indigo-600 shrink-0 border-2 border-indigo-500 shadow-xl">
                  <img
                    src={config?.botAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Niko'}
                    alt="Bot Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-3 w-full">
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Bot Mascot Name</label>
                    <input
                      type="text"
                      value={config?.botName || 'Niko'}
                      onChange={e => setConfig((prev: any) => ({ ...prev, botName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 mb-1 block">Bot Avatar URL</label>
                    <input
                      type="text"
                      value={config?.botAvatar || ''}
                      onChange={e => setConfig((prev: any) => ({ ...prev, botAvatar: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Bot Accent Color</label>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg border border-white/20" style={{ backgroundColor: config?.accentColor || '#5865F2' }} />
                    <input
                      type="text"
                      value={config?.accentColor || '#5865F2'}
                      onChange={e => setConfig((prev: any) => ({ ...prev, accentColor: e.target.value }))}
                      className="w-28 px-2 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs text-white uppercase font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 block">Command Prefix</label>
                  <input
                    type="text"
                    value={config?.prefix || '/'}
                    onChange={e => setConfig((prev: any) => ({ ...prev, prefix: e.target.value }))}
                    className="w-24 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-white/60 mb-1 block">Bot Bio / About Text</label>
                <textarea
                  rows={3}
                  value={config?.bio || 'The all-in-one automation, moderation & embed studio assistant.'}
                  onChange={e => setConfig((prev: any) => ({ ...prev, bio: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white resize-none"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveConfig({
                    botName: config?.botName,
                    botAvatar: config?.botAvatar,
                    accentColor: config?.accentColor,
                    prefix: config?.prefix,
                    bio: config?.bio
                  })}
                  className="px-6 py-2.5 rounded-xl bg-[var(--app-accent)] font-bold text-xs text-white flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" /> Save Bot Mascot
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
