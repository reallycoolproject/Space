import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';
import { type IUserConnection, type IUserActivity, type ProviderMeta, type ConnectionCategory } from '../../types/connections';
import { ConnectionIcon, getProviderColor } from './ConnectionIcons';
import { RichPresenceCard } from './RichPresenceCard';
import {
  Check, X, RefreshCw, Trash2, ExternalLink, Plus, ShieldCheck,
  Search, Eye, EyeOff, Radio, Gamepad2, Music, Tv, Flame, Sparkles
} from 'lucide-react';

interface ConnectionsSettingsTabProps {
  token: string | null;
  currentUser: any;
  onUserUpdated?: (user: any) => void;
}

export function ConnectionsSettingsTab({ token, currentUser, onUserUpdated }: ConnectionsSettingsTabProps) {
  const [connections, setConnections] = useState<IUserConnection[]>(currentUser?.connections || []);
  const [activity, setActivity] = useState<IUserActivity | null>(currentUser?.activity || null);
  const [providers, setProviders] = useState<Record<string, ProviderMeta>>({});
  const [selectedCategory, setSelectedCategory] = useState<ConnectionCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Connect Modal State
  const [connectingProvider, setConnectingProvider] = useState<ProviderMeta | null>(null);
  const [handleInput, setHandleInput] = useState('');
  const [showOnProfile, setShowOnProfile] = useState(true);
  const [showPresence, setShowPresence] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simName, setSimName] = useState('Counter-Strike 2');
  const [simDetails, setSimDetails] = useState('Competitive - Dust II');
  const [simState, setSimState] = useState('In Match (13 - 9)');
  const [simType, setSimType] = useState<'playing' | 'listening' | 'streaming' | 'watching'>('playing');

  // Load connections and providers from backend
  const loadConnections = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/connections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        setConnections(data.connections || []);
        setActivity(data.activity || null);
        setProviders(data.providers || {});
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, [token]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Connect new account
  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingProvider || !handleInput.trim() || !token) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/connections/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: connectingProvider.id,
          handle: handleInput.trim(),
          visibleOnProfile: showOnProfile,
          displayRichPresence: showPresence
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Failed to connect account.');
      }

      showNotification('success', data.message || `Connected ${connectingProvider.name}!`);
      setConnectingProvider(null);
      setHandleInput('');
      await loadConnections();

      if (onUserUpdated && currentUser) {
        onUserUpdated({
          ...currentUser,
          connections: [...(currentUser.connections || []).filter((c: any) => c.provider !== connectingProvider.id), data.connection],
          activity: data.activity || currentUser.activity
        });
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Verification failed. Please check the handle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle connection flags
  const handleToggle = async (connectionId: string, field: 'visibleOnProfile' | 'displayRichPresence', currentValue: boolean) => {
    if (!token) return;
    const nextVal = !currentValue;

    // Optimistic UI update
    setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, [field]: nextVal } : c));

    try {
      const res = await fetch(`${API_BASE}/api/connections/${connectionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ [field]: nextVal })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      if (data.activity !== undefined) setActivity(data.activity);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update setting');
      loadConnections();
    }
  };

  // Sync / refresh connection
  const handleSync = async (connectionId: string) => {
    if (!token) return;
    setSyncingId(connectionId);
    try {
      const res = await fetch(`${API_BASE}/api/connections/sync/${connectionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      showNotification('success', data.message || 'Account synced!');
      await loadConnections();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to sync');
    } finally {
      setSyncingId(null);
    }
  };

  // Disconnect connection
  const handleDisconnect = async (connectionId: string, providerName: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to disconnect ${providerName}?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/connections/${connectionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      showNotification('success', `Disconnected ${providerName}.`);
      setConnections(prev => prev.filter(c => c.id !== connectionId));
      if (data.activity !== undefined) setActivity(data.activity);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to disconnect');
    }
  };

  // Custom Simulator Submit
  const handleSimulatorSubmit = async (clear = false) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/connections/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          activity: clear ? null : {
            type: simType,
            provider: 'custom',
            name: simName,
            details: simDetails,
            state: simState,
            timestamps: { start: Date.now() }
          }
        })
      });
      const data = await res.json();
      if (data.ok) {
        setActivity(data.activity);
        showNotification('success', clear ? 'Activity cleared!' : 'Custom rich presence active!');
        if (onUserUpdated && currentUser) {
          onUserUpdated({ ...currentUser, activity: data.activity });
        }
      }
    } catch (err: any) {
      showNotification('error', 'Failed to update custom presence');
    }
  };

  // Filter provider list
  const providerList = Object.values(providers);
  const filteredProviders = providerList.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const connectedProviderIds = new Set(connections.map(c => c.provider));

  return (
    <div className="space-y-6 text-sm text-[var(--text-primary)]">
      {/* Toast Feedback */}
      {feedback && (
        <div 
          className={`p-3.5 rounded-xl text-xs font-bold shadow-lg flex items-center justify-between border ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
              : 'bg-red-500/15 border-red-500/30 text-red-400'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-purple-600/20 border border-white/10 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              Connected Accounts & Rich Presence
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xl leading-relaxed">
              Link your gaming, music, social, and developer platforms to verify your identity, display verified badges, and broadcast live rich presence (Playing, Listening, Streaming, Watching) on your Space profile and member list.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSimulator(!showSimulator)}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            {showSimulator ? 'Hide Simulator' : 'Rich Presence Simulator'}
          </button>
        </div>
      </div>

      {/* Rich Presence Simulator Box */}
      {showSimulator && (
        <div className="p-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Gamepad2 className="w-4 h-4" /> Live Activity / Rich Presence Simulator
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">Broadcasts live across your servers</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block mb-1">Type</label>
              <select
                value={simType}
                onChange={e => setSimType(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] text-xs text-[var(--text-primary)]"
              >
                <option value="playing">Playing (Game)</option>
                <option value="listening">Listening to Music</option>
                <option value="streaming">Streaming Live</option>
                <option value="watching">Watching Show / Anime</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block mb-1">Title / Game</label>
              <input
                type="text"
                value={simName}
                onChange={e => setSimName(e.target.value)}
                placeholder="Game or Media name"
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] text-xs text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block mb-1">Details</label>
              <input
                type="text"
                value={simDetails}
                onChange={e => setSimDetails(e.target.value)}
                placeholder="e.g. Competitive / Track name"
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] text-xs text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block mb-1">State</label>
              <input
                type="text"
                value={simState}
                onChange={e => setSimState(e.target.value)}
                placeholder="e.g. Dust II (13 - 9)"
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            {activity && (
              <button
                type="button"
                onClick={() => handleSimulatorSubmit(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Clear Current Status
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSimulatorSubmit(false)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-xs"
            >
              Broadcast Activity
            </button>
          </div>
        </div>
      )}

      {/* Active Live Activity Preview if Any */}
      {activity && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Currently Broadcasting Live Status
            </h4>
            <button
              type="button"
              onClick={() => handleSimulatorSubmit(true)}
              className="text-[11px] text-red-400 hover:underline font-semibold"
            >
              Clear Status
            </button>
          </div>
          <RichPresenceCard activity={activity} />
        </div>
      )}

      {/* Connected Accounts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Your Connected Accounts ({connections.length})
          </h4>
        </div>

        {connections.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-[var(--app-border)] text-center text-[var(--text-secondary)] space-y-1">
            <p className="font-semibold text-xs">No accounts connected yet</p>
            <p className="text-[11px]">Select a platform below to verify and link your account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {connections.map(conn => {
              const brandColor = getProviderColor(conn.provider);
              const prov = providers[conn.provider];
              const isSyncing = syncingId === conn.id;

              return (
                <div
                  key={conn.id}
                  className="p-3.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-xs flex flex-col justify-between gap-3 relative group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar or Brand Icon */}
                      <div className="relative shrink-0">
                        {conn.avatarUrl ? (
                          <img
                            src={conn.avatarUrl}
                            alt={conn.username}
                            className="w-10 h-10 rounded-xl object-cover border border-white/20 shadow-xs"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs"
                            style={{ backgroundColor: brandColor }}
                          >
                            <ConnectionIcon provider={conn.provider} size={20} />
                          </div>
                        )}
                        <span
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center p-0.5 text-white"
                          style={{ backgroundColor: brandColor }}
                          title={prov?.name || conn.provider}
                        >
                          <ConnectionIcon provider={conn.provider} size={10} />
                        </span>
                      </div>

                      {/* Names & Metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[var(--text-primary)] truncate">
                            {conn.displayName || conn.username}
                          </span>
                          <span className="text-blue-400 shrink-0" title="Verified Account">
                            ✓
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] truncate">
                          {prov?.name || conn.provider} {conn.username !== conn.displayName && `(@${conn.username})`}
                        </p>

                        {/* Custom Platform Stats Pills */}
                        {conn.metadata && Object.keys(conn.metadata).length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {conn.metadata.publicRepos !== undefined && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[var(--app-panel)] text-[10px] font-semibold text-[var(--text-secondary)]">
                                {conn.metadata.publicRepos} repos
                              </span>
                            )}
                            {conn.metadata.rapidRating && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[var(--app-panel)] text-[10px] font-semibold text-emerald-400">
                                {conn.metadata.rapidRating} Rapid ELO
                              </span>
                            )}
                            {conn.metadata.blitzRating && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[var(--app-panel)] text-[10px] font-semibold text-amber-400">
                                {conn.metadata.blitzRating} Blitz
                              </span>
                            )}
                            {conn.metadata.followers !== undefined && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[var(--app-panel)] text-[10px] font-semibold text-[var(--text-secondary)]">
                                {conn.metadata.followers} followers
                              </span>
                            )}
                            {conn.metadata.steamLevel && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[var(--app-panel)] text-[10px] font-semibold text-blue-400">
                                Level {conn.metadata.steamLevel}
                              </span>
                            )}
                            {conn.metadata.episodesWatched && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[var(--app-panel)] text-[10px] font-semibold text-purple-400">
                                {conn.metadata.episodesWatched} episodes
                              </span>
                            )}
                            {conn.metadata.totalKarma && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[var(--app-panel)] text-[10px] font-semibold text-orange-400">
                                {conn.metadata.totalKarma} karma
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Disconnect and View Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {conn.profileUrl && (
                        <a
                          href={conn.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--app-surface-hover)] transition-colors"
                          title="View Profile on Web"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSync(conn.id)}
                        disabled={isSyncing}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--app-surface-hover)] transition-colors disabled:opacity-50"
                        title="Sync live status and stats"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisconnect(conn.id, prov?.name || conn.provider)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Disconnect"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Toggle Controls */}
                  <div className="pt-2 border-t border-[var(--app-border)] flex items-center justify-between text-xs gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={conn.visibleOnProfile}
                        onChange={() => handleToggle(conn.id, 'visibleOnProfile', conn.visibleOnProfile)}
                        className="rounded border-[var(--app-border)] text-blue-500 focus:ring-blue-400"
                      />
                      <span className="text-[11px] text-[var(--text-secondary)] font-medium">Display on profile</span>
                    </label>

                    {prov?.supportsRichPresence && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={conn.displayRichPresence}
                          onChange={() => handleToggle(conn.id, 'displayRichPresence', conn.displayRichPresence)}
                          className="rounded border-[var(--app-border)] text-purple-500 focus:ring-purple-400"
                        />
                        <span className="text-[11px] text-[var(--text-secondary)] font-medium">Show as status</span>
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect More Accounts Directory */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Available Platforms ({filteredProviders.length})
          </h4>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search platforms..."
              className="pl-8 pr-3 py-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-xs text-[var(--text-primary)] w-full sm:w-48 outline-none focus:border-[var(--app-accent)]"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Platforms' },
            { id: 'gaming', label: '🎮 Gaming & Live' },
            { id: 'music', label: '🎵 Music & Audio' },
            { id: 'social', label: '🌐 Social & Community' },
            { id: 'developer', label: '💻 Developer & Creator' },
            { id: 'anime', label: '🕹️ Publishers & Anime' }
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[var(--app-accent)] text-white shadow-xs'
                  : 'bg-[var(--app-surface)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--app-surface-hover)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Providers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredProviders.map(provider => {
            const isConnected = connectedProviderIds.has(provider.id);
            const brandColor = getProviderColor(provider.id);

            return (
              <div
                key={provider.id}
                className="p-3.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] hover:border-white/20 transition-all flex flex-col justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: brandColor }}
                  >
                    <ConnectionIcon provider={provider.id} size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h5 className="font-bold text-xs text-[var(--text-primary)] truncate">
                        {provider.name}
                      </h5>
                      {provider.supportsRichPresence && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Supports Live Rich Presence" />
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-0.5 leading-tight">
                      {provider.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[var(--app-border)]/50">
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">
                    {provider.badgeLabel}
                  </span>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <Check className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConnectingProvider(provider);
                        setHandleInput('');
                        setShowOnProfile(true);
                        setShowPresence(provider.supportsRichPresence);
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-[var(--app-accent)] hover:opacity-90 transition-all shadow-xs cursor-pointer"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connect Account Modal */}
      {connectingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--app-panel)] border border-white/20 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: getProviderColor(connectingProvider.id) }}
                >
                  <ConnectionIcon provider={connectingProvider.id} size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Connect {connectingProvider.name}</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">{connectingProvider.badgeLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConnectingProvider(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {connectingProvider.description}. Enter your username or public handle to verify and link your account.
            </p>

            <form onSubmit={handleConnectSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase block mb-1">
                  {connectingProvider.name} Username / Handle / ID
                </label>
                <input
                  type="text"
                  value={handleInput}
                  onChange={e => setHandleInput(e.target.value)}
                  placeholder={
                    connectingProvider.id === 'steam' ? 'SteamID64 or Custom URL name' :
                    connectingProvider.id === 'chess' ? 'Chess.com username' :
                    connectingProvider.id === 'lichess' ? 'Lichess username' :
                    connectingProvider.id === 'github' ? 'GitHub username' :
                    connectingProvider.id === 'roblox' ? 'Roblox username' :
                    connectingProvider.id === 'anilist' ? 'AniList username' :
                    connectingProvider.id === 'bluesky' ? 'handle.bsky.social' :
                    connectingProvider.id === 'reddit' ? 'Reddit username (without u/)' :
                    connectingProvider.id === 'riot' ? 'GameName#TAG' :
                    `${connectingProvider.name} username`
                  }
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              <div className="space-y-2 p-3 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)]">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnProfile}
                    onChange={e => setShowOnProfile(e.target.checked)}
                    className="rounded border-[var(--app-border)] text-blue-500"
                  />
                  <div>
                    <span className="text-xs font-semibold block text-[var(--text-primary)]">Display on profile</span>
                    <span className="text-[10px] text-[var(--text-secondary)] block">Show verified badge and link in your public Space profile</span>
                  </div>
                </label>

                {connectingProvider.supportsRichPresence && (
                  <label className="flex items-center gap-2.5 cursor-pointer pt-2 border-t border-[var(--app-border)]/60">
                    <input
                      type="checkbox"
                      checked={showPresence}
                      onChange={e => setShowPresence(e.target.checked)}
                      className="rounded border-[var(--app-border)] text-purple-500"
                    />
                    <div>
                      <span className="text-xs font-semibold block text-[var(--text-primary)]">Display current activity as status</span>
                      <span className="text-[10px] text-[var(--text-secondary)] block">Show live status (Playing, Listening, Streaming, Watching)</span>
                    </div>
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConnectingProvider(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--app-surface)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !handleInput.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--app-accent)] hover:opacity-90 transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    'Verify & Connect'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
