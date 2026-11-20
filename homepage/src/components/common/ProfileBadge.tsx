import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserBadge } from '../../types/chat';

interface ProfileBadgeProps {
  badge: UserBadge | string;
  memberNumber?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTooltip?: boolean;
}

export function ProfileBadge({ badge, memberNumber, size = 'lg', showTooltip = true }: ProfileBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number; placement: 'top' | 'bottom' } | null>(null);

  // Normalize badge object if string was passed
  const badgeObj: UserBadge = typeof badge === 'string' 
    ? { id: badge.toLowerCase(), name: badge, description: badge, icon: '/badges/og.png' }
    : badge;

  const idLower = badgeObj.id?.toLowerCase() || '';
  let iconSrc = badgeObj.icon || '/badges/og.png';
  let tooltipText = badgeObj.description;

  const num = badgeObj.memberNumber || memberNumber;
  if (idLower === 'og' || badgeObj.name?.toUpperCase() === 'OG') {
    tooltipText = num ? `#${num} OG Space Pioneer` : 'Space Pioneer (OG)';
  } else if (!tooltipText) {
    tooltipText = num ? `#${num} ${badgeObj.name || 'Pioneer'}` : (badgeObj.name || 'Space Member');
  }

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10'
  }[size];

  const updatePosition = () => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const placement = rect.top < 70 ? 'bottom' : 'top';
    setCoords({
      x: rect.left + rect.width / 2,
      y: placement === 'top' ? rect.top - 8 : rect.bottom + 8,
      placement
    });
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Keep position accurate on scroll or resize while hovering
  useEffect(() => {
    if (!isHovered) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isHovered]);

  return (
    <div 
      ref={badgeRef}
      className="relative inline-flex items-center justify-center cursor-pointer select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img
        src={iconSrc}
        alt={badgeObj.name || 'Badge'}
        className={`${sizeClasses} object-contain transition-transform duration-150 hover:scale-115 active:scale-95 drop-shadow-md`}
        loading="lazy"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          if (!target.src.endsWith('/badges/og.png')) {
            target.src = '/badges/og.png';
          }
        }}
      />

      {showTooltip && isHovered && coords && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${coords.x}px`,
            top: `${coords.y}px`,
            transform: coords.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 999999,
            pointerEvents: 'none'
          }}
          className="flex flex-col items-center pointer-events-none"
        >
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: coords.placement === 'top' ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
              className="flex flex-col items-center"
            >
              {coords.placement === 'bottom' && (
                <div className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-[#00f0ff] -mb-[1px]" />
              )}
              <div 
                className="px-3 py-1.5 rounded-[6px] flex items-center justify-center whitespace-nowrap shadow-2xl"
                style={{
                  background: 'linear-gradient(180deg, #161c28 0%, #0a0d14 100%)',
                  border: '1.5px solid #00f0ff',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.85), 0 0 12px rgba(0, 240, 255, 0.4)'
                }}
              >
                <span 
                  className="text-[#00f0ff] font-bold tracking-wider uppercase text-center select-none"
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '10px',
                    lineHeight: '1.2',
                    textShadow: '0 0 6px rgba(0, 240, 255, 0.8)'
                  }}
                >
                  {tooltipText}
                </span>
              </div>
              {coords.placement === 'top' && (
                <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-[#00f0ff] -mt-[1px]" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>,
        document.body
      )}
    </div>
  );
}

interface UserBadgesListProps {
  badges?: (UserBadge | string)[];
  memberNumber?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'pill' | 'inline';
  className?: string;
}

export function UserBadgesList({ badges, memberNumber, size = 'lg', className = '' }: UserBadgesListProps) {
  // If badges are missing but user has memberNumber <= 100, construct OG badge
  let list = badges && badges.length > 0 ? [...badges] : [];
  if (list.length === 0 && memberNumber && memberNumber <= 100) {
    list.push({
      id: 'og',
      name: 'OG',
      description: `#${memberNumber} OG`,
      icon: '/badges/og.png',
      memberNumber
    });
  }

  if (list.length === 0) return null;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {list.map((b, idx) => (
        <ProfileBadge 
          key={(typeof b === 'object' && b.id) ? `${b.id}-${idx}` : idx} 
          badge={b} 
          memberNumber={memberNumber}
          size={size} 
        />
      ))}
    </div>
  );
}
