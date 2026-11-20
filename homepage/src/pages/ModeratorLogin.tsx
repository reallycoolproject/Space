import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';

export default function ModeratorLogin() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/tickets/moderator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.ok) {
        localStorage.setItem('moderator', JSON.stringify(data.moderator));
        localStorage.setItem('moderator_token', data.token);
        window.location.href = '/moderator/dashboard';
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-pink-100 flex items-center justify-center relative overflow-hidden" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Polka dot pattern background */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full" style={{
          backgroundImage: 'radial-gradient(circle, #8B4513 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Vector swirls */}
      <svg className="absolute top-0 left-0 w-96 h-96 opacity-30 pointer-events-none" viewBox="0 0 400 400">
        <path d="M50,200 Q100,50 200,100 T350,200" stroke="#8B4513" strokeWidth="3" fill="none" />
        <path d="M30,220 Q80,70 180,120 T330,220" stroke="#8B4513" strokeWidth="2" fill="none" />
        <circle cx="100" cy="150" r="8" fill="#8B4513" opacity="0.5" />
        <circle cx="150" cy="100" r="5" fill="#8B4513" opacity="0.5" />
      </svg>

      <svg className="absolute bottom-0 right-0 w-80 h-80 opacity-30 pointer-events-none" viewBox="0 0 400 400">
        <path d="M350,200 Q300,350 200,300 T50,200" stroke="#8B4513" strokeWidth="3" fill="none" />
        <path d="M370,180 Q320,330 220,280 T70,180" stroke="#8B4513" strokeWidth="2" fill="none" />
        <circle cx="300" cy="250" r="8" fill="#8B4513" opacity="0.5" />
        <circle cx="250" cy="300" r="5" fill="#8B4513" opacity="0.5" />
      </svg>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 border-2 border-[#8B4513] w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-[#8B4513] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#8B4513] mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            Moderator Login
          </h1>
          <p className="text-gray-600">Access the moderation dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div>
            <label className="block text-sm font-bold text-[#8B4513] mb-2">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B4513]" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border-2 border-[#8B4513] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B4513]"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-bold text-[#8B4513] mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B4513]" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border-2 border-[#8B4513] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B4513]"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-[#8B4513] hover:bg-[#6B3510] text-white font-bold rounded-xl shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              'Logging in...'
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Login
              </>
            )}
          </button>
        </form>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="text-[#8B4513] hover:underline"
          >
            Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}
