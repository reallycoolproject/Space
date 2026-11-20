import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, X, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../config';


interface DetailedReportModalProps {
  reportedUserId: string | null;
  currentUserId: string;
  chatTranscript: any[];
  onClose: () => void;
}

const REPORT_REASONS = [
  "CSAM / Illegal Material",
  "Threats or Violence",
  "Hate Speech",
  "Spam / Phishing",
  "Impersonation",
  "Other"
];

export function DetailedReportModal({ reportedUserId, onClose }: DetailedReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!reportedUserId) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          reportedUserId,
          reason: selectedReason,
          details: customReason.trim()
        })
      });

      const data = await response.json();
      console.log('Report response:', data);

      if (data.ok) {
        setIsSubmitting(false);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onClose();
          setSelectedReason('');
          setCustomReason('');
        }, 2000);
      } else {
        console.error('Report submission failed:', data.message);
        alert('Failed to submit report: ' + (data.message || 'Unknown error'));
        setIsSubmitting(false);
      }

    } catch (e) {
      console.error('Report submission error:', e);
      alert('Failed to submit report. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        className="w-full max-w-md bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-[2rem] overflow-hidden shadow-2xl p-8 relative"
      >
        {!showSuccess ? (
          <>
            <button 
              onClick={onClose} 
              className="absolute top-6 right-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-6 h-6" />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-[var(--app-accent)]/20 text-[var(--app-accent)] flex items-center justify-center mb-6 shadow-md">
              <Flag className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: 'Georgia, serif' }}>Report User</h3>
            <p className="text-base text-[var(--text-secondary)] mb-6 leading-relaxed">
              Select a reason for reporting. A cryptographically signed copy of your local chat history with this user will be securely attached to this report.
            </p>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
                    selectedReason === reason 
                      ? 'frutiger-btn frutiger-btn-primary text-white shadow-md' 
                      : 'frutiger-btn frutiger-btn-secondary text-[var(--text-primary)]'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            
            <AnimatePresence>
              {(selectedReason === 'Other' || selectedReason) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <textarea 
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    placeholder="Provide additional details..."
                    disabled={isSubmitting}
                    rows={3}
                    className="w-full bg-[var(--app-surface)] border-2 border-[var(--app-border)] p-4 rounded-2xl text-base text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--app-accent)] transition-all shadow-sm resize-none mb-6 mt-2"
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex gap-3 mt-4">
              <button 
                onClick={onClose} 
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-2xl frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                disabled={!selectedReason || isSubmitting}
                onClick={handleSubmit}
                className="flex-1 py-3.5 rounded-2xl frutiger-btn frutiger-btn-danger text-white font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  "Submit Report"
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <CheckCircle2 className="w-16 h-16 text-[var(--app-accent)] mb-4" />
            </motion.div>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: 'Georgia, serif' }}>Report Submitted</h3>
            <p className="text-[var(--text-secondary)]">Thank you for helping keep our community safe.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
