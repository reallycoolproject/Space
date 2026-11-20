import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MoreVertical, Edit3 } from 'lucide-react';
import type { UserBadge } from '../../types/chat';
import { UserBadgesList } from '../common/ProfileBadge';

interface GroupMember {
  userId: string;
  role: 'Owner' | 'Admin' | 'Member';
  username?: string;
  displayName?: string;
  avatar?: string;
  nickname?: string;
  badges?: UserBadge[];
  memberNumber?: number;
}

interface GroupMemberSidebarProps {
  members: GroupMember[];
  currentUserRole: 'Owner' | 'Admin' | 'Member';
  currentUserId: string;
  onKickMember: (userId: string) => Promise<void>;
  onUpdateRole: (userId: string, newRole: 'Owner' | 'Admin' | 'Member') => Promise<void>;
  onSetNickname: (userId: string, nickname: string) => Promise<void>;
  onViewProfile?: (member: GroupMember) => void;
  onClose: () => void;
}

export function GroupMemberSidebar({ members, currentUserRole, currentUserId, onKickMember, onUpdateRole, onSetNickname, onViewProfile, onClose }: GroupMemberSidebarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [actionError, setActionError] = useState('');

  const runMemberAction = async (action: () => Promise<void>) => {
    setActionError('');
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'That member action could not be completed.');
    }
  };

  const renderMember = (member: GroupMember) => {
    const isSelf = member.userId === currentUserId;
    const canManage = currentUserRole === 'Owner' || (currentUserRole === 'Admin' && member.role === 'Member');
    const displayName = member.nickname || member.displayName || member.username;



    const getRoleBadge = () => {
      switch (member.role) {
        case 'Owner':
          return <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase">Owner</span>;
        case 'Admin':
          return <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase">Admin</span>;
        default:
          return <span className="px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 text-[10px] font-bold uppercase">Member</span>;
      }
    };

    return (
      <div
        key={member.userId}
        className="relative group"
      >
        <div
          onClick={() => {
            if (onViewProfile) {
              onViewProfile(member);
            } else if (!isSelf) {
              setActiveMenu(activeMenu === member.userId ? null : member.userId);
            }
          }}
          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
            activeMenu === member.userId ? 'bg-white/10' : 'hover:bg-white/5'
          }`}
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white font-bold border border-white/10 overflow-hidden">
              {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" /> : (displayName || 'Unknown')[0].toUpperCase()}
            </div>
            {isSelf && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--app-accent)] rounded-full border-2 border-[var(--app-panel)]"></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold text-white truncate">{displayName || 'Unknown'}</p>
              {getRoleBadge()}
            </div>
            <p className="text-xs text-[var(--text-secondary)] truncate">@{member.username || 'unknown'}</p>
          </div>
        </div>

        {editingNickname === member.userId && (
          <form
            className="mt-2 space-y-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3"
            onSubmit={async event => {
              event.preventDefault();
              setIsSavingNickname(true);
              setActionError('');
              try {
                await onSetNickname(member.userId, nicknameDraft);
                setEditingNickname(null);
              } catch (error) {
                setActionError(error instanceof Error ? error.message : 'Could not save this nickname.');
              } finally {
                setIsSavingNickname(false);
              }
            }}
          >
            <label className="block text-xs font-medium text-[var(--text-primary)]">
              Nickname for {member.displayName || member.username}
              <input
                autoFocus
                maxLength={32}
                value={nicknameDraft}
                onChange={event => setNicknameDraft(event.target.value)}
                placeholder="Leave blank to clear"
                className="mt-1 w-full rounded-md border border-[var(--border-input)] bg-[var(--bg-input)] px-2.5 py-2 text-sm text-[var(--text-input)]"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingNickname(null)} className="rounded-md px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]">Cancel</button>
              <button type="submit" disabled={isSavingNickname} className="rounded-md bg-[var(--app-accent)] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{isSavingNickname ? 'Saving…' : 'Save nickname'}</button>
            </div>
          </form>
        )}

        {actionError && <p role="alert" className="mt-2 text-xs text-rose-400">{actionError}</p>}

        {((canManage && !isSelf) || isSelf) && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <button
              onClick={() => setActiveMenu(activeMenu === member.userId ? null : member.userId)}
              className="p-1.5 rounded-full hover:bg-white/10 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {activeMenu === member.userId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-36 bg-[var(--app-panel)] border border-[var(--app-border)] rounded-xl shadow-2xl py-1 z-50 overflow-hidden"
                >
                  <button
                    onClick={() => {
                      setNicknameDraft(member.nickname || '');
                      setEditingNickname(member.userId);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    <Edit3 className="w-3 h-3" />
                    {isSelf ? 'Change your nickname' : 'Set Nickname'}
                  </button>
                  {!isSelf && currentUserRole === 'Owner' && member.role !== 'Admin' && (
                    <button
                      onClick={() => { void runMemberAction(() => onUpdateRole(member.userId, 'Admin')); setActiveMenu(null); }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                    >
                      Promote to Admin
                    </button>
                  )}
                  {!isSelf && currentUserRole === 'Owner' && member.role === 'Admin' && (
                    <button
                      onClick={() => { void runMemberAction(() => onUpdateRole(member.userId, 'Member')); setActiveMenu(null); }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                    >
                      Demote to Member
                    </button>
                  )}
                  {!isSelf && currentUserRole === 'Owner' && (
                    <button
                      onClick={() => { void runMemberAction(() => onUpdateRole(member.userId, 'Owner')); setActiveMenu(null); }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                    >
                      Transfer Ownership
                    </button>
                  )}
                  {!isSelf && (
                    <button
                      onClick={() => { void runMemberAction(() => onKickMember(member.userId)); setActiveMenu(null); }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors border-t border-white/5"
                    >
                      Kick Member
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const owners = members.filter(m => m.role === 'Owner');
  const admins = members.filter(m => m.role === 'Admin');
  const regular = members.filter(m => m.role === 'Member');

  return (
    <motion.div 
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      className="w-72 bg-[var(--app-panel)]/90 backdrop-blur-xl border-l border-white/5 shadow-2xl flex flex-col z-20 shrink-0"
    >
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-white font-bold tracking-tight">Members ({members.length})</h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-[var(--text-secondary)] transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">

        {owners.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 pl-2">Owner</p>
            <div className="space-y-1">
              {owners.map(renderMember)}
            </div>
          </div>
        )}

        {admins.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 pl-2">Admins — {admins.length}</p>
            <div className="space-y-1">
              {admins.map(renderMember)}
            </div>
          </div>
        )}

        {regular.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 pl-2">Members — {regular.length}</p>
            <div className="space-y-1">
              {regular.map(renderMember)}
            </div>
          </div>
        )}

        {/* Fallback: Show all members if filtering returns nothing */}
        {owners.length === 0 && admins.length === 0 && regular.length === 0 && members.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 pl-2">All Members</p>
            <div className="space-y-1">
              {members.map(renderMember)}
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
}
