import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Check } from 'lucide-react';
import type { User } from '../../types/chat';

interface GroupChatCreationModalProps {
  isOpen: boolean;
  friends: User[];
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => void;
}

export function GroupChatCreationModal({ isOpen, friends, onClose, onCreate }: GroupChatCreationModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const handleToggleFriend = (userId: string) => {
    setSelectedFriends(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        if (prev.length >= 9) return prev;
        return [...prev, userId];
      }
    });
  };

  const handleCreate = () => {
    if (!groupName.trim() || selectedFriends.length === 0) return;
    onCreate(groupName.trim(), selectedFriends);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        className="w-full max-w-md bg-[var(--app-panel)] border border-[var(--app-border)] rounded-xl overflow-hidden shadow-2xl p-6 relative flex flex-col max-h-[85vh]"
      >
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="w-12 h-12 rounded-lg bg-[var(--app-accent)]/10 text-[var(--app-accent)] flex items-center justify-center mb-4 shrink-0">
          <Users className="w-8 h-8" />
        </div>
        
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1 shrink-0">Create group chat</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-5 shrink-0">
          Create an encrypted group chat for up to 10 members.
        </p>

        <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-2 mb-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Group name</label>
            <input 
              type="text" 
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., The Space Lounge"
              className="w-full bg-[var(--bg-input)] border border-[var(--app-border)] px-3 py-2.5 rounded-md text-sm text-[var(--text-input)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--app-accent)]"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-[var(--text-primary)]">Select members</label>
              <span className="text-xs font-medium text-[var(--app-accent)]">{selectedFriends.length + 1} / 10</span>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends..."
              className="w-full bg-[var(--bg-input)] border border-[var(--app-border)] px-3 py-2.5 rounded-md text-sm text-[var(--text-input)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--app-accent)] mb-3"
            />

            {friends?.length === 0 ? (
              <p className="text-base text-[var(--text-secondary)] italic p-4 text-center bg-[var(--app-surface)] rounded-2xl border-2 border-[var(--app-border)]">You have no friends to add.</p>
            ) : (
              <div className="space-y-2">
                {friends?.filter(friend =>
                  searchQuery === '' ||
                  friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (friend.displayName && friend.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
                ).map(friend => {
                  const isSelected = selectedFriends.includes(friend.userId);
                  const disabled = !isSelected && selectedFriends.length >= 9;
                  
                  return (
                    <div 
                      key={friend.userId}
                      onClick={() => !disabled && handleToggleFriend(friend.userId)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                        isSelected 
                          ? 'bg-[var(--app-accent)]/10 border-[var(--app-accent)] cursor-pointer'
                          : disabled 
                            ? 'bg-[var(--app-surface)] border-[var(--app-border)] opacity-50 cursor-not-allowed' 
                            : 'bg-[var(--app-surface)] border-[var(--app-border)] hover:bg-[var(--app-surface-hover)] cursor-pointer'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--app-accent)] flex items-center justify-center text-[#10201d] font-semibold border border-[var(--app-border)] overflow-hidden relative">
                        {friend.avatar ? <img src={friend.avatar} className="w-full h-full object-cover" /> : friend.username[0].toUpperCase()}
                        {isSelected && (
                          <div className="absolute inset-0 bg-[var(--app-accent)]/85 flex items-center justify-center">
                            <Check className="w-6 h-6 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-[var(--text-primary)] truncate">{friend.displayName || friend.username}</p>
                        <p className="text-sm text-[var(--text-secondary)] truncate">@{friend.username}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 shrink-0 pt-2 border-t-2 border-[var(--app-border)]">
          <button 
            onClick={onClose} 
            className="flex-1 py-2.5 rounded-md frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            disabled={!groupName.trim() || selectedFriends.length === 0}
            onClick={handleCreate}
            className="flex-1 py-2.5 rounded-md frutiger-btn frutiger-btn-primary text-white font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            Create Group
          </button>
        </div>
      </motion.div>
    </div>
  );
}
