import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, LogOut, CheckCircle, MessageSquare, Calendar, Tag, FileText, X, Trash2, RotateCcw } from 'lucide-react';

interface Note {
  type: 'update' | 'done' | 'info' | 'claim';
  content: string;
  author: string;
  timestamp: string;
}

interface Ticket {
  _id: string;
  userId: string;
  username: string;
  category: 'major' | 'minor';
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'bug' | 'suggestion' | 'infrastructure' | 'csam' | 'other';
  subject: string;
  description: string;
  mediaUrls: string[];
  status: 'open' | 'claimed' | 'in_progress' | 'done' | 'closed';
  claimedBy?: string;
  notes: Note[];
  inTrash: boolean;
  trashDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface Moderator {
  id: string;
  username: string;
  claimedTickets: string[];
}

export default function ModeratorDashboard() {
  const [moderator, setModerator] = useState<Moderator | null>(null);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [trashTickets, setTrashTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'update' | 'done' | 'info'>('update');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'trash'>('all');

  useEffect(() => {
    const moderatorData = localStorage.getItem('moderator');
    if (moderatorData) {
      setModerator(JSON.parse(moderatorData));
    } else {
      window.location.href = '/moderator/login';
    }
  }, []);

  useEffect(() => {
    if (moderator) {
      fetchTickets();
    }
  }, [moderator]);

  const fetchTickets = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('moderator_token')}` };
      const [allRes, myRes, trashRes] = await Promise.all([
        fetch(`/api/tickets/moderator/all/${moderator!.id}`, { headers }),
        fetch(`/api/tickets/moderator/claimed/${moderator!.id}`, { headers }),
        fetch(`/api/tickets/moderator/trash/${moderator!.id}`, { headers })
      ]);

      const allData = await allRes.json();
      const myData = await myRes.json();
      const trashData = await trashRes.json();

      if (allData.ok) setAllTickets(allData.tickets);
      if (myData.ok) setMyTickets(myData.tickets);
      if (trashData.ok) setTrashTickets(trashData.tickets);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimTicket = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('moderator_token')}` }
      });

      const data = await response.json();
      if (data.ok) {
        fetchTickets();
      }
    } catch (error) {
      console.error('Failed to claim ticket:', error);
    }
  };

  const handleAddNote = async () => {
    if (!selectedTicket || !noteContent.trim()) return;

    try {
      const response = await fetch(`/api/tickets/${selectedTicket._id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moderatorId: moderator!.id,
          moderatorName: moderator!.username,
          type: noteType,
          content: noteContent
        })
      });

      const data = await response.json();
      if (data.ok) {
        setNoteContent('');
        fetchTickets();
        setSelectedTicket(data.ticket);
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleFinishTicket = async () => {
    if (!selectedTicket) return;

    try {
      const response = await fetch(`/api/tickets/${selectedTicket._id}/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('moderator_token')}` }
      });

      const data = await response.json();
      if (data.ok) {
        setSelectedTicket(null);
        fetchTickets();
      }
    } catch (error) {
      console.error('Failed to finish ticket:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('moderator');
    localStorage.removeItem('moderator_token');
    window.location.href = '/moderator/login';
  };

  const handlePermanentDelete = async (ticketId: string) => {
    if (!confirm('Are you sure you want to permanently delete this ticket? This cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(`/api/tickets/${ticketId}/permanent`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('moderator_token')}` }
      });

      const data = await response.json();
      if (data.ok) {
        fetchTickets();
        setSelectedTicket(null);
      }
    } catch (error) {
      console.error('Failed to delete ticket:', error);
    }
  };

  const handleRestoreTicket = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('moderator_token')}` }
      });

      const data = await response.json();
      if (data.ok) {
        fetchTickets();
        setSelectedTicket(null);
      }
    } catch (error) {
      console.error('Failed to restore ticket:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'claimed': return 'bg-purple-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'done': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pink-100 flex items-center justify-center">
        <div className="text-[#8B4513] text-xl">Loading...</div>
      </div>
    );
  }

  const displayedTickets = activeTab === 'all' ? allTickets : activeTab === 'my' ? myTickets : trashTickets;

  return (
    <div className="min-h-screen bg-pink-100 relative overflow-hidden" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Polka dot pattern background */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full" style={{
          backgroundImage: 'radial-gradient(circle, #8B4513 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Header */}
      <div className="relative z-10 bg-[#8B4513] text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Moderator Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm opacity-80">Logged in as: {moderator?.username}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-[#8B4513] text-white'
                : 'bg-white text-[#8B4513] hover:bg-pink-50'
            }`}
          >
            All Tickets ({allTickets.length})
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'my'
                ? 'bg-[#8B4513] text-white'
                : 'bg-white text-[#8B4513] hover:bg-pink-50'
            }`}
          >
            My Tickets ({myTickets.length})
          </button>
          <button
            onClick={() => setActiveTab('trash')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'trash'
                ? 'bg-[#8B4513] text-white'
                : 'bg-white text-[#8B4513] hover:bg-pink-50'
            }`}
          >
            Trash ({trashTickets.length})
          </button>
        </div>

        {/* Tickets Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Ticket List */}
          <div className="space-y-4">
            {displayedTickets.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-[#8B4513] text-center">
                <MessageSquare className="w-16 h-16 text-[#8B4513] mx-auto mb-4 opacity-50" />
                <p className="text-[#8B4513] text-lg">No tickets to display</p>
              </div>
            ) : (
              displayedTickets.map((ticket) => (
                <motion.div
                  key={ticket._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`bg-white rounded-2xl shadow-lg p-6 border-2 cursor-pointer transition-all hover:shadow-xl ${
                    selectedTicket?._id === ticket._id ? 'border-[#8B4513] ring-2 ring-[#8B4513]' : 'border-[#8B4513]/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority.toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${ticket.category === 'major' ? 'bg-red-600' : 'bg-blue-600'}`}>
                          {ticket.category.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[#8B4513]">{ticket.subject}</h3>
                      <p className="text-sm text-gray-600 mt-1">{ticket.username}</p>
                    </div>
                    <Tag className="w-5 h-5 text-[#8B4513]" />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {ticket.notes.length} notes
                    </div>
                  </div>
                  {ticket.status === 'open' && activeTab === 'all' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaimTicket(ticket._id);
                      }}
                      className="mt-4 w-full py-2 bg-[#8B4513] hover:bg-[#6B3510] text-white font-bold rounded-lg transition-colors"
                    >
                      Claim Ticket
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {/* Ticket Detail */}
          <AnimatePresence>
            {selectedTicket && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white rounded-2xl shadow-lg p-6 border-2 border-[#8B4513] h-fit sticky top-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-[#8B4513]">Ticket Details</h2>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Ticket Info */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm font-bold text-[#8B4513]">Subject</label>
                    <p className="text-gray-700">{selectedTicket.subject}</p>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-[#8B4513]">Description</label>
                    <p className="text-gray-700">{selectedTicket.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-[#8B4513]">Type</label>
                      <p className="text-gray-700 capitalize">{selectedTicket.type}</p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-[#8B4513]">Priority</label>
                      <p className="text-gray-700 capitalize">{selectedTicket.priority}</p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-[#8B4513]">Status</label>
                      <p className="text-gray-700 capitalize">{selectedTicket.status.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-[#8B4513]">Claimed By</label>
                      <p className="text-gray-700">{selectedTicket.claimedBy || 'Unclaimed'}</p>
                    </div>
                  </div>
                  {selectedTicket.mediaUrls.length > 0 && (
                    <div>
                      <label className="text-sm font-bold text-[#8B4513]">Attachments</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedTicket.mediaUrls.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#8B4513] hover:underline text-sm"
                          >
                            Attachment {index + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[#8B4513] mb-4">Notes</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedTicket.notes.length === 0 ? (
                      <p className="text-gray-500 text-sm">No notes yet</p>
                    ) : (
                      selectedTicket.notes.map((note, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg ${
                            note.type === 'done' ? 'bg-green-50 border border-green-200' :
                            note.type === 'claim' ? 'bg-blue-50 border border-blue-200' :
                            note.type === 'update' ? 'bg-yellow-50 border border-yellow-200' :
                            'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase text-gray-600">{note.type}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(note.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{note.content}</p>
                          <p className="text-xs text-gray-500 mt-1">- {note.author}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Add Note */}
                {selectedTicket.claimedBy === moderator?.username && (
                  <div className="space-y-3 mb-6">
                    <h3 className="text-lg font-bold text-[#8B4513]">Add Note</h3>
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value as any)}
                      className="w-full p-2 border-2 border-[#8B4513] rounded-lg text-gray-900 bg-white"
                    >
                      <option value="update">Update</option>
                      <option value="info">Info</option>
                      <option value="done">Done</option>
                    </select>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full p-3 border-2 border-[#8B4513] rounded-lg min-h-[80px] text-gray-900 bg-white"
                      placeholder="Enter your note..."
                    />
                    <button
                      onClick={handleAddNote}
                      className="w-full py-2 bg-[#8B4513] hover:bg-[#6B3510] text-white font-bold rounded-lg transition-colors"
                    >
                      Add Note
                    </button>
                  </div>
                )}

                {/* Finish Ticket */}
                {selectedTicket.claimedBy === moderator?.username && selectedTicket.status !== 'closed' && (
                  <button
                    onClick={handleFinishTicket}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Mark as Finished
                  </button>
                )}

                {/* Trash Actions */}
                {selectedTicket.inTrash && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleRestoreTicket(selectedTicket._id)}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Restore Ticket
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(selectedTicket._id)}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete Permanently
                    </button>
                    {selectedTicket.trashDate && (
                      <p className="text-sm text-gray-500 text-center">
                        Auto-delete in {Math.max(0, 30 - Math.ceil((new Date().getTime() - new Date(selectedTicket.trashDate).getTime()) / (1000 * 60 * 60 * 24)))} days
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
