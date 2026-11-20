import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Users,
  Flag,
  LogOut,
  Shield,
  Crown,
  Calendar,
  UserPlus,
  Search,
  Check,
  ImageIcon,
  Lock,
  Sparkles,
  Copy
} from 'lucide-react';
import { useThemeCustomization } from '../../contexts/ThemeContext';
import { ImageCropModal, type CropResult } from '../common/ImageCropModal';

interface FriendOption {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  groupDescription: string;
  groupId: string;
  createdBy: string;
  createdByAvatar?: string;
  createdByUsername?: string;
  createdByUserId?: string;
  createdAt?: Date;
  memberCount: number;
  currentMemberIds: string[];
  currentUserRole: 'Owner' | 'Admin' | 'Member';
  allowMemberAdds: boolean;
  allowMemberEditInfo: boolean;
  friends: FriendOption[];
  onLeaveGroup: () => Promise<void>;
  onReportGroup: () => void;
  onAddMembers: (memberIds: string[]) => Promise<void>;
  onSetAllowMemberAdds: (allow: boolean) => Promise<void>;
  onSetAllowMemberEditInfo: (allow: boolean) => Promise<void>;
  onUpdateGroupDetails: (details: { name: string; description: string }) => Promise<void>;
  onShowMembers?: () => void;
  onViewProfile?: (userId: string) => void;
}

