import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../config';
import { UserPlus, UserMinus, UserX, Flag, X, Calendar, Link as LinkIcon, MoreVertical, Copy, Check, Users, Hash, Plus, Link2, ShieldCheck, ExternalLink } from 'lucide-react';
import { FloatingNote } from './FloatingNote';
import { type NoteData } from './NoteModal';
import { useAuth } from '../contexts/AuthContext';
import { UserBadgesList } from './common/ProfileBadge';
import { SpaceModeratorViewModal, type SpaceModerationDetails } from './spaces/SpaceModeratorViewModal';
import { RichPresenceCard } from './connections/RichPresenceCard';
import { ConnectionIcon, getProviderColor } from './connections/ConnectionIcons';
import { createPortal } from 'react-dom';

interface UserProfileModalProps {
  selectedProfile: any;
  onClose: () => void;
  onAddFriend: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onBlock: (userId: string) => void;
  onReport: (userId: string) => void;
  onOpenSavedMessages?: () => void;
  isFriend?: boolean;
  onNicknameSaved?: () => void;
  onMessageUser?: (userId: string) => void;
  onSendOneTimeMessage?: (userId: string, username: string) => void;
  canSendOneTimeMessage?: boolean;
  allowOneTimeMessages?: boolean;
  cooldownInfo?: { isOnCooldown: boolean; remainingTime?: number };
}

