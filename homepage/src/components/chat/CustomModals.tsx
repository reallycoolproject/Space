import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import type { User } from '../../types/chat';
import { encryptText } from '../../utils/crypto';
import { API_BASE } from '../../config';


interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (forEveryone: boolean) => void;
  isMine: boolean;
}

export function DeleteMessageModal({ isOpen, onClose, onConfirm, isMine }: DeleteModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[var(--app-panel)] border border-[var(--app-border)] rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <h3 className="text-[var(--text-primary)] font-bold text-lg mb-2">Delete Message?</h3>
        <p className="text-[var(--text-secondary)] text-sm mb-6">Are you sure you want to delete this message? This action cannot be undone.</p>
        <div className="flex flex-col gap-3">
          {isMine && (
            <button onClick={() => { onConfirm(true); onClose(); }} className="w-full py-2.5 rounded-xl frutiger-btn frutiger-btn-danger text-white font-bold transition-all">
              Delete for Everyone
            </button>
          )}
          <button onClick={() => { onConfirm(false); onClose(); }} className="w-full py-2.5 rounded-xl frutiger-btn frutiger-btn-secondary text-white font-bold transition-all">
            Delete for Me
          </button>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold transition-colors">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: User[];
  messageText: string;
}

export function ForwardMessageModal({ isOpen, onClose, friends, messageText }: ForwardModalProps) {
  const [search, setSearch] = useState('');
  const [forwardingTo, setForwardingTo] = useState<string | null>(null);

  if (!isOpen) return null;

  const filtered = friends.filter(f => f.username.toLowerCase().includes(search.toLowerCase()) || f.displayName?.toLowerCase().includes(search.toLowerCase()));

  const handleForward = async (friend: User) => {
    setForwardingTo(friend.userId);
    try {
      const res = await fetch(`${API_BASE}/api/auth/user/${friend.userId}/public-key`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.ok && data.publicKey) {
        let payload = messageText;
        try { JSON.parse(payload); } catch { payload = JSON.stringify({ text: messageText }); }
        const encrypted = await encryptText(payload, data.publicKey);
        const currentUserStr = localStorage.getItem('user');
        const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
        
        const roomId = currentUser?.userId ? [currentUser.userId, friend.userId].sort().join('_') : 'dms';
        await fetch(`${API_BASE}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ roomId, content: encrypted })
        });
        // Close with success toast eventually
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
    setForwardingTo(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[var(--app-panel)] border border-[var(--app-border)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col h-96">
        <div className="p-4 border-b border-[var(--app-border)] flex items-center justify-between">
          <h3 className="text-[var(--text-primary)] font-bold">Forward Message</h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 border-b border-[var(--app-border)] relative">
          <Search className="w-4 h-4 absolute left-7 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friends..." className="w-full bg-[var(--bg-input)] border border-[var(--app-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-input)] focus:outline-none focus:border-[var(--app-accent)] transition-colors" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {filtered.map(f => (
            <div key={f.userId} className="flex items-center justify-between p-2 hover:bg-[var(--app-surface-hover)] rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--app-accent)] flex items-center justify-center text-[#10201d] font-bold overflow-hidden">
                  {f.avatar ? <img src={f.avatar} className="w-full h-full object-cover" /> : f.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-[var(--text-primary)] font-bold text-sm">{f.displayName || f.username}</div>
                  <div className="text-[var(--text-secondary)] text-xs">@{f.username}</div>
                </div>
              </div>
              <button 
                onClick={() => handleForward(f)}
                disabled={forwardingTo === f.userId}
                className="px-4 py-1.5 frutiger-btn frutiger-btn-primary disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all"
              >
                {forwardingTo === f.userId ? 'Sending...' : 'Send'}
              </button>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center p-4 text-[var(--text-secondary)] text-sm">No friends found.</div>}
        </div>
      </motion.div>
    </div>
  );
}