export function GroupInfoModal({
  isOpen,
  onClose,
  groupName,
  groupDescription,
  groupId,
  createdBy,
  createdByAvatar,
  createdByUsername,
  createdByUserId,
  createdAt,
  memberCount,
  currentMemberIds,
  currentUserRole,
  allowMemberAdds,
  allowMemberEditInfo,
  friends,
  onLeaveGroup,
  onReportGroup,
  onAddMembers,
  onSetAllowMemberAdds,
  onSetAllowMemberEditInfo,
  onUpdateGroupDetails,
  onShowMembers,
  onViewProfile
}: GroupInfoModalProps) {
  const { setWallpaper, getWallpaper } = useThemeCustomization();

  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'add'>('info');
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showSpaceWallpaperCropper, setShowSpaceWallpaperCropper] = useState(false);
  const [nameDraft, setNameDraft] = useState(groupName);
  const [descriptionDraft, setDescriptionDraft] = useState(groupDescription);
  const [leaveError, setLeaveError] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('info');
    setMemberSearch('');
    setSelectedMemberIds([]);
    setInviteError('');
    setLeaveError('');
    setNameDraft(groupName);
    setDescriptionDraft(groupDescription);
  }, [isOpen, groupId, groupName, groupDescription]);

  if (!isOpen) return null;

  const formatDate = (date?: Date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const canAddMembers = currentUserRole !== 'Member' || allowMemberAdds;
  const canEditDetails = currentUserRole !== 'Member' || allowMemberEditInfo;
  const availableFriends = friends.filter(friend =>
    !currentMemberIds.includes(friend.userId) &&
    `${friend.displayName || ''} ${friend.username}`.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const submitInvites = async () => {
    if (!selectedMemberIds.length) return;
    setIsInviting(true);
    setInviteError('');
    try {
      await onAddMembers(selectedMemberIds);
      setSelectedMemberIds([]);
      setActiveTab('info');
      setMemberSearch('');
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Could not add members.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(groupId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const spaceWallpaper = getWallpaper(groupId);

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="my-auto flex min-h-0 w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--app-panel)] shadow-2xl max-h-[min(88dvh,760px)]"
          style={{
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 0 30px rgba(2, 136, 209, 0.25)',
            backdropFilter: 'var(--app-panel-backdrop)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Frutiger Aero Window Title Bar */}
          <div 
            className="h-10 px-4 flex items-center justify-between border-b border-[var(--app-border)] select-none shrink-0"
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.15) 50%, rgba(0, 0, 0, 0.08) 51%, rgba(255, 255, 255, 0.2) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.8)'
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400 shadow-sm border border-red-500/40" />
                <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm border border-amber-500/40" />
                <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm border border-emerald-500/40" />
              </div>
              <span 
                className="text-xs font-black tracking-wider uppercase text-[var(--text-primary)] ml-2 flex items-center gap-1.5"
                style={{ textShadow: '0 1px 0 rgba(255,255,255,0.7)' }}
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                Group settings · {groupName}
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] text-[var(--text-secondary)] flex items-center justify-center transition-colors shadow-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Hero Banner Header */}
          <div 
            className="relative p-6 shrink-0 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(2,136,209,0.3) 0%, rgba(118,196,66,0.2) 50%, rgba(233,30,140,0.15) 100%)',
              boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.4)'
            }}
          >
            {/* Specular gloss streak */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 60%)'
              }}
            />

            <div className="relative z-10 flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-xl border border-white/60 shrink-0"
                style={{
                  background: 'linear-gradient(155deg, #76d7f5 0%, #28aee3 46%, #087db9 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 20px rgba(2,136,209,0.3)'
                }}
              >
                {groupName.slice(0, 1).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 
                    className="text-xl font-black text-[var(--text-primary)] truncate"
                    style={{ textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}
                  >
                    {groupName}
                  </h2>
                </div>
                {groupDescription && (
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-secondary)]">{groupDescription}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <button
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--app-surface)] text-[var(--text-secondary)] border border-[var(--app-border)] hover:bg-[var(--app-surface-hover)] transition-colors"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    {copiedId ? 'Copied ID!' : `ID: ${groupId.slice(-8)}`}
                  </button>

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--app-accent)]/20 text-[var(--app-accent)] border border-[var(--app-accent)]/40">
                    <Users className="w-2.5 h-2.5" />
                    {memberCount} / 10 Members
                  </span>

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/40">
                    <Lock className="w-2.5 h-2.5" />
                    E2EE Kyber-768
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Bar / Tabs */}
          <div 
            className="h-12 px-5 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] shrink-0"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'info'
                    ? 'frutiger-btn frutiger-btn-primary text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'
                }`}
              >
                Overview
              </button>

              {onShowMembers && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onShowMembers();
                  }}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition-all hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <Users className="h-3.5 w-3.5" />
                  Members
                </button>
              )}

              {canAddMembers && (
                <button
                  onClick={() => setActiveTab('add')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    activeTab === 'add'
                      ? 'frutiger-btn frutiger-btn-primary text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add people
                </button>
              )}
            </div>

            {/* Custom Space Wallpaper Button */}
            <button
              onClick={() => setShowSpaceWallpaperCropper(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] flex items-center gap-1.5 shadow-xs"
              title="Set a wallpaper for this group chat"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[var(--app-accent)]" />
              {spaceWallpaper ? 'Change wallpaper' : 'Set wallpaper'}
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {activeTab === 'info' && (
              <div className="space-y-3">
                {/* Space Owner Card */}
                <div
                  className={`flex items-center gap-3 p-3.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] shadow-xs ${
                    onViewProfile && createdByUserId ? 'cursor-pointer hover:bg-[var(--app-surface-hover)] transition-colors' : ''
                  }`}
                  onClick={() => onViewProfile && createdByUserId && onViewProfile(createdByUserId)}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] text-white flex items-center justify-center overflow-hidden font-bold shadow-sm shrink-0">
                    {createdByAvatar ? <img src={createdByAvatar} className="w-full h-full object-cover" /> : <Crown className="w-5 h-5 text-amber-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{createdByUsername || createdBy}</p>
                    <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-400" /> Group owner
                    </p>
                  </div>
                  {onViewProfile && createdByUserId && (
                    <span className="text-xs text-[var(--app-accent)] font-bold">View Profile →</span>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] mb-1">
                      <Calendar className="w-4 h-4 text-[var(--app-accent)]" />
                      Created On
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{formatDate(createdAt)}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] mb-1">
                      <Shield className="w-4 h-4 text-[var(--app-accent-secondary)]" />
                      Your Role
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{currentUserRole}</p>
                  </div>
                </div>

                {/* Member Permissions Policy */}
                {currentUserRole === 'Owner' ? (
                  <div className="space-y-3 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] p-3.5 shadow-xs">
                    <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">Members Can Add Friends</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">Allow group members to invite their friends directly.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowMemberAdds}
                      disabled={isSavingPolicy}
                      onClick={async () => {
                        setIsSavingPolicy(true);
                        setInviteError('');
                        try { await onSetAllowMemberAdds(!allowMemberAdds); }
                        catch (error) { setInviteError(error instanceof Error ? error.message : 'Could not update policy.'); }
                        finally { setIsSavingPolicy(false); }
                      }}
                      className={`w-11 h-6 shrink-0 rounded-full relative transition-colors ${allowMemberAdds ? 'bg-[var(--app-accent)]' : 'bg-gray-500'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${allowMemberAdds ? 'right-1' : 'left-1'}`} />
                    </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-3">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">Members Can Edit Group Details</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">Let members change the group name and description.</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={allowMemberEditInfo}
                        disabled={isSavingPolicy}
                        onClick={async () => {
                          setIsSavingPolicy(true);
                          setInviteError('');
                          try { await onSetAllowMemberEditInfo(!allowMemberEditInfo); }
                          catch (error) { setInviteError(error instanceof Error ? error.message : 'Could not update policy.'); }
                          finally { setIsSavingPolicy(false); }
                        }}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${allowMemberEditInfo ? 'bg-[var(--app-accent)]' : 'bg-gray-500'}`}
                      >
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${allowMemberEditInfo ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">Admins can always edit group details. Only the owner can change these permissions.</p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] text-xs text-[var(--text-secondary)] shadow-xs">
                    <span className="font-bold text-[var(--text-primary)] block">Member Invites:</span>
                    {allowMemberAdds ? 'All members can invite their friends.' : 'Only the owner and admins can invite new members.'}
                  </div>
                )}

                <form
                  className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 shadow-xs"
                  onSubmit={async event => {
                    event.preventDefault();
                    setIsSavingPolicy(true);
                    setInviteError('');
                    try {
                      await onUpdateGroupDetails({ name: nameDraft, description: descriptionDraft });
                    } catch (error) {
                      setInviteError(error instanceof Error ? error.message : 'Could not update group details.');
                    } finally {
                      setIsSavingPolicy(false);
                    }
                  }}
                >
                  <div>
                    <label htmlFor="group-name" className="mb-1 block text-xs font-bold text-[var(--text-primary)]">Group name</label>
                    <input
                      id="group-name"
                      value={nameDraft}
                      onChange={event => setNameDraft(event.target.value)}
                      maxLength={100}
                      disabled={!canEditDetails}
                      className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-input)] disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label htmlFor="group-description" className="mb-1 block text-xs font-bold text-[var(--text-primary)]">Description</label>
                    <textarea
                      id="group-description"
                      value={descriptionDraft}
                      onChange={event => setDescriptionDraft(event.target.value)}
                      maxLength={500}
                      rows={3}
                      disabled={!canEditDetails}
                      placeholder="What is this group for?"
                      className="w-full resize-y rounded-lg border border-[var(--app-border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-input)] disabled:opacity-60"
                    />
                    <p className="mt-1 text-right text-[10px] text-[var(--text-secondary)]">{descriptionDraft.length}/500</p>
                  </div>
                  {canEditDetails ? (
                    <button
                      type="submit"
                      disabled={isSavingPolicy || !nameDraft.trim() || (nameDraft === groupName && descriptionDraft === groupDescription)}
                      className="rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Save group details
                    </button>
                  ) : (
                    <p className="text-[11px] text-[var(--text-secondary)]">Only admins can edit these details unless the owner allows members to do so.</p>
                  )}
                  {inviteError && <p className="text-xs font-semibold text-red-400" role="alert">{inviteError}</p>}
                </form>

                {/* Danger & Action Buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => setShowConfirmLeave(true)}
                    className="w-full py-2.5 rounded-xl frutiger-btn frutiger-btn-danger text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave group
                  </button>

                  <button
                    onClick={onReportGroup}
                    className="w-full py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Report group
                  </button>
                </div>
              </div>
            )}

            {/* Add Friends Tab */}
            {activeTab === 'add' && canAddMembers && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search friends to add..."
                    className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--bg-input)] py-2 pl-9 pr-3 text-xs text-[var(--text-input)] focus:outline-none"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-[var(--app-border)]">
                  {availableFriends.map(friend => {
                    const selected = selectedMemberIds.includes(friend.userId);
                    const full = memberCount + selectedMemberIds.length >= 10 && !selected;
                    return (
                      <button
                        key={friend.userId}
                        type="button"
                        disabled={full}
                        onClick={() => setSelectedMemberIds(prev => selected ? prev.filter(id => id !== friend.userId) : [...prev, friend.userId])}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors ${
                          selected ? 'bg-[var(--app-accent)]/15' : 'hover:bg-[var(--app-surface-hover)]'
                        } disabled:opacity-40`}
                      >
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] text-white flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                          {friend.avatar ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" /> : friend.username[0]?.toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-xs font-bold text-[var(--text-primary)]">{friend.displayName || friend.username}</span>
                          <span className="block truncate text-[10px] text-[var(--text-secondary)]">@{friend.username}</span>
                        </span>
                        {selected && <Check className="w-4 h-4 text-[var(--app-accent)]" />}
                      </button>
                    );
                  })}
                  {!availableFriends.length && (
                    <p className="py-6 text-center text-xs text-[var(--text-secondary)]">No available friends to add.</p>
                  )}
                </div>

                {inviteError && <p className="text-xs text-red-400 font-bold">{inviteError}</p>}

                <button
                  type="button"
                  onClick={() => void submitInvites()}
                  disabled={!selectedMemberIds.length || isInviting}
                  className="w-full rounded-xl frutiger-btn frutiger-btn-primary py-2.5 text-xs font-bold text-white disabled:opacity-50 shadow-md flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  {isInviting ? 'Adding Friends...' : `Add ${selectedMemberIds.length || ''} Friends`}
                </button>
              </div>
            )}
          </div>

          {/* Leave Confirmation Modal */}
          <AnimatePresence>
            {showConfirmLeave && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-[var(--app-panel)] border border-[var(--app-border)] rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl"
                >
                  <h3 className="text-[var(--text-primary)] font-bold text-base">Leave "{groupName}"?</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Are you sure you want to leave this group? You will need an invite to rejoin and see its messages.
                  </p>
                  {leaveError && <p className="text-xs text-red-400" role="alert">{leaveError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowConfirmLeave(false)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={isLeaving}
                      onClick={async () => {
                        setIsLeaving(true);
                        setLeaveError('');
                        try {
                          await onLeaveGroup();
                          setShowConfirmLeave(false);
                          onClose();
                        } catch (error) {
                          setLeaveError(error instanceof Error ? error.message : 'Could not leave this group.');
                        } finally {
                          setIsLeaving(false);
                        }
                      }}
                      className="flex-1 py-2 rounded-xl frutiger-btn frutiger-btn-danger text-white text-xs font-bold shadow-md disabled:opacity-50"
                    >
                      {isLeaving ? 'Leaving…' : 'Confirm Leave'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Group chat wallpaper editor */}
          <ImageCropModal
            isOpen={showSpaceWallpaperCropper}
            onClose={() => setShowSpaceWallpaperCropper(false)}
            mode="wallpaper"
            initialImage={spaceWallpaper?.url || ''}
            targetTitle={`Wallpaper for ${groupName}`}
            onApply={(result: CropResult) => {
              setWallpaper(groupId, {
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