export function UserProfileModal({
  selectedProfile,
  onClose,
  onAddFriend,
  onRemoveFriend,
  onBlock,
  onReport,
  onOpenSavedMessages,
  isFriend = false,
  onNicknameSaved,
  onMessageUser,
  onSendOneTimeMessage,
  canSendOneTimeMessage = true,
  allowOneTimeMessages = true,
  cooldownInfo = { isOnCooldown: false }
}: UserProfileModalProps) {
  const { user, setUser } = useAuth();

  const [profileData, setProfileData] = useState<any>(selectedProfile);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userNote, setUserNote] = useState<NoteData | null>(selectedProfile?.note || null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'connections' | 'friends' | 'spaces'>('connections');
  const [userConnections, setUserConnections] = useState<any[]>(selectedProfile?.connections || []);
  const [userActivity, setUserActivity] = useState<any>(selectedProfile?.activity || null);
  const [mutualFriends, setMutualFriends] = useState<any[]>([]);
  const [mutualSpaces, setMutualSpaces] = useState<any[]>([]);
  const [selectedSpaceRoleIds, setSelectedSpaceRoleIds] = useState<string[]>(selectedProfile?.spaceRoleIds || []);
  const [spaceModerationDetails, setSpaceModerationDetails] = useState<any | null>(null);
  const [showSpaceModeratorView, setShowSpaceModeratorView] = useState(false);
  const [spaceModerationLoading, setSpaceModerationLoading] = useState(false);
  const [spaceModerationError, setSpaceModerationError] = useState<string | null>(null);
  const [isUpdatingSpaceMember, setIsUpdatingSpaceMember] = useState(false);

  const loadSpaceModerationDetails = useCallback(async (isActive: () => boolean = () => true) => {
    setSpaceModerationLoading(true);
    setSpaceModerationError(null);
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${selectedProfile.spaceId}/members/${selectedProfile.userId}/moderation`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load Space member details.');
      if (isActive()) setSpaceModerationDetails(data.member);
    } catch (error) {
      console.error('Failed to load Space member moderation details:', error);
      if (isActive()) setSpaceModerationError(error instanceof Error ? error.message : 'Could not load member details.');
    } finally {
      if (isActive()) setSpaceModerationLoading(false);
    }
  }, [selectedProfile?.spaceId, selectedProfile?.userId]);

  useEffect(() => {
    setProfileData(selectedProfile);
    setUserNote(selectedProfile?.note || null);
    setSelectedSpaceRoleIds(selectedProfile?.spaceRoleIds || []);
    setUserConnections(selectedProfile?.connections || []);
    setUserActivity(selectedProfile?.activity || null);
    setSpaceModerationDetails(null);
    setSpaceModerationError(null);
    setShowSpaceModeratorView(false);
    if (selectedProfile?.userId) {
      fetch(`${API_BASE}/api/auth/user/${selectedProfile.userId}/profile`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.user) {
            setProfileData((prev: any) => ({ ...prev, ...data.user }));
            if (data.user.note) setUserNote(data.user.note);
            if (data.user.connections) setUserConnections(data.user.connections);
            if (data.user.activity) setUserActivity(data.user.activity);
          }
        })
        .catch(err => console.error('Failed to load fresh user profile:', err));
    }
  }, [selectedProfile]);

  useEffect(() => {
    const permissions = selectedProfile?.spaceModerationPermissions;
    if (!selectedProfile?.spaceId || !selectedProfile?.userId ||
      !(permissions?.manageRoles || permissions?.moderateMembers || permissions?.kickMembers || permissions?.banMembers)) return;
    let active = true;
    void loadSpaceModerationDetails(() => active);
    return () => { active = false; };
  }, [selectedProfile?.spaceId, selectedProfile?.userId, selectedProfile?.spaceModerationPermissions, loadSpaceModerationDetails]);

  const updateSpaceMember = async (action: 'roles' | 'timeout' | 'kick' | 'ban', body?: Record<string, unknown>) => {
    const spaceId = selectedProfile?.spaceId;
    if (!spaceId) return;
    setIsUpdatingSpaceMember(true);
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${selectedProfile.userId}${action === 'roles' ? '/roles' : action === 'timeout' ? '/timeout' : `/${action}`}`, {
        method: action === 'roles' ? 'PUT' : action === 'timeout' ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || `Could not ${action} this member.`);
      if (action === 'roles') {
        setSelectedSpaceRoleIds(data.roleIds);
        setProfileData((previous: any) => ({ ...previous, spaceRoleIds: data.roleIds }));
      }
      if (action === 'timeout') setSpaceModerationDetails((previous: any) => previous ? { ...previous, mutedUntil: data.mutedUntil } : previous);
      if (action === 'kick' || action === 'ban') onClose();
    } catch (error) {
      console.error(`Failed to ${action} Space member:`, error);
      window.alert(error instanceof Error ? error.message : `Could not ${action} this member.`);
    } finally {
      setIsUpdatingSpaceMember(false);
    }
  };

  const handleCopyProfile = () => {
    const profileUrl = `https://space.app/u/${selectedProfile.username}`;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditNote = (note: NoteData) => {
    setUserNote(note);
    saveNoteToBackend(note);
  };

  const handleDeleteNote = () => {
    setUserNote(null);
    deleteNoteFromBackend();
  };

  const saveNoteToBackend = async (note: NoteData) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/user/note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          text: note.text,
          song: note.song,
          gif: note.gif,
          duration: note.duration
        })
      });
      const data = await response.json();
      if (data.ok) {
        console.log('Note saved successfully');
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const deleteNoteFromBackend = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/user/note`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.ok) {
        console.log('Note deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const currentNoteText = profileData?.customActivity || userNote?.text || '';

  const handleSaveInlineNote = async () => {
    const trimmed = noteInput.trim();
    setIsSavingNote(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ customActivity: trimmed })
      });
      const data = await res.json();
      if (data.ok && data.user) {
        setProfileData((prev: any) => ({ ...prev, customActivity: trimmed }));
        if (setUser && user) setUser({ ...user, customActivity: trimmed });
      }
      setIsEditingNote(false);
    } catch (e) {
      console.error('Failed to save note:', e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleClearInlineNote = async () => {
    setIsSavingNote(true);
    try {
      await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ customActivity: '' })
      });
      setProfileData((prev: any) => ({ ...prev, customActivity: '' }));
      if (setUser && user) setUser({ ...user, customActivity: '' });
      setIsEditingNote(false);
    } catch (e) {
      console.error('Failed to clear note:', e);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Fetch mutual friends and spaces
  useEffect(() => {
    const fetchMutualData = async () => {
      try {
        const [friendsRes, spacesRes] = await Promise.all([
          fetch(`${API_BASE}/api/auth/user/${selectedProfile.userId}/mutual-friends`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch(`${API_BASE}/api/auth/user/${selectedProfile.userId}/mutual-spaces`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
        ]);
        
        const friendsData = await friendsRes.json();
        const spacesData = await spacesRes.json();
        
        if (friendsData.ok) setMutualFriends(friendsData.friends || []);
        if (spacesData.ok) setMutualSpaces(spacesData.spaces || []);
      } catch (error) {
        console.error('Failed to fetch mutual data:', error);
      }
    };

    if (selectedProfile?.userId && user?.userId !== selectedProfile.userId) {
      fetchMutualData();
    }
  }, [selectedProfile, user?.userId]);

  // Fetch user's note on mount
  useEffect(() => {
    const fetchUserNote = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/user/${selectedProfile.userId}/note`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        if (data.ok && data.note) {
          setUserNote(data.note);
        }
      } catch (error) {
        console.error('Failed to fetch user note:', error);
      }
    };

    if (selectedProfile?.userId) {
      fetchUserNote();
    }
  }, [selectedProfile]);

  if (!selectedProfile) return null;

  const isOwnProfile = user?.userId === selectedProfile.userId;
  const userStatus = selectedProfile.status || 'active';
  const userBio = selectedProfile.bio || 'No bio yet';
  const userWebsite = selectedProfile.website || '';
  const joinedDate = selectedProfile.createdAt ? new Date(selectedProfile.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown';
  const userPronouns = selectedProfile.pronouns || '';
  const spaceRolesForCard = Array.isArray(profileData.spaceAvailableRoles) && Array.isArray(profileData.spaceRoleIds)
    ? profileData.spaceAvailableRoles.filter((role: { id: string }) => profileData.spaceRoleIds.includes(role.id))
    : profileData.spaceRoles || [];

  // Identity Card Dual-Color Gradient (Chosen by profile owner)
  const cardColor1 = profileData.themeGradient?.color1 || selectedProfile.themeGradient?.color1 || '#0099ff';
  const cardColor2 = profileData.themeGradient?.color2 || selectedProfile.themeGradient?.color2 || '#7928ca';
  const cardAngle = profileData.themeGradient?.angle ?? selectedProfile.themeGradient?.angle ?? 135;

  // Banner: custom image/gif if uploaded, or a glossy crystal glass overlay
  const bannerStyle = (profileData.banner || selectedProfile.banner) 
    ? { backgroundImage: `url(${profileData.banner || selectedProfile.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.35) 100%)' };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-4xl h-[min(92dvh,640px)] max-h-[92dvh] rounded-2xl shadow-2xl relative border border-white/30 overflow-hidden flex flex-col"
        style={{
          background: `linear-gradient(${cardAngle}deg, ${cardColor1} 0%, ${cardColor2} 100%)`,
          boxShadow: `0 25px 70px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 0 45px ${cardColor1}60`,
        }}
      >
        {/* Frutiger Aero Window Title Bar */}
        <div 
          className="h-10 px-4 flex items-center justify-between border-b border-white/20 select-none shrink-0 z-30"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.12) 50%, rgba(0, 0, 0, 0.15) 51%, rgba(255, 255, 255, 0.18) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)'
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400 shadow-sm border border-red-500/40" />
              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm border border-amber-500/40" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm border border-emerald-500/40" />
            </div>
            <span 
              className="text-xs font-black tracking-wider uppercase text-white ml-2 drop-shadow-sm"
            >
              SPACE // IDENTITY CARD — @{profileData.username}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close profile"
            className="w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors shadow-xs border border-white/20"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Window Content Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Column: Glass panel on top of the user's custom card gradient */}
          <div 
            className="w-full md:w-[340px] bg-slate-950/45 dark:bg-black/55 backdrop-blur-xl md:border-r border-b md:border-b-0 border-white/15 flex flex-col overflow-y-auto shrink-0 relative max-h-[44%] md:max-h-none text-white"
          >
            {/* Banner with glass reflection */}
            <div className="h-32 w-full relative overflow-hidden shrink-0" style={bannerStyle}>
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 60%, rgba(0,0,0,0.3) 100%)',
                  boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.3)'
                }}
              />
            </div>

            {/* Avatar & Y2K Frutiger Note Bubble Section */}
            <div className="px-6 py-4">
              <div className="flex flex-col items-start gap-1">
                {/* Y2K Frutiger Aero Glossy Note Bubble */}
                {!isEditingNote && (currentNoteText || isOwnProfile) && (
                  <div className="relative mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isOwnProfile) {
                          setIsEditingNote(true);
                          setNoteInput(currentNoteText || '');
                        }
                      }}
                      title={isOwnProfile ? "Click to change your status note" : undefined}
                      className={`group relative max-w-[270px] text-left px-3.5 py-1.5 rounded-2xl transition-all select-none ${
                        isOwnProfile ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg' : 'cursor-default'
                      }`}
                      style={{
                        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(225, 245, 255, 0.92) 55%, rgba(190, 230, 255, 0.95) 100%)',
                        border: '1.5px solid rgba(255, 255, 255, 0.9)',
                        boxShadow: '0 4px 15px rgba(0, 140, 255, 0.3), inset 0 1px 1px #ffffff',
                        color: '#0f172a'
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs shrink-0">💭</span>
                        <span className="text-xs font-bold truncate">
                          {currentNoteText || (isOwnProfile ? "Share what's on your mind…" : '')}
                        </span>
                        {isOwnProfile && (
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-blue-600 font-bold ml-1">
                            ✎
                          </span>
                        )}
                      </div>
                      {/* Tail pointing down toward avatar */}
                      <div 
                        className="absolute -bottom-1.5 left-6 w-3 h-3 rotate-45"
                        style={{
                          background: 'rgba(190, 230, 255, 0.95)',
                          borderRight: '1.5px solid rgba(255, 255, 255, 0.9)',
                          borderBottom: '1.5px solid rgba(255, 255, 255, 0.9)'
                        }}
                      />
                    </button>
                  </div>
                )}

                {/* Inline Note Editor for Profile Owner */}
                {isEditingNote && isOwnProfile && (
                  <div 
                    className="p-3 rounded-2xl shadow-2xl border border-white/70 mb-2 w-full max-w-[270px] animate-in fade-in z-30"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(228, 246, 255, 0.95) 100%)',
                      boxShadow: '0 8px 25px rgba(0, 110, 255, 0.35)',
                      color: '#0f172a'
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span>💭</span> Status Note
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingNote(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold p-0.5"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      placeholder="Type whatever you want…"
                      maxLength={100}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveInlineNote();
                        if (e.key === 'Escape') setIsEditingNote(false);
                      }}
                      className="w-full px-3 py-1.5 rounded-xl border border-blue-200 bg-white text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-400 font-medium mb-2"
                    />
                    <div className="flex items-center justify-between gap-1.5">
                      {currentNoteText ? (
                        <button
                          type="button"
                          onClick={handleClearInlineNote}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                        >
                          Clear
                        </button>
                      ) : <span className="text-[10px] text-slate-400">{noteInput.length}/100</span>}
                      <button
                        type="button"
                        disabled={isSavingNote}
                        onClick={handleSaveInlineNote}
                        className="px-3.5 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        {isSavingNote ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-full bg-slate-900 border-4 border-white/80 overflow-hidden shadow-2xl">
                    {selectedProfile.avatar ? (
                      <img src={selectedProfile.avatar} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                        {selectedProfile.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-slate-900 z-20 ${
                    userStatus === 'active' ? 'bg-green-500' : 
                    userStatus === 'inactive' ? 'bg-yellow-500' : 
                    userStatus === 'dnd' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                </div>
              </div>

              {/* Identity Info */}
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-white truncate drop-shadow-sm">
                      {profileData.displayName || profileData.username}
                    </h2>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <UserBadgesList 
                      badges={profileData.badges} 
                      memberNumber={profileData.memberNumber} 
                      size="lg" 
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <p className="text-sm text-white/70">@{profileData.username}</p>
                  {userPronouns && (
                    <span className="px-2 py-0.5 bg-white/15 rounded-full text-xs text-white border border-white/20 font-medium">
                      {userPronouns}
                    </span>
                  )}
                </div>

                {/* Live Rich Presence Activity */}
                {userActivity && (
                  <div className="mb-4">
                    <RichPresenceCard activity={userActivity} />
                  </div>
                )}

                {/* Verified Connections Quick Bar */}
                {userConnections.length > 0 && (
                  <div className="mb-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                      <Link2 className="h-3 w-3" /> Connected Accounts ({userConnections.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {userConnections.map((conn: any) => (
                        <a
                          key={conn.id || conn.provider}
                          href={conn.profileUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[var(--app-surface)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--app-surface-hover)] transition-all shadow-xs"
                        >
                          <div className="w-3.5 h-3.5 flex items-center justify-center" style={{ color: getProviderColor(conn.provider) }}>
                            <ConnectionIcon provider={conn.provider} size={13} />
                          </div>
                          <span className="truncate max-w-[110px]">{conn.displayName || conn.username}</span>
                          <span className="text-blue-400 text-[10px]">✓</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              {spaceRolesForCard.length > 0 && (
                <section className="mb-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                      <Hash className="h-3 w-3" /> Roles in {profileData.spaceName || 'this Space'}
                    </p>
                    {profileData.spaceModerationPermissions?.manageRoles && (
                      <button
                        type="button"
                        onClick={() => setShowSpaceModeratorView(true)}
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--app-accent)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--app-accent)] hover:bg-[var(--app-accent)] hover:text-white transition-all shadow-xs cursor-pointer"
                        title="Manage Roles"
                      >
                        <Plus size={11} /> Manage
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {spaceRolesForCard.map((role: { id: string; name: string; color: string }) => (
                      <span key={role.id} className="rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ color: role.color, borderColor: `${role.color}66`, backgroundColor: `${role.color}18` }}>
                        {role.name}
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {profileData.spaceId && (
                <section className="mb-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Space membership</p>
                  <p className="mt-1 text-xs">Joined {profileData.spaceJoinedAt ? new Date(profileData.spaceJoinedAt).toLocaleDateString() : 'date unavailable'}</p>
                </section>
              )}
              {profileData.spaceId && profileData.spaceModerationPermissions && (
                <section className="mb-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Space moderation</p>
                  <button type="button" onClick={() => setShowSpaceModeratorView(true)} className="mt-2 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface)]">Open moderator view</button>
                </section>
              )}
              {profileData.spaceId && profileData.spaceModerationPermissions && !profileData.spaceModerationPermissions.isOwner && (
                <section className="mb-4 space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide">Space moderation</h3>
                  {profileData.spaceModerationPermissions.manageRoles && Array.isArray(profileData.spaceAvailableRoles) && profileData.spaceAvailableRoles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Assign roles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profileData.spaceAvailableRoles.map((role: { id: string; name: string; color: string }) => {
                          const checked = selectedSpaceRoleIds.includes(role.id);
                          return <button key={role.id} type="button" role="switch" aria-checked={checked} disabled={isUpdatingSpaceMember} onClick={() => setSelectedSpaceRoleIds(current => checked ? current.filter(id => id !== role.id) : [...current, role.id])} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${checked ? 'bg-[var(--app-surface)]' : 'opacity-65'}`} style={{ color: role.color, borderColor: `${role.color}66` }}>{role.name}</button>;
                        })}
                      </div>
                      <button type="button" disabled={isUpdatingSpaceMember} onClick={() => void updateSpaceMember('roles', { roleIds: selectedSpaceRoleIds })} className="rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save roles</button>
                    </div>
                  )}
                  {profileData.spaceModerationPermissions.moderateMembers && <div>
                    <p className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">Timeout</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([['10m', 10], ['1h', 60], ['1d', 1440], ['1w', 10080]] as const).map(([label, durationMinutes]) => <button key={label} type="button" disabled={isUpdatingSpaceMember} onClick={() => void updateSpaceMember('timeout', { durationMinutes })} className="rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-[10px] hover:bg-[var(--app-surface)] disabled:opacity-50">{label}</button>)}
                      {spaceModerationDetails?.mutedUntil && <button type="button" disabled={isUpdatingSpaceMember} onClick={() => void updateSpaceMember('timeout', { durationMinutes: 0 })} className="rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-[10px] text-[var(--app-accent)]">Remove timeout</button>}
                    </div>
                  </div>}
                  <div className="flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-3">
                    {profileData.spaceModerationPermissions.kickMembers && <button type="button" disabled={isUpdatingSpaceMember} onClick={() => { if (window.confirm(`Remove ${profileData.displayName || profileData.username} from ${profileData.spaceName}?`)) void updateSpaceMember('kick'); }} className="rounded-lg border border-orange-400/30 px-3 py-2 text-xs font-semibold text-orange-300">Kick</button>}
                    {profileData.spaceModerationPermissions.banMembers && <button type="button" disabled={isUpdatingSpaceMember} onClick={() => { if (window.confirm(`Ban ${profileData.displayName || profileData.username} from ${profileData.spaceName}?`)) void updateSpaceMember('ban', { reason: 'Banned by a Space moderator.' }); }} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300">Ban</button>}
                  </div>
                </section>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {isOwnProfile ? (
                  <button
                    onClick={() => onOpenSavedMessages && onOpenSavedMessages()}
                    className="flex-1 py-2 frutiger-btn frutiger-btn-primary text-white rounded text-sm font-bold transition-all"
                  >
                    Saved Messages
                  </button>
                ) : (
                  <>
                    {isFriend ? (
                      <button
                        onClick={() => onMessageUser && onMessageUser(selectedProfile.userId)}
                        className="flex-1 py-2 frutiger-btn frutiger-btn-primary text-white rounded text-sm font-bold transition-all"
                      >
                        Message
                      </button>
                    ) : (
                      <>
                        {allowOneTimeMessages && canSendOneTimeMessage ? (
                          <button
                            onClick={() => onSendOneTimeMessage && onSendOneTimeMessage(selectedProfile.userId, selectedProfile.username)}
                            className="flex-1 py-2 frutiger-btn frutiger-btn-primary text-white rounded text-sm font-bold transition-all"
                          >
                            Send One-Time Message
                          </button>
                        ) : allowOneTimeMessages ? (
                          <button
                            disabled
                            className="flex-1 py-2 bg-[var(--app-surface)] text-[var(--text-secondary)] rounded text-sm font-medium cursor-not-allowed"
                            title={cooldownInfo.isOnCooldown && cooldownInfo.remainingTime 
                              ? `Cooldown active: ${Math.ceil(cooldownInfo.remainingTime / (1000 * 60 * 60 * 24))} days remaining` 
                              : 'You can send one message every 3 days'}
                          >
                            {cooldownInfo.isOnCooldown && cooldownInfo.remainingTime 
                              ? `Cooldown: ${Math.ceil(cooldownInfo.remainingTime / (1000 * 60 * 60 * 24))}d` 
                              : 'Cooldown Active'}
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 py-2 bg-[var(--app-surface)] text-[var(--text-secondary)] rounded text-sm font-medium cursor-not-allowed"
                            title="This user has disabled one-time messages"
                          >
                            One-Time Messages Disabled
                          </button>
                        )}
                      </>
                    )}
                    {isFriend ? (
                      <button
                        onClick={() => onRemoveFriend(selectedProfile.userId)}
                        className="px-3 py-2 frutiger-btn frutiger-btn-danger text-white rounded text-sm font-bold transition-all"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onAddFriend(selectedProfile.userId)}
                        className="px-3 py-2 frutiger-btn frutiger-btn-primary text-white rounded text-sm font-bold transition-all"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="px-3 py-2 frutiger-btn frutiger-btn-secondary text-[var(--text-secondary)] rounded transition-all"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      <AnimatePresence>
                        {showMenu && !isOwnProfile && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -6 }}
                            className="absolute top-full right-0 mt-1.5 bg-[var(--app-panel)]/95 backdrop-blur-xl border border-[var(--app-border)] rounded-xl shadow-2xl p-1.5 z-30 min-w-[200px] space-y-1.5"
                          >
                            <button
                              onClick={() => { handleCopyProfile(); setTimeout(() => setShowMenu(false), 800); }}
                              className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold rounded-lg text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] transition-all frutiger-btn frutiger-btn-secondary justify-start"
                            >
                              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-[var(--app-accent)]" />}
                              {copied ? 'Copied Link!' : 'Copy Profile Link'}
                            </button>
                            <button
                              onClick={() => { onBlock(selectedProfile.userId); setShowMenu(false); }}
                              className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold rounded-lg text-white transition-all frutiger-btn frutiger-btn-danger justify-start"
                            >
                              <UserX className="w-4 h-4" />
                              Block User
                            </button>
                            <button
                              onClick={() => { onReport(selectedProfile.userId); setShowMenu(false); }}
                              className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold rounded-lg text-white transition-all frutiger-btn justify-start"
                              style={{ background: 'linear-gradient(180deg, #ff9800 0%, #e65100 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 6px rgba(230,81,0,0.35)' }}
                            >
                              <Flag className="w-4 h-4" />
                              Report User
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* About Me / Bio Section */}
            <div className="mt-6 pt-6 border-t border-[var(--app-border)]">
              <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">About Me</h3>
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{userBio}</p>
              
              {userWebsite && (
                <a href={userWebsite} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-3 text-sm text-[var(--app-accent)] hover:underline">
                  <LinkIcon className="w-4 h-4" />
                  {userWebsite}
                </a>
              )}
            </div>

            {/* Account Meta */}
            <div className="mt-6 pt-6 border-t border-[var(--app-border)]">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Calendar className="w-4 h-4" />
                <span>Member since {joinedDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Mutual Friends/Spaces or Own Profile Showcase */}
        {isOwnProfile ? (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-5 bg-[var(--app-panel)]/50">
            <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-[var(--text-primary)]">Your Community Identity</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Member #{profileData.memberNumber || user?.memberNumber || '1'} of the Space Network</p>
                </div>
                {((profileData.badges && profileData.badges.length > 0) || (profileData.memberNumber && profileData.memberNumber <= 100)) && (
                  <UserBadgesList 
                    badges={profileData.badges} 
                    memberNumber={profileData.memberNumber} 
                    size="xl" 
                  />
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Your badges are proudly displayed on your profile. The OG Badge is exclusive to the first 100 members of Space.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-md space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Account Details</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[var(--app-panel)] border border-[var(--app-border)]">
                  <span className="text-[var(--text-secondary)] block">Registered</span>
                  <span className="font-bold text-[var(--text-primary)]">{joinedDate}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--app-panel)] border border-[var(--app-border)]">
                  <span className="text-[var(--text-secondary)] block">Status</span>
                  <span className="font-bold text-green-400 capitalize">{userStatus}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Navigation Tabs */}
            <div 
              className="h-12 px-6 flex items-center gap-4 border-b border-[var(--app-border)] bg-[var(--app-surface)] shrink-0"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)'
              }}
            >
              <button
                onClick={() => setActiveTab('connections')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'connections' 
                    ? 'frutiger-btn frutiger-btn-primary text-white shadow-xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Connections
                <span className="px-1.5 py-0.5 bg-black/20 rounded-full text-[10px]">({userConnections.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'friends' 
                    ? 'frutiger-btn frutiger-btn-primary text-white shadow-xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'
                }`}
              >
                <Users className="w-4 h-4" />
                Mutual Friends
                <span className="px-1.5 py-0.5 bg-black/20 rounded-full text-[10px]">({mutualFriends.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('spaces')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'spaces' 
                    ? 'frutiger-btn frutiger-btn-primary text-white shadow-xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'
                }`}
              >
                <Hash className="w-4 h-4" />
                Mutual Spaces
                <span className="px-1.5 py-0.5 bg-black/20 rounded-full text-[10px]">({mutualSpaces.length})</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'connections' ? (
                <div className="space-y-3">
                  {userConnections.length === 0 ? (
                    <p className="text-center text-[var(--text-secondary)] text-sm py-8">No public connections linked</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {userConnections.map((conn: any) => {
                        const brandColor = getProviderColor(conn.provider);
                        return (
                          <div
                            key={conn.id || conn.provider}
                            className="p-3.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-xs flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                                style={{ backgroundColor: brandColor }}
                              >
                                <ConnectionIcon provider={conn.provider} size={20} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-[var(--text-primary)] truncate">
                                    {conn.displayName || conn.username}
                                  </span>
                                  <span className="text-blue-400 text-xs">✓</span>
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)] capitalize truncate">
                                  {conn.provider}
                                </p>
                              </div>
                            </div>
                            {conn.profileUrl && (
                              <a
                                href={conn.profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--app-surface-hover)] transition-colors"
                                title="View on external platform"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : activeTab === 'friends' ? (
                <div className="grid grid-cols-2 gap-3">
                  {mutualFriends.map((friend) => (
                    <button
                      key={friend.userId}
                      onClick={() => onMessageUser && onMessageUser(friend.userId)}
                      className="flex items-center gap-3 p-3 bg-[var(--app-surface)] rounded-lg hover:bg-[var(--app-surface-hover)] transition-colors text-left"
                    >
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                          {friend.avatar ? <img src={friend.avatar} className="w-full h-full object-cover" /> : friend.username[0].toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--app-surface)] ${
                          friend.status === 'active' ? 'bg-green-500' : 'bg-gray-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{friend.displayName || friend.username}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{friend.status === 'active' ? 'Online' : 'Offline'}</p>
                      </div>
                    </button>
                  ))}
                  {mutualFriends.length === 0 && (
                    <p className="col-span-2 text-center text-[var(--text-secondary)] text-sm py-8">No mutual friends</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {mutualSpaces.map((space) => (
                    <div key={space.id} className="flex items-center gap-3 p-3 bg-[var(--app-surface)] rounded-lg">
                      <div className="w-10 h-10 rounded-lg bg-[var(--app-accent)]/20 flex items-center justify-center">
                        <Hash className="w-5 h-5 text-[var(--app-accent)]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{space.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{space.memberCount || 0} members</p>
                      </div>
                    </div>
                  ))}
                  {mutualSpaces.length === 0 && (
                    <p className="text-center text-[var(--text-secondary)] text-sm py-8">No mutual spaces</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </motion.div>
      {showSpaceModeratorView && <SpaceModeratorViewModal
        displayName={profileData.displayName || profileData.username}
        details={spaceModerationDetails as SpaceModerationDetails | null}
        loading={spaceModerationLoading}
        error={spaceModerationError}
        onRefresh={() => void loadSpaceModerationDetails()}
        onClose={() => setShowSpaceModeratorView(false)}
      />}
    </div>,
    document.body
  );
}
