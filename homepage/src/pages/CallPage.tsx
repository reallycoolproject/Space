import React from 'react';
import { useSearchParams } from 'react-router-dom';
import VoiceVideoCall from '../calls/VoiceVideoCall';
import { useAuth } from '../contexts/AuthContext';

export default function CallPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const roomName = searchParams.get('room') || searchParams.get('roomName') || '';
  const userName = searchParams.get('user') || searchParams.get('userName') || user?.displayName || user?.username || '';

  return (
    <div className="w-full h-screen bg-[#0b0f19]">
      <VoiceVideoCall roomName={roomName} userName={userName} />
    </div>
  );
}
