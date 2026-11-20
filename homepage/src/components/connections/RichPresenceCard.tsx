import React, { useState, useEffect } from 'react';
import { type IUserActivity } from '../../types/connections';
import { ConnectionIcon, getProviderColor } from './ConnectionIcons';
import { Play, Pause, ExternalLink, Radio, Gamepad2, Tv, Trophy, Music } from 'lucide-react';

interface RichPresenceCardProps {
  activity?: IUserActivity | null;
  compact?: boolean;
}

export function RichPresenceCard({ activity, compact = false }: RichPresenceCardProps) {
  const [elapsed, setElapsed] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressTime, setProgressTime] = useState({ current: '0:00', total: '0:00' });

  useEffect(() => {
    if (!activity) return;

    const updateTimers = () => {
      const now = Date.now();
      const start = activity.timestamps?.start;
      const end = activity.timestamps?.end;

      if (start) {
        const diffSeconds = Math.max(0, Math.floor((now - start) / 1000));
        const hours = Math.floor(diffSeconds / 3600);
        const mins = Math.floor((diffSeconds % 3600) / 60);
        const secs = diffSeconds % 60;
        if (hours > 0) {
          setElapsed(`${hours}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs} elapsed`);
        } else {
          setElapsed(`${mins}:${secs < 10 ? '0' : ''}${secs} elapsed`);
        }
      }

      if (start && end && end > start) {
        const total = Math.floor((end - start) / 1000);
        const current = Math.min(total, Math.max(0, Math.floor((now - start) / 1000)));
        const pct = Math.min(100, Math.max(0, (current / total) * 100));
        setProgressPercent(pct);

        const curMin = Math.floor(current / 60);
        const curSec = current % 60;
        const totMin = Math.floor(total / 60);
        const totSec = total % 60;
        setProgressTime({
          current: `${curMin}:${curSec < 10 ? '0' : ''}${curSec}`,
          total: `${totMin}:${totSec < 10 ? '0' : ''}${totSec}`
        });
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [activity]);

  if (!activity) return null;

  const isSpotify = activity.provider === 'spotify' || activity.type === 'listening';
  const isStreaming = activity.type === 'streaming';
  const isGaming = activity.type === 'playing';
  const isWatching = activity.type === 'watching';
  const isCompeting = activity.type === 'competing';

  const brandColor = activity.provider ? getProviderColor(activity.provider) : '#3b82f6';

  // Compact variant for member sidebar or quick profile header
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs backdrop-blur-md">
        <span className="shrink-0 flex items-center justify-center w-4 h-4 text-white">
          {activity.provider ? (
            <ConnectionIcon provider={activity.provider} size={14} />
          ) : isSpotify ? (
            <Music className="w-3.5 h-3.5 text-green-400" />
          ) : isStreaming ? (
            <Radio className="w-3.5 h-3.5 text-purple-400" />
          ) : (
            <Gamepad2 className="w-3.5 h-3.5 text-blue-400" />
          )}
        </span>
        <div className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-white/90">
            {isSpotify ? 'Listening to ' : isStreaming ? 'Streaming ' : isWatching ? 'Watching ' : isCompeting ? 'Competing in ' : 'Playing '}
          </span>
          <span className="font-bold text-white truncate">{activity.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative overflow-hidden rounded-2xl border border-white/15 p-4 text-white shadow-2xl transition-all"
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.92) 100%)',
        boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 rgba(255, 255, 255, 0.15)`
      }}
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {activity.provider && (
            <div 
              className="w-5 h-5 rounded-md flex items-center justify-center p-0.5 text-white shadow-xs"
              style={{ backgroundColor: brandColor }}
            >
              <ConnectionIcon provider={activity.provider} size={13} />
            </div>
          )}
          <span className="text-[11px] font-black tracking-wider uppercase text-white/70 flex items-center gap-1.5">
            {isSpotify ? (
              <>Listening to Spotify</>
            ) : isStreaming ? (
              <>Streaming on {activity.provider === 'kick' ? 'Kick' : 'Twitch'}</>
            ) : isWatching ? (
              <>Watching Media</>
            ) : isCompeting ? (
              <>In Match · {activity.name}</>
            ) : (
              <>Playing a Game</>
            )}
          </span>
        </div>

        {/* Live Status indicator */}
        {isStreaming && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600/90 text-white animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            LIVE
          </span>
        )}

        {isSpotify && (
          <div className="flex items-center gap-0.5 h-3">
            <span className="w-1 bg-green-400 rounded-full animate-bounce" style={{ height: '100%', animationDuration: '0.8s' }} />
            <span className="w-1 bg-green-400 rounded-full animate-bounce" style={{ height: '60%', animationDuration: '0.6s' }} />
            <span className="w-1 bg-green-400 rounded-full animate-bounce" style={{ height: '80%', animationDuration: '0.9s' }} />
            <span className="w-1 bg-green-400 rounded-full animate-bounce" style={{ height: '40%', animationDuration: '0.7s' }} />
          </div>
        )}
      </div>

      {/* Main Content Details */}
      <div className="flex items-start gap-3.5">
        {/* Large Artwork Thumbnail */}
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 border border-white/20 shadow-md">
            {activity.assets?.largeImage ? (
              <img 
                src={activity.assets.largeImage} 
                alt={activity.assets.largeText || activity.name}
                className="w-full h-full object-cover" 
              />
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center text-white"
                style={{ backgroundColor: brandColor }}
              >
                {activity.provider ? (
                  <ConnectionIcon provider={activity.provider} size={28} />
                ) : (
                  <Gamepad2 className="w-8 h-8 text-white/70" />
                )}
              </div>
            )}
          </div>
          {activity.assets?.smallImage && (
            <img 
              src={activity.assets.smallImage} 
              alt={activity.assets.smallText || ''}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-slate-900 object-cover shadow-xs"
            />
          )}
        </div>

        {/* Text Information */}
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-sm text-white truncate drop-shadow-xs">
            {activity.name}
          </h4>

          {activity.details && (
            <p className="text-xs text-white/80 truncate mt-0.5 font-medium">
              {activity.details}
            </p>
          )}

          {activity.state && (
            <p className="text-xs text-white/60 truncate mt-0.5">
              {activity.state}
            </p>
          )}

          {elapsed && !activity.timestamps?.end && (
            <p className="text-[11px] text-white/50 mt-1 font-mono">
              {elapsed}
            </p>
          )}
        </div>
      </div>

      {/* Spotify / Audio Progress Bar */}
      {isSpotify && activity.timestamps?.end && (
        <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1">
          <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-green-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-white/60">
            <span>{progressTime.current}</span>
            <span>{progressTime.total}</span>
          </div>
        </div>
      )}

      {/* Interactive Action Button (e.g. Listen on Spotify, Watch Stream, View Profile) */}
      {activity.url && (
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-end">
          <a
            href={activity.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-all border border-white/15 shadow-xs"
          >
            {isSpotify ? 'Play on Spotify' : isStreaming ? 'Watch Stream' : 'View Activity'}
            <ExternalLink className="w-3 h-3 text-white/70" />
          </a>
        </div>
      )}
    </div>
  );
}
