import React, { useState, useEffect } from 'react';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Video, ShieldCheck, PhoneOff, Radio, ArrowRight } from 'lucide-react';
import { API_BASE } from '../config';

const LIVEKIT_URL = 'wss://space-e99bkuh6.livekit.cloud';

export interface VoiceVideoCallProps {
  roomName?: string;
  userName?: string;
  onLeave?: () => void;
  embedded?: boolean;
}

/**
 * VoiceVideoCall Component
 * LiveKit Cloud powered voice & video calling and screen sharing.
 */
export const VoiceVideoCall: React.FC<VoiceVideoCallProps> = ({
  roomName: propRoomName = '',
  userName: propUserName = '',
  onLeave,
  embedded = false,
}) => {
  const [userName, setUserName] = useState<string>(propUserName || '');
  const [roomName, setRoomName] = useState<string>(propRoomName || '');
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (propUserName) setUserName(propUserName);
    if (propRoomName) setRoomName(propRoomName);
  }, [propUserName, propRoomName]);

  const fetchToken = async (rName: string, uName: string): Promise<string> => {
    const baseUrls = [
      API_BASE || '',
      `${window.location.protocol}//${window.location.hostname}:3000`,
      'http://localhost:3000',
    ];

    let lastError: unknown = null;
    for (const base of baseUrls) {
      try {
        const url = `${base}/api/get-token`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: rName, userName: uName }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.token) {
            return data.token;
          }
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Failed to retrieve LiveKit token from server.');
  };

  const handleJoin = async (targetRoom = roomName, targetUser = userName) => {
    const finalRoom = (targetRoom || '').trim();
    const finalUser = (targetUser || '').trim();

    if (!finalUser) {
      setError('Please enter your name.');
      return;
    }
    if (!finalRoom) {
      setError('Please enter a room name.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const livekitToken = await fetchToken(finalRoom, finalUser);
      setToken(livekitToken);
    } catch (err: any) {
      console.error('[VoiceVideoCall] Token fetch error:', err);
      setError(err?.message || 'Could not connect to LiveKit server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propRoomName && propUserName && !token && !loading) {
      handleJoin(propRoomName, propUserName);
    }
  }, [propRoomName, propUserName]);

  const handleDisconnect = () => {
    setToken('');
    if (onLeave) {
      onLeave();
    }
  };

  if (token) {
    return (
      <div className={`w-full h-full flex flex-col bg-[#0b0f19] text-white relative ${embedded ? 'min-h-[420px]' : 'min-h-screen'}`}>
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#121827]/90 border-b border-white/10 backdrop-blur z-20">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" /> LiveKit Cloud SFU
            </span>
            <span className="text-white/20">|</span>
            <span className="text-sm font-bold text-white/90 truncate max-w-[200px]">
              Room: {roomName}
            </span>
            <span className="text-xs text-white/50 hidden sm:inline">({userName})</span>
          </div>

          <button
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow transition"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Leave Call</span>
          </button>
        </div>

        <div className="flex-1 w-full h-[calc(100%-48px)] relative overflow-hidden" data-lk-theme="default">
          <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={LIVEKIT_URL}
            connect={true}
            onDisconnected={handleDisconnect}
            data-lk-theme="default"
            style={{ height: '100%', width: '100%' }}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full flex items-center justify-center p-4 ${embedded ? 'min-h-[420px]' : 'min-h-screen bg-[#0b0f19]'}`}>
      <div className="w-full max-w-md bg-[#121827] border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">LiveKit Voice & Video</h2>
              <p className="text-xs text-white/60 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                LiveKit Cloud SFU • Cross-Network Ready
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                Your Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. soly or wow"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:border-cyan-400 focus:bg-white/10 focus:outline-none text-white text-sm transition placeholder:text-white/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. space-hangout or general"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:border-cyan-400 focus:bg-white/10 focus:outline-none text-white text-sm transition placeholder:text-white/30"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 active:scale-[0.98] transition shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 text-white disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to LiveKit…</span>
                  </>
                ) : (
                  <>
                    <span>Join Room</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-[11px] text-white/40 leading-relaxed">
              Provides crystal-clear audio, HD video, screen sharing, and automatic NAT bypass via LiveKit Cloud SFU.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceVideoCall;
